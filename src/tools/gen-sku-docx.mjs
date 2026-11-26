import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data/work');
const SRC = path.join(ROOT, 'sku-data');
const BUILD = path.join(ROOT, 'build');

const EAN = {
  '全猫鸡肉1.5': ['4780178200018', '条码登记表第1条'],
  '全猫鸡肉3': ['4780178200025', '条码登记表第2条'],
  '全猫鸡肉10': ['4780178200032', '条码登记表第3条'],
  '全猫牛肉1.5': ['4780178200049', '条码登记表第4条'],
  '全猫牛肉3': ['4780178200056', '条码登记表第5条；文件核对清单一致'],
  '全猫牛肉10': ['4780178200063', '文件核对清单'],
  '幼猫鸡肉1.5': ['4780178200070', '文件核对清单；2026-11-06 核对结果称登记表为幼猫/孕哺猫鸡肉'],
  '幼猫鸡肉3': ['4780178200087', '文件核对清单'],
  '幼猫鸡肉10': ['4780178200094', '文件核对清单'],
  '全犬牛肉1.5': ['4780178200100', '文件核对清单；PSD可见号码一致'],
  '全犬牛肉5': ['4780178200117', '文件核对清单'],
  '全犬牛肉15': ['4780178200124', '文件核对清单'],
  '全犬鸡肉1.5': ['4780178200162', '文件核对清单；注意PSD曾显示4780178200193（与小犬牛肉1.5重复），须核实'],
  '全犬鸡肉5': ['4780178200179', '文件核对清单'],
  '全犬鸡肉15': ['4780178200186', '文件核对清单'],
  '小犬牛肉1.5': ['4780178200193', '文件核对清单；与全犬鸡肉1.5的PSD号码重复，须核实'],
  '小犬牛肉3': ['4780178200209', '文件核对清单'],
  '小犬鸡肉1.5': ['4780178200230', '文件核对清单'],
  '小犬鸡肉3': ['4780178200247', '文件核对清单'],
};

const REG_NAME = {
  '全猫鸡肉1.5': 'Корм для кошек всех возрастов с курицей',
  '全猫鸡肉3': 'Корм для кошек всех возрастов с курицей',
  '全猫鸡肉10': 'Корм для кошек всех возрастов с курицей',
  '全猫牛肉1.5': 'Корм для кошек всех возрастов с говядиной',
  '全猫牛肉3': 'Корм для кошек всех возрастов с говядиной',
  '全猫牛肉10': 'Корм для кошек всех возрастов с говядиной',
};

const LANG_MARK = {
  '乌兹别克语（拉丁字母）': ['uz', '乌兹别克语（拉丁字母）Uzbek (Latin)'],
  '俄语': ['ru', '俄语 Russian'],
  '哈萨克语（西里尔字母）': ['kk', '哈萨克语（西里尔字母）Kazakh (Cyrillic)'],
  '英语': ['en', '英语 English'],
};

const VALUE_RE = /^[≥≤<>≈]?\s*[-+]?\s*[\d.]/;
const FEED_HEAD_RE = /(oziqlantirish miqdori|суточное количество|азық мөлшері|Feeding Amount|суточная норма|Kunlik)/i;
const TRANS_RE = /(7 ?kunlik|7-дневный|7 күнде|7-Day|7 day)/i;

const CELL_RE = /^[≥≤<>≈]?\s*[-+]?\s*[\d.]+\s*(?:[-–—]{1,2}\s*[\d.]+)?\s*(?:kg|г|кг|g|oy|мес|mes|kun|күн|день|天)?\.?$/i;

function parseSku(txt, sku) {
  const lines = txt.split(/\r?\n/);
  const o = { sku, brand: [], langs: [], company: [], warnings: [], raw: txt };
  let mode = 'head', cur = null;
  const known = new Set(['品牌理念', '四语信息表', '公司联系信息', ...Object.keys(LANG_MARK)]);

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const l = raw.trim();
    if (!l) continue;
    if (i < 2) continue;
    if (known.has(l)) {
      if (l === '品牌理念') { mode = 'brand'; continue; }
      if (l === '四语信息表') { mode = 'none'; continue; }
      if (l === '公司联系信息') { mode = 'company'; continue; }
      const [code, label] = LANG_MARK[l];
      cur = { code, label, title: '', fields: [], analysis: [], feedHead: '', header: [], rows: [], note: '', _mode: 'title', _label: '' };
      o.langs.push(cur);
      mode = 'lang';
      continue;
    }
    if (mode === 'company') { if (l === 'Mасса нетто' || l === 'Sof og‘irligi') continue; o.company.push(l); continue; }
    if (mode !== 'lang' || !cur) continue;

    if (l === '项目' || l === '含量') { cur._mode = 'analysis'; cur._label = ''; continue; }
    if (l === '天数' || /^purepaw/i.test(l)) { cur._mode = 'transition'; continue; }

    if (cur._mode === 'transition') {
      if (FEED_HEAD_RE.test(l)) { cur._mode = 'feedhead'; cur.feedHead = l; }
      continue;
    }
    if (cur._mode === 'analysis') {
      if (TRANS_RE.test(l)) { cur._mode = 'transition'; continue; }
      if (VALUE_RE.test(l)) { cur.analysis.push([cur._label.trim(), l]); cur._label = ''; continue; }
      cur._label += (cur._label ? ' ' : '') + l;
      continue;
    }
    if (cur._mode === 'feedhead') { cur._mode = 'header'; cur.header.push(l); continue; }
    if (cur._mode === 'fields') {
      if (TRANS_RE.test(l)) { cur._mode = 'transition'; continue; }
      if (/[:：]$/.test(l)) { cur.fields.push({ name: l.replace(/[:：]$/, ''), text: '' }); continue; }
      if (cur.fields.length) { const f = cur.fields[cur.fields.length - 1]; f.text += (f.text ? ' ' : '') + l; }
      else if (/Ma.lumotlari|информация|Information/i.test(l)) cur.title += (cur.title ? ' ' : '') + l;
      continue;
    }
    if (cur._mode === 'header') {
      if (VALUE_RE.test(l)) { cur._mode = 'rows'; cur.rows.push(l); continue; }
      cur.header.push(l);
      continue;
    }
    if (cur._mode === 'rows') { cur.rows.push(l); continue; }
    if (cur._mode === 'title') { cur._mode = 'fields'; i--; continue; }
  }

  for (const c of o.langs) {
    if (!c.rows.length) { if (c.code !== 'kk') o.warnings.push(c.label + ' 未解析到喂食表'); continue; }
    const all = c.header.map(s => s.trim()).concat(c.rows.map(s => s.trim()));
    let start = all.findIndex(x => CELL_RE.test(x));
    if (start < 0) start = all.length;
    let end = all.length;
    while (end > start && !CELL_RE.test(all[end - 1])) end--;
    c.note = all.slice(end).join(' ');
    const cells = all.slice(start, end);
    c.midProse = cells.some(x => !CELL_RE.test(x));
    c.header = all.slice(0, start);
    c.rows = [];
    const cand = [...new Set([c.header.length, 3, 2, 4])].filter(n => n >= 2 && n <= 4);
    const ncols = c.midProse ? 1 : cand.find(n => cells.length % n === 0) || 1;
    c.ncols = ncols;
    if (ncols === 1) {
      c.rows = cells.map(x => [x]);
      o.warnings.push(c.label + ' 喂食表原始图层顺序无法整理为规则表格（数据之间夹有标题，或项数不能整除），本稿按原始顺序单列保留，未自动配对，须对照原 Word 与《Word原文疑点》人工确认');
    } else {
      for (let k = 0; k < cells.length; k += ncols) c.rows.push(cells.slice(k, k + ncols));
    }
  }
  const empty = o.langs.filter(c => !c.fields.length).map(c => c.label);
  if (empty.length) o.warnings.push('字段为空：' + empty.join('、'));
  return o;
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const runs = (t, extra = '') => {
  const parts = String(t).split('\n');
  return parts.map((p, i) => (i ? '<w:br/>' : '') + '<w:r>' + extra + '<w:t xml:space="preserve">' + esc(p) + '</w:t></w:r>').join('');
};
const para = (t, opt = {}) => {
  const pr = '<w:pPr>' + (opt.style ? `<w:pStyle w:val="${opt.style}"/>` : '') + (opt.align ? `<w:jc w:val="${opt.align}"/>` : '') +
    (opt.shade ? `<w:shd w:val="clear" w:fill="${opt.shade}"/>` : '') + (opt.spacing ? `<w:spacing before="${opt.spacing[0]}" after="${opt.spacing[1]}"/>` : '') + '</w:pPr>';
  const b = opt.bold ? '<w:rPr><w:b/></w:rPr>' : '';
  const col = opt.color ? `<w:rPr><w:b/>${opt.bold ? '' : ''}<w:color w:val="${opt.color}"/></w:rPr>` : '';
  const extra = opt.bold || opt.color ? `<w:rPr>${opt.bold ? '<w:b/>' : ''}${opt.color ? `<w:color w:val="${opt.color}"/>` : ''}</w:rPr>` : '';
  return '<w:p>' + pr + runs(t, extra) + '</w:p>';
};
const cell = (t, w, o = {}) => {
  const shd = o.fill ? `<w:shd w:val="clear" w:fill="${o.fill}"/>` : '';
  const rp = o.bold ? '<w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr>' : '';
  const lines = String(t).split('\n');
  const ps = lines.map(ln => '<w:p><w:pPr><w:spacing before="20" after="20"/></w:pPr>' + runs(ln, rp) + '</w:p>').join('');
  return `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${shd}<w:vAlign w:val="top"/></w:tcPr>${ps}</w:tc>`;
};
const table = (rows, widths, headerFill) => {
  const grid = widths.map(w => `<w:gridCol w:w="${w}"/>`).join('');
  const body = rows.map((r, ri) => {
    const isH = ri === 0 && headerFill;
    return '<w:tr>' + r.map((c, ci) => cell(c, widths[ci], isH ? { fill: headerFill, bold: true } : {})).join('') + '</w:tr>';
  }).join('');
  return `<w:tbl><w:tblPr><w:tblStyle w:val="Grid"/><w:tblW w:w="5000" w:type="pct"/><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${body}</w:tbl>`;
};

function buildDoc(o) {
  const [ean, eanSrc] = EAN[o.sku] || ['【未登记】', '未找到'];
  const net = (fs.readFileSync(path.join(SRC, o.sku + '-文字.txt'), 'utf8').match(/(\d+(?:\.\d+)?)\s*kg/) || [, '【未标注】'])[0];
  const B = [];
  B.push(para('Pure Paw Nutrition｜' + o.sku + '　包装背面四语数据稿（Word 定稿）', { style: 'T1' }));
  B.push(para(`净含量 ${net}　EAN-13 ${ean}　来源：${o.sku}-文字 Word 提取（dog-review/texts.json）　生成日期 2026-11-23`, { align: 'center', color: '4A6B4F' }));
  B.push(para('本稿由已删除的 PSD/图片版数据回转为 Word 文字，逐字沿用原 Word 文案，未替换任何数值或译文。按 2026-11-23 指示，四语的“7 日换粮方法”表格已完全移除，本稿不再保留其任何内容，只保留每日建议饲喂量表。所有【……】为待填字段，所有“设计说明/核对备注”不印刷。'));

  if (REG_NAME[o.sku]) {
    B.push(para('产品登记名称（俄语，条码登记表）：' + REG_NAME[o.sku], { bold: true }));
    B.push(para('设计说明：登记表只覆盖全龄猫鸡肉/牛肉两款，其余产品名的乌语、哈语、英语写法本机文字数据中没有，须按正式条码登记表页补齐，不得自行翻译。', { color: '8A8A8A' }));
  } else {
    B.push(para('产品登记名称：【待填，须取自 purapaw产品条形码.pdf 对应条目；本机文本仅提取到前 5 条】', { color: 'B00000' }));
  }

  B.push(para('01｜品牌理念', { style: 'H1' }));
  B.push(para(o.brand.join('\n')));
  B.push(para('设计说明：以上为原 PSD/Word 中保留的俄语短文，乌语、哈语、英语对应版本尚未提供，不在此稿中生成。', { color: '8A8A8A' }));

  o.langs.forEach((c, i) => {
    B.push(para(`0${i + 2}｜${c.label}${c.title ? '　' + c.title : ''}`, { style: 'H1' }));
    if (!c.fields.length) B.push(para('【本版原文未包含该语言栏目】', { color: 'B00000' }));
    c.fields.forEach(f => {
      B.push(para(f.name, { style: 'H2' }));
      B.push(para(f.text));
    });
    if (c.analysis.length) {
      B.push(para(c._analysisTitle || '保证分析（原表头：项目／含量）', { style: 'H2' }));
      B.push(table([['项目（' + c.code.toUpperCase() + '）', '含量']].concat(c.analysis), [5200, 3526], '1B3A2B'));
    }
    if (c.rows.length) {
      B.push(para(c.feedHead || '每日建议饲喂量', { style: 'H2' }));
      const head = c.ncols === 1 ? ['原图层顺序（未配对，须人工确认）'] : c.header.slice(0, c.ncols);
      while (head.length < c.ncols) head.push('列名待补');
      B.push(table([head].concat(c.rows.map(r => r.concat(Array(c.ncols - r.length).fill('')))),
        Array(c.ncols).fill(Math.floor(8726 / c.ncols)), '1B3A2B'));
      if (c.note) B.push(para('说明：' + c.note));
    } else if (c.fields.length) {
      B.push(para('【喂食表解析失败】', { color: 'B00000' }));
    }
  });

  B.push(para('06｜企业与联系信息', { style: 'H1' }));
  B.push(table([['字段', '内容']].concat(o.company.map(l => [l.includes(':') ? l.split(/[:：]/)[0] : '原文行', l])), [2600, 6126], '1B3A2B'));
  B.push(para('设计说明：以上内容逐字取自原 Word，未补全语言标识。地址“Ташкент, Корасув”与营业执照登记地址（Yakkasaroy, Shota Rustaveli 53-B）不一致，属生产地址与注册地址的区别还是笔误，须由公司与工厂确认后定稿。重复 6 次的“purepawfoods”为原 PSD 的 6 个社交平台图层，未标注平台名称。', { color: '8A8A8A' }));

  B.push(para('07｜净含量与条码', { style: 'H1' }));
  B.push(table([['项目', '内容'], ['净含量', net], ['EAN-13', ean], ['号码来源', eanSrc]], [2200, 6526], '1B3A2B'));

  B.push(para('08｜四语数值对照（自动核对）', { style: 'H1' }));
  const val = (c, re) => { const r = c.analysis.find(a => re.test(a[0])); return r ? r[1] : '—'; };
  const meat = c => { const f = c.fields.find(x => /Ingredientlar|Состав|Құрамы|Ingredients/i.test(x.name)); const m = f && f.text.match(/Mol goʻshti|Говядина|говядина|говяж|Ірі қара|Beef|Tovuq|Куриное|куриц|куряв|тауық|Chicken/i); return m ? m[0] : '—'; };
  const IND = [['主原料用词', null], ['蛋白', /oqsil|белок|ақуыз|Protein/i], ['脂肪', /yog|жир|май\b|Fat/i], ['粗纤维', /tola|клетчатка|жасұнық|Fibre|fiber/i],
  ['灰分', /kul|зола|күл|Ash/i], ['水分', /namlik|Влажность|Ылғалдылық|Moisture/i], ['钙', /Kalsiy|Кальций|Кальций|Calcium/i], ['磷', /fosfor|фосфор|фосфор|Phosphorus/i], ['牛磺酸', /Taurin|Таурин|Taurine/i]];
  const rowsX = [IND.map(x => x[0]).slice(0, 9)];
  for (const c of o.langs) rowsX.push([c.code.toUpperCase(), meat(c)].concat(IND.slice(1).map(([, re]) => val(c, re))));
  B.push(table(rowsX, [900, 1500, 1100, 1100, 1100, 1000, 1000, 1000, 1000], '1B3A2B'));

  B.push(para('09｜数据状态与待办（不印刷）', { style: 'H1' }));
  const iss = [];
  const ing = c => { const f = c.fields.find(x => /Ingredientlar|Состав|Құрамы|Ingredients/i.test(x.name)); return f ? f.text : ''; };
  const chickenRe = /Tovuq|Куриное|куриц|тауық|Chicken|куряв/i, beefRe = /Mol go|Говядина|говядина|говяж|Ірі қара|Сиыр|Beef/i;
  if (/牛肉/.test(o.sku)) {
    const bad = o.langs.filter(c => chickenRe.test(ing(c)) && !beefRe.test(ing(c))).map(c => c.code.toUpperCase());
    if (bad.length) iss.push('品名为牛肉，但 ' + bad.join('、') + ' 的配料仍写鸡肉，四语未同步，须按批准配方改正。');
    else iss.push('四语配料均为牛肉表述（乌语 Mol goʻshti、俄语 Говядина 等），其中鸡油（tovuq yog‘и／куриный жир）按原文保留，是否使用鸡油取决于真实配方，未机械替换。');
  }
  if (/鸡肉/.test(o.sku)) {
    const bad = o.langs.filter(c => beefRe.test(ing(c))).map(c => c.code.toUpperCase());
    if (bad.length) iss.push('品名为鸡肉，但 ' + bad.join('、') + ' 的配料出现牛肉表述，须核实。');
  }
  for (const [, re] of IND.slice(1)) {
    const set = [...new Set(o.langs.map(c => val(c, re)).filter(v => v !== '—'))];
    if (set.length > 1) iss.push('四语数值不一致：' + set.join(' / '));
  }
  const allVals = o.langs.flatMap(c => c.analysis.map(a => a[1]));
  if (allVals.some(v => /≥\s*[-–]/.test(v))) iss.push('营养指标出现“≥”后紧跟负号的写法（如 ≥-1.1%），符号异常，须确认为 ≥1.1% 还是范围值；本稿按原文保留。');
  if (allVals.some(v => /≥[^\s]*[-–]\s*\d/.test(v) && /%/.test(v))) iss.push('存在下限符号与范围混用的指标（如 ≥0.9-1.1%），须由配方负责人确认为下限、范围或上下限，本稿未自行改数值。');
  const feedCells = o.langs.flatMap(c => c.rows.flat());
  if (feedCells.some(v => /--/.test(v))) iss.push('喂食表出现双连字符的克数区间（如 100--125g），按原文保留，须统一为单个连接号。');
  const kinds = new Set(o.langs.filter(c => !c.midProse && c.ncols > 1).map(c => c.ncols));
  if (/幼猫/.test(o.sku) && kinds.size > 1) iss.push('幼猫款各语言的喂食表结构不一致：部分语言仍是成猫体重表（kg×活动量），部分已改为幼猫月龄表，须统一为经核定的幼猫方案。');
  if (/猫/.test(o.sku) && /鸡肉|牛肉/.test(o.sku) && o.langs.some(c => c.ncols === 3)) iss.push('本款喂食表按成猫体重列示；若产品定位为幼猫或全龄，须确认适用范围与品名一致。');
  o.langs.forEach(c => { if (c.feedHead && (c.feedHead.split('(').length !== c.feedHead.split(')').length)) iss.push(c.label + ' 喂食表标题括号不完整（原文截断），须补齐。'); });
  const catWord = /mushuk|cat food|кошк|мысық/i, dogName = /犬/.test(o.sku);
  if (dogName && catWord.test(o.raw)) { const hit = [...new Set(o.raw.split(/\r?\n/).filter(l => catWord.test(l)).map(l => l.trim().slice(0, 60)))].slice(0, 4); iss.push('犬粮文件中残留猫粮称谓，须由对应语言人员改正：' + hit.join(' ／ ')); }
  if (o.sku === '小犬牛肉1.5' || o.sku === '全犬鸡肉1.5') iss.push('条码：核对时 全犬鸡肉1.5 与小犬牛肉1.5 的 PSD 合成图曾同时显示 4780178200193，须对照正式商品条码清单确认后印刷。');
  if (/^全犬|^小犬/.test(o.sku)) iss.push('喂食表取自 Word 版数据（1-4kg 起的分段），此前 PSD 图中的 2–3kg 起旧表作废；末行体重范围须最终确认。');
  if (o.warnings.length) iss.push('解析告警：' + o.warnings.join('；'));
  iss.push('7 日换粮方法已按指示从四语版面移除；如需恢复须另行确认，且犬粮不得使用猫粮称谓的换粮文案。');
  iss.push('本稿只做文字与结构整理，数值与译文逐字沿用原 Word，未做配方、翻译、法规及条码注册的合规验收。');
  B.push(para(iss.map((s, i) => (i + 1) + '. ' + s).join('\n')));
  return B.join('');
}

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
function docXml(body, title) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${W}"><w:body>${body}
<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="850" w:right="800" w:bottom="850" w:left="800" w:header="425" w:footer="425" w:gutter="0"/>
<w:pgNumType/><w:cols w:space="708"/><w:docGrid w:linePitch="360"/></w:sectPr></w:body></w:document>`;
}

const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="${W}">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Microsoft YaHei" w:cs="Arial"/><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Hdr"><w:name w:val="header"/><w:pPr><w:tabs><w:tab w:val="right" w:pos="10306"/></w:tabs></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="T1"><w:name w:val="Title"/><w:pPr><w:jc w:val="center"/><w:spacing w:after="120"/></w:pPr><w:rPr><w:b/><w:color w:val="1B3A2B"/><w:sz w:val="34"/><w:szCs w:val="34"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="H1"><w:name w:val="heading 1"/><w:pPr><w:keepNext/><w:shd w:val="clear" w:fill="1B3A2B"/><w:spacing w:before="280" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="25"/><w:szCs w:val="25"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="H2"><w:name w:val="heading 2"/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="60"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:color w:val="1B3A2B"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:style>
<w:style w:type="table" w:styleId="Grid"><w:name w:val="Table Grid"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:color="A9C3A9"/><w:left w:val="single" w:sz="4" w:color="A9C3A9"/><w:bottom w:val="single" w:sz="4" w:color="A9C3A9"/><w:right w:val="single" w:sz="4" w:color="A9C3A9"/><w:insideH w:val="single" w:sz="4" w:color="A9C3A9"/><w:insideV w:val="single" w:sz="4" w:color="A9C3A9"/></w:tblBorders><w:tblCellMar><w:left w:w="60" w:type="dxa"/><w:right w:w="60" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>
</w:styles>`;

const CT = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;

const ROOTRELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;

const DOCRELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;

const core = t => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>${esc(t)}</dc:title><dc:creator>Pure Paw Nutrition</dc:creator><cp:lastModifiedBy>Qoder</cp:lastModifiedBy>
<dcterms:created xsi:type="dcterms:W3CDTF">2026-11-23T00:00:00Z</dcterms:created>
<dcterms:modified xsi:type="dcterms:W3CDTF">2026-11-23T00:00:00Z</dcterms:modified></cp:coreProperties>`;

const app = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Qoder Office</Application></Properties>`;

if (!fs.existsSync(BUILD)) fs.mkdirSync(BUILD, { recursive: true });
const report = [];
for (const f of fs.readdirSync(SRC).filter(x => x.endsWith('.txt'))) {
  const sku = f.replace('-文字.txt', '');
  const txt = fs.readFileSync(path.join(SRC, f), 'utf8');
  const o = parseSku(txt, sku);
  if (!o.brand.length) o.brand = ['（本版未提取到品牌理念段）'];
  for (const c of o.langs) {
    const at = txt.split(/\r?\n/).findIndex((l, i) => i > 2 && /Kafolatlangan|Гарантированный|Кепілдендірілген|Guaranteed Analysis/i.test(l.trim()));
    c._analysisTitle = at >= 0 ? txt.split(/\r?\n/)[at].trim() : '';
  }
  const body = buildDoc(o);
  const dir = path.join(BUILD, sku);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, '_rels'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'docProps'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'word', '_rels'), { recursive: true });
  fs.writeFileSync(path.join(dir, '[Content_Types].xml'), CT);
  fs.writeFileSync(path.join(dir, '_rels', '.rels'), ROOTRELS);
  fs.writeFileSync(path.join(dir, 'docProps', 'core.xml'), core('Pure Paw Nutrition｜' + sku + ' 包装背面四语数据稿'));
  fs.writeFileSync(path.join(dir, 'docProps', 'app.xml'), app);
  fs.writeFileSync(path.join(dir, 'word', 'document.xml'), docXml(body, sku));
  fs.writeFileSync(path.join(dir, 'word', 'styles.xml'), stylesXml);
  fs.writeFileSync(path.join(dir, 'word', '_rels', 'document.xml.rels'), DOCRELS);
  report.push({ sku, langs: o.langs.length, fields: o.langs.map(c => c.fields.length).join('/'), analysis: o.langs.map(c => c.analysis.length).join('/'), feedRows: o.langs.map(c => c.rows.length + 'x' + (c.ncols || 0)).join(' '), warn: o.warnings.join('；') });
}
console.table ? console.table(report) : report.forEach(r => console.log(JSON.stringify(r)));
