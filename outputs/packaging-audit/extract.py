from pathlib import Path
import re,json,struct,zipfile,xml.etree.ElementTree as ET
from PIL import Image
src=Path('C:/Users/yinho/Desktop/包装袋');out=Path(__file__).parent
data={}
for f in src.iterdir():
 if f.suffix=='.docx':
  with zipfile.ZipFile(f) as z:
   root=ET.fromstring(z.read('word/document.xml'))
   ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
   lines=[''.join(p.itertext()) for p in []]
   lines=[''.join(t.text or '' for t in p.findall('.//w:t',ns)) for p in root.findall('.//w:p',ns)]
  data[f.name]={'type':'word','lines':lines}
 else:
  b=f.read_bytes();texts=[]
  for m in re.finditer(b'Txt TEXT',b):
   n=struct.unpack('>I',b[m.end():m.end()+4])[0]
   if n<100000:
    texts.append(b[m.end()+4:m.end()+4+n*2].decode('utf-16-be','replace').rstrip('\0'))
  data[f.name]={'type':'psd','texts':texts,'matches':len(texts)}
  try:
   im=Image.open(f);im.thumbnail((1600,2400));im.convert('RGB').save(out/(f.name+'.jpg'))
  except Exception as e:data[f.name]['image_error']=str(e)
(out/'extracted.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf8')
for name,d in data.items():print(name,d['type'],len(d.get('texts',d.get('lines',[]))))
