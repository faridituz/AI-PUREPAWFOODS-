import { spawn } from 'node:child_process';
import { mkdtempSync,readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

const probe=createServer();
probe.listen(0,'127.0.0.1');
await once(probe,'listening');
const port=probe.address().port;
await new Promise(resolve=>probe.close(resolve));
const demo=spawn(process.execPath,['scripts/trade-demo.mjs'],{env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
const profile=mkdtempSync(join(tmpdir(),'purepaw-edge-'));
let browser, socket, output='';
demo.stdout.on('data',chunk=>output+=chunk);
async function until(fn) {
  for(let n=0;n<150;n++) {
    try { const result=await fn(); if(result) return result; } catch {}
    await delay(100);
  }
  throw Error('Browser smoke timed out');
}
try {
  await until(()=>output.includes('临时数据库'));
  const users=Object.fromEntries([...output.matchAll(/'([a-z]+\.demo)'\s*│\s*'([\w-]+)'/g)].map(x=>[x[1],x[2]]));
  assert.equal(Object.keys(users).length,5);
  browser=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',[
    '--headless=new','--no-first-run','--disable-background-networking','--remote-debugging-port=0',
    '--user-data-dir='+profile,'about:blank'
  ],{stdio:'ignore',windowsHide:true});
  const debugPort=await until(()=>readFileSync(join(profile,'DevToolsActivePort'),'utf8').split(/\r?\n/)[0]);
  const target=await until(async()=>{
    const targets=await (await fetch('http://127.0.0.1:'+debugPort+'/json/list')).json();
    return targets.find(x=>x.type==='page');
  });
  socket=new WebSocket(target.webSocketDebuggerUrl);
  await once(socket,'open');
  let sequence=0;
  const pending=new Map();
  socket.onmessage=event=>{
    const message=JSON.parse(event.data);
    if (pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  };
  async function send(method,params={}) {
    const id=++sequence;
    const response=await new Promise(resolve=>{
      pending.set(id,resolve);
      socket.send(JSON.stringify({id,method,params}));
    });
    if(response.error) throw Error(response.error.message);
    return response.result;
  }
  async function run(expression) {
    const result=await send('Runtime.evaluate',{expression,returnByValue:true});
    if(result.exceptionDetails) throw Error(result.exceptionDetails.text);
    return result.result.value;
  }
  const by=id=>`document.getElementById(${JSON.stringify(id)})`;
  const wait=expr=>until(()=>run(expr));
  async function login(user) {
    await run(`document.forms.login.elements.username.value=${JSON.stringify(user)};
      document.forms.login.elements.password.value=${JSON.stringify(users[user])};document.forms.login.requestSubmit()`);
    await wait(`${by('identity')}.textContent.includes(${JSON.stringify(user)}) && ${by('status')}.textContent==='操作成功。'`);
  }
  async function logout() {
    await run(`${by('logout')}.click()`);
    await wait(`!${by('login')}.hidden`);
  }
  async function order(id) {
    await wait(`[...${by('orders')}.options].some(o=>o.value===${JSON.stringify(id)})`);
    await run(`${by('orders')}.value=${JSON.stringify(id)};${by('orders')}.dispatchEvent(new Event('change'))`);
    await wait(`${by('summary')}.textContent.includes('版本')`);
  }
  async function action(name,fields={}) {
    await run(`${by('status')}.textContent='';${by('action-name')}.value=${JSON.stringify(name)};
      ${by('action-name')}.dispatchEvent(new Event('change'));
      for(const [key,value] of Object.entries(${JSON.stringify(fields)})) {
        const field=document.forms.action.elements[key];
        if(field.type==='checkbox') field.checked=value; else field.value=value;
      }
      document.forms.action.requestSubmit()`);
    await wait(`${by('status')}.textContent==='操作成功。'`);
  }
  await send('Page.navigate',{url:'http://localhost:'+port+'/trade'});
  await wait(`document.forms.login && document.readyState==='complete'`);
  await login('sales.demo');
  await run(`${by('status')}.textContent='';${by('add-line')}.click();${by('lines')}.lastElementChild.querySelector('select').selectedIndex=1;
    document.forms.order.requestSubmit()`);
  await wait(`${by('summary')}.textContent.includes('14500000')`);
  const id=await run(`${by('orders')}.value`);
  await action('reserve');
  await action('payment',{amount:14500000,method:'bank',reference:'DEMO-BROWSER-1',evidence:'FAKE-BROWSER'});
  await logout();
  await login('finance.demo');
  await order(id);
  await action('verify',{amount:14500000,bankReference:'DEMO-BROWSER-1',bankReceived:true,reason:'虚构到账复核'});
  assert.match(await run(`${by('summary')}.textContent`),/已核实 14500000/);
  await logout();
  await login('warehouse.demo');
  await order(id);
  await action('release',{evidence:'TEST-RELEASE'});
  assert.match(await run(`${by('summary')}.textContent`),/released/);
  await logout();
  await login('admin.demo');
  await run(`${by('audit')}.click()`);
  await wait(`${by('result')}.textContent.includes('fulfillment.release')`);
  console.log('PASS: Edge headless UI, 4 roles, two SKUs, reserve, bank verification, warehouse release, admin audit');
} finally {
  socket?.close();
  browser?.kill();
  demo.kill();
}
