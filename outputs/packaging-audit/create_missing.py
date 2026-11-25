from pathlib import Path
import json,re,copy
from docx import Document
from docx.oxml.ns import qn
b=Path(__file__).parent;src=Path('C:/Users/yinho/Desktop/包装袋');out=b/'补齐Word';out.mkdir(exist_ok=True)
d=json.loads((b/'extracted.json').read_text(encoding='utf8'))
norm=lambda t:re.sub(r'\s+','',t).replace('\0','')
feeding_old=['1-4kg','65-110g','75-135g','4-10kg','110-180g','135-235g','10-25kg','180-320g','235-425g','25-45kg','320-470g','425-635g','45-75kg','470-650g','635-870g']
feeding_new=['2–3kg','30–40g','45–50g','3–4kg','45–55g','55–65g','4–5kg','60–70g','70–80g','5–6kg','75–85g','85–95g','≥6kg','90–100g','100–110g']
for name in ['小犬鸡肉3','小犬牛肉1.5','小犬牛肉3']:
 chicken='鸡肉' in name
 ref='小犬鸡肉1.5' if chicken else '全犬牛肉1.5'
 template=ref+'-文字(1).docx'
 target=d[name]['texts'];source=d[ref]['texts']
 assert len(target)==len(source)
 mapping={norm(a):b.replace('\r','\n') for a,b in zip(source,target) if a.strip()}
 mapping.update(dict(zip(feeding_old,feeding_new)))
 doc=Document(src/template)
 for p in doc.element.body.iter(qn('w:p')):
  ts=list(p.iter(qn('w:t')));text=''.join(t.text or '' for t in ts)
  if norm(text) in mapping:
   # Use spaces at source line breaks to avoid joining words in a reflowed Word paragraph.
   new=mapping[norm(text)].replace('\n',' ')
  elif 'PSD 文字内容提取' in text:new=name+'kg — PSD 文字内容提取'
  elif text.startswith('源文件：'):new=f'源文件：{name}（PSD）　提取到{len(target)}个文本对象，按原稿内容分区整理'
  else:continue
  if ts:
   ts[0].text=new
   for t in ts[1:]:t.text=''
 # Title retains the reference hierarchy, with required black title styling.
 for p in doc.paragraphs:
  if 'PSD 文字内容提取' in p.text:p.style=doc.styles['Title']
 doc.core_properties.title=name+' PSD文字内容提取'
 file=out/(name+'-文字.docx');doc.save(file)
 # Require every source text object, including all feeding cells, to exist in the Word.
 paras=[''.join(t.text or '' for t in p.iter(qn('w:t'))) for p in doc.element.body.iter(qn('w:p'))]
 pool=[norm(t) for t in paras]
 missing=[t for t in target if t.strip() and norm(t) not in pool]
 assert not missing,(name,missing)
 print(file)
