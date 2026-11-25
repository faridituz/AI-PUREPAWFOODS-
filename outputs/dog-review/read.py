from pathlib import Path
from docx import Document
from docx.oxml.ns import qn
import json
b=Path(__file__).parent;d={}
for f in Path('C:/Users/yinho/Desktop/包装袋/狗').glob('*.docx'):
 doc=Document(f);lines=[]
 for p in doc.element.body.iter(qn('w:p')):
  t=''.join((e.text or '') if e.tag==qn('w:t') else '\n' if e.tag==qn('w:br') else '' for e in p.iter())
  if t.strip():lines.append(t)
 d[f.name]=lines
(b/'texts.json').write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf8')
for n,ls in d.items():
 print('\n###',n)
 for i,t in enumerate(ls):
  if any(k in t.lower() for k in ['cat','mushuk','мысық','dog','собак','itlar','it ov','иттер','корма','≥0.9','≥6kg','kg','гӯшти']):print(i,t.replace('\n',' / '))
print('\nFULL FIRST\n'+'\n'.join(next(iter(d.values()))))
