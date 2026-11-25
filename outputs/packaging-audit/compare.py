import json,re,difflib,collections
from pathlib import Path
b=Path(__file__).parent;d=json.loads((b/'extracted.json').read_text(encoding='utf8'))
def norm(t):return re.sub(r'\s+','',t).replace('\x00','')
out=[]
for name,v in d.items():
 if v['type']!='word':continue
 key=name.split('-文字')[0];p=d.get(key)
 if not p:out.append({'word':name,'psd':None});continue
 words=[t for t in v['lines'] if t and not re.search('[\u4e00-\u9fff]',t)]
 ps=[t for t in p['texts'] if t.strip()]
 wc=collections.Counter(map(norm,words));pc=collections.Counter(map(norm,ps))
 missing=list((wc-pc).elements());extra=list((pc-wc).elements())
 out.append({'word':name,'psd':key,'word_only':missing,'psd_only':extra})
(b/'comparison.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf8')
for r in out:
 print('\n###',r['word'],r['psd'])
 if r['psd']:
  print('WORD ONLY:',r['word_only']);print('PSD ONLY:',r['psd_only'])
print('\nUNPAIRED PSD',[n for n,v in d.items() if v['type']=='psd' and not any(r['psd']==n for r in out)])
