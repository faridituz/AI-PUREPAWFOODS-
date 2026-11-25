import fs from 'node:fs';

function entries(b) {
  let e = -1;
  for (let i = b.length - 22; i >= 0; i--) if (b.readUInt32LE(i) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('no EOCD');
  const cnt = b.readUInt16LE(e + 10), off = b.readUInt32LE(e + 16);
  const out = [];
  let p = off;
  for (let k = 0; k < cnt; k++) {
    if (b.readUInt32LE(p) !== 0x02014b50) throw new Error('bad central dir');
    const nl = b.readUInt16LE(p + 28), el = b.readUInt16LE(p + 30), cl = b.readUInt16LE(p + 32);
    const csize = b.readUInt32LE(p + 20), lho = b.readUInt32LE(p + 42);
    const name = b.slice(p + 46, p + 46 + nl).toString('utf8');
    const ln = b.readUInt16LE(lho + 26), le = b.readUInt16LE(lho + 28);
    const dataStart = lho + 30 + ln + le;
    out.push({ name, data: b.slice(dataStart, dataStart + csize), method: b.readUInt16LE(lho + 8) });
    p += 46 + nl + el + cl;
  }
  return out;
}

const dir = process.argv[2] || '.';
const files = fs.readdirSync(dir).filter(f => f.endsWith('_四语V2.docx')).sort();
const zlib = await import('node:zlib');
let bad = 0;
for (const f of files) {
  const es = entries(fs.readFileSync(dir + '/' + f));
  const slash = es.every(x => !x.name.includes(String.fromCharCode(92)));
  const hasCT = es.some(x => x.name === '[Content_Types].xml');
  const doc = es.find(x => x.name === 'word/document.xml');
  let xmlOk = false, rootName = '';
  if (doc) {
    const text = (doc.method === 8 ? zlib.inflateRawSync(doc.data) : doc.data).toString('utf8');
    rootName = (text.replace(/^<\?xml[^>]*\?>/, '').trimStart().match(/^<([\w:]+)/) || [])[1] || '';
    try { new (await import('node:util')).TextEncoder(); xmlOk = text.includes('</w:document>'); } catch {}
  }
  if (!slash || !hasCT || !xmlOk || rootName !== 'w:document') { bad++; console.log('BAD', f, slash, hasCT, xmlOk, rootName); }
}
console.log('checked ' + files.length + ' docx, structural problems: ' + bad);
console.log('sample entries: ' + entries(fs.readFileSync(dir + '/' + files[0])).map(x => x.name).join(', '));
