import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { createApp } from '../mvp/server/app.mjs';

const evidence = new URL('./evidence/', import.meta.url);
await mkdir(evidence, { recursive: true });
const dataDir = await mkdtemp(join(tmpdir(), 'purepaw-browser-'));
const app = createApp({ dataDir, worker: false });
const results = [];
const errors = [];
const external = [];
let browser;
let page;

try {
  await new Promise((resolve, reject) => {
    app.server.once('error', reject);
    app.server.listen(0, '127.0.0.1', resolve);
  });
  const origin = 'http://127.0.0.1:' + app.server.address().port;
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, serviceWorkers: 'block' });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    external.push(url.origin);
    return route.abort();
  });
  page = await context.newPage();
  page.setDefaultTimeout(6000);
  page.on('pageerror', error => errors.push(error.message));
  const dialog = page.locator('dialog');
  const button = (name, scope = page) => scope.getByRole('button', { name, exact: true });
  const field = (name, scope = dialog) => scope.locator('[name="' + name + '"]');
  const row = text => page.getByRole('row').filter({ hasText: text });
  const visible = locator => locator.waitFor({ state: 'visible' });
  const state = async () => {
    const response = await page.request.get(origin + '/api/state');
    assert.equal(response.status(), 200);
    return response.json();
  };
  const nav = async name => {
    await page.getByRole('navigation', { name: '主要导航' }).getByRole('button', { name }).click();
    await visible(page.getByRole('heading', { level: 1, name, exact: true }));
  };
  const submit = async (name, path, scope = dialog) => {
    const [response] = await Promise.all([
      page.waitForResponse(item => new URL(item.url()).pathname === path && item.request().method() !== 'GET'),
      button(name, scope).click()
    ]);
    const result = await response.json();
    assert(response.ok(), JSON.stringify(result));
    if (scope === dialog) await dialog.waitFor({ state: 'hidden' });
    return result;
  };
  const fields = async values => {
    for (const [name, value] of Object.entries(values)) await field(name).fill(value);
  };
  const selectText = async (name, text, scope = dialog) => {
    const select = field(name, scope);
    const value = await select.locator('option').filter({ hasText: text }).first().getAttribute('value');
    await select.selectOption(value);
  };
  const shot = async name => {
    await page.screenshot({ path: fileURLToPath(new URL(name + '.png', evidence)), fullPage: true, animations: 'disabled' });
  };
  const step = async (name, run) => {
    console.log(name);
    try {
      await run();
      results.push({ name, status: '通过' });
    } catch (error) {
      results.push({ name, status: '失败', error: String(error) });
      await shot('failure');
      throw error;
    }
  };
  const role = async name => {
    await button('切换本地角色').click();
    await page.locator('#role-switch-' + name).check();
    await submit('切换本地角色', '/api/auth/demo');
    await visible(page.getByRole('heading', { name: '工作概览', exact: true }));
  };
  const sku = 'QA-BROWSER-CAT';
  const name = '浏览器验收虚构猫粮';
  const customer = '浏览器验收虚构客户';
  const title = '浏览器验收虚构上市帖';
  let productId;
  let customerId;
  let orderId;
  await step('管理后台：登录、角色视图与沙盒标识', async () => {
    await page.goto(origin);
    await submit('进入本地工作台', '/api/auth/demo', page);
    await visible(page.getByRole('heading', { name: '工作概览', exact: true }));
    await visible(page.locator('.sandbox-tag'));
    await shot('01-dashboard');
    await role('auditor');
    assert.equal(await button('客户关系').count(), 0);
    await nav('审计日志');
    await shot('01-auditor');
    await role('admin');
  });
  await step('产品管理：三语草稿、价格审批和批次入库', async () => {
    await nav('产品与批次');
    await button('新建产品').click();
    await fields({ sku, name_zh: name, name_uz: 'Sinov mushuk ozuqasi', name_ru: 'Тестовый корм', spec: '1 kg', ingredients: '仅供本机验收的虚构资料', price: '80000', wholesale: '68000' });
    await submit('创建草稿', '/api/products');
    await visible(row(sku).getByText('待审核', { exact: true }));
    productId = (await state()).products.find(item => item.sku === sku).id;
    await button('价格申请', row(sku)).click();
    await submit('提交审核', '/api/products/' + productId + '/price-request');
    const approval = (await state()).approvals.find(item => item.target_id === productId);
    await nav('审批中心');
    await button('处理', row(approval.id)).click();
    await field('decision').selectOption('approved');
    await fields({ note: '仅批准本地验收演示价格' });
    await submit('提交审批决定', '/api/approvals/' + approval.id + '/decide');
    await nav('产品与批次');
    await visible(row(sku).getByText('已通过', { exact: true }));
    await button('入库', row(sku)).click();
    const day = shift => new Date(Date.now() + shift * 86400000).toISOString().slice(0, 10);
    await fields({ code: 'QA-BROWSER-BATCH', quantity: '12', manufactured_at: day(-2), expires_at: day(90) });
    await submit('确认登记', '/api/batches');
    await visible(row(sku).getByText('12', { exact: true }));
    await shot('02-products');
  });
  await step('营销发布：草稿拦截、审核、模拟发布与重复执行', async () => {
    await nav('社交内容');
    await button('创建内容').click();
    await field('channel').selectOption('instagram');
    const tashkentPast = new Date(Date.now() + 5 * 3600000 - 120000).toISOString().slice(0, 16);
    await fields({ scheduled_at: tashkentPast, title, body: '虚构商品介绍。仅在本机模拟曝光。' });
    await submit('创建待审内容', '/api/content');
    const card = page.locator('article').filter({ hasText: title });
    const runJobs = async () => {
      await button('运行到期模拟任务').click();
      await submit('运行本地模拟', '/api/jobs/run');
    };
    await runJobs();
    await visible(card.getByText('待审核', { exact: true }));
    await shot('03-content-draft');
    const jobId = (await state()).content_jobs.find(item => item.title === title).id;
    await button('审核并排期', card).click();
    await submit('确认审核并排期', '/api/content/' + jobId + '/approve');
    await visible(card.getByText('待模拟', { exact: true }));
    await runJobs();
    await visible(card.getByText('已模拟', { exact: true }));
    await runJobs();
    assert.equal((await state()).content_jobs.find(item => item.id === jobId).attempts, 1);
    await shot('04-content-simulated');
  });
  const setStage = async (stage, label) => {
    await nav('客户关系');
    await button('跟进', row(customer)).click();
    await field('stage').selectOption(stage);
    await fields({ follow_up_at: '2026-12-01T14:30' });
    await submit('保存跟进', '/api/customers/' + customerId);
    await visible(row(customer).getByText(label, { exact: true }));
  };
  await step('CRM：Instagram 虚构线索、跟进时间与默认无营销同意', async () => {
    await nav('客户关系');
    await button('新建客户').click();
    await fields({ name: customer, contact: 'qa-browser-fictitious' });
    await field('platform').selectOption('instagram');
    await field('language').selectOption('uz');
    await field('pet_type').selectOption('cat');
    await submit('创建客户', '/api/customers');
    await visible(row(customer).getByText('未同意', { exact: true }));
    customerId = (await state()).customers.find(item => item.name === customer).id;
    await setStage('qualified', '已了解');
    await shot('05-crm');
  });
  await step('AI 客服：乌语配送、俄语价格、人工接管', async () => {
    await nav('客服沙盒');
    const simulator = page.locator('.simulator');
    await selectText('customer_id', customer, simulator);
    await field('text', simulator).fill('Yetkazib berish?');
    await submit('运行消息模拟', '/api/sandbox/message', simulator);
    await visible(page.locator('.simulation-result').getByText(/kb-uz-delivery/));
    await field('language', simulator).selectOption('ru');
    await field('text', simulator).fill('Какая цена?');
    await submit('运行消息模拟', '/api/sandbox/message', simulator);
    await visible(page.locator('.simulation-result').getByText(/Только демо/));
    await visible(page.locator('.simulation-result').getByText(new RegExp(sku)));
    const conversation = (await state()).conversations.find(item => item.customer_id === customerId);
    await button('人工接管', page.locator('.thread')).click();
    await submit('确认接管', '/api/conversations/' + conversation.id + '/takeover');
    await visible(button('恢复自动回复'));
    await shot('06-support');
    await button('恢复自动回复').click();
    await submit('恢复自动回复', '/api/conversations/' + conversation.id + '/takeover');
    await field('text', simulator).fill('Mushuk uchun ozuqa sotib olmoqchiman.');
    await submit('运行消息模拟', '/api/sandbox/message', simulator);
    await visible(page.locator('.simulation-result').getByText(/intent-collected/));
    await visible(button('恢复自动回复'));
    assert.equal((await state()).orders.filter(item => item.customer_id === customerId).length, 0);
    await shot('06-purchase-intent');
  });
  await step('订单管理：询价、报价、确认扣库、付款、仓库配送与复购', async () => {
    await nav('客户关系');
    await button('下单', row(customer)).click();
    await selectText('product_id', name);
    await fields({ quantity: '2' });
    await submit('创建询价订单', '/api/orders');
    orderId = (await state()).orders.find(item => item.customer_id === customerId).id;
    const orderRow = row(orderId);
    const transition = action => submit(action, '/api/orders/' + orderId + '/transition');
    await nav('订单管理');
    await visible(orderRow.getByText('询价中', { exact: true }));
    await button('报价', orderRow).click();
    await transition('生成演示报价');
    await visible(orderRow.getByText('已报价', { exact: true }));
    await shot('07-order-quote');
    await button('确认', orderRow).click();
    await transition('确认演示订单');
    await visible(orderRow.getByText('已确认', { exact: true }));
    assert.equal((await state()).products.find(item => item.id === productId).stock, 10);
    await button('详情', orderRow).click();
    await button('标记演示付款', dialog).click();
    await transition('标记演示付款');
    await visible(orderRow.getByText('已付款', { exact: true }));
    await role('warehouse');
    await nav('订单管理');
    await visible(orderRow.getByText('联系人已隐藏', { exact: true }));
    await button('发货', orderRow).click();
    await transition('模拟发货');
    await visible(orderRow.getByText('已发货', { exact: true }));
    await button('送达', orderRow).click();
    await transition('标记演示送达');
    await visible(orderRow.getByText('已送达', { exact: true }));
    await shot('08-order-delivered');
    await role('admin');
    await setStage('won', '已成交');
    await nav('订单管理');
    await button('详情', orderRow).click();
    await button('创建复购', dialog).click();
    await submit('创建询价订单', '/api/orders');
    const reorder = (await state()).orders.find(item => item.reorder_of === orderId);
    assert.equal(reorder.customer_id, customerId);
    await button('详情', row(reorder.id)).click();
    await visible(dialog.getByText(orderId, { exact: true }));
    await shot('09-reorder');
    await page.keyboard.press('Escape');
  });
  await step('管理后台：刷新后订单可追溯并可退出', async () => {
    await page.reload();
    await nav('订单管理');
    await visible(row(orderId).getByText('已送达', { exact: true }));
    await button('退出本地会话').click();
    await submit('退出会话', '/api/auth/logout');
    await visible(button('进入本地工作台'));
    assert.equal((await page.request.get(origin + '/api/state')).status(), 401);
    await shot('10-logout');
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
  });
} finally {
  await writeFile(new URL('results.json', evidence), JSON.stringify({ node: process.version, browser: browser?.version(), results, errors, external }, null, 2));
  await browser?.close();
  await app.close();
  await rm(dataDir, { recursive: true, force: true });
}
