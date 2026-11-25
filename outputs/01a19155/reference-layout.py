from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
import xml.etree.ElementTree as E
b=Path(__file__).parent
src=b/'狗粮7日换粮及每日饲喂指南_全部可编辑.xlsx'
dst=b/'狗粮7日换粮及每日饲喂指南_原图位置版.xlsx'
x='http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing'
a='http://schemas.openxmlformats.org/drawingml/2006/main'
E.register_namespace('xdr',x);E.register_namespace('a',a)
def add(p,ns,n,**kw):return E.SubElement(p,'{'+ns+'}'+n,kw)
with ZipFile(src) as z:
 name=next(n for n in z.namelist() if n.startswith('xl/drawings/drawing') and n.endswith('.xml'))
 old=E.fromstring(z.read(name))
 root=E.Element('{'+x+'}wsDr')
 anchor=add(root,x,'twoCellAnchor',editAs='absolute')
 for tag,col,row in [('from',0,3),('to',3,9)]:
  p=add(anchor,x,tag)
  for k,v in [('col',col),('colOff',0),('row',row),('rowOff',119063 if tag=='to' else 0)]:add(p,x,k).text=str(v)
 grp=add(anchor,x,'grpSp')
 nv=add(grp,x,'nvGrpSpPr');add(nv,x,'cNvPr',id='100',name='7日换粮方法-整体组合');add(nv,x,'cNvGrpSpPr')
 prop=add(grp,x,'grpSpPr');tr=add(prop,a,'xfrm')
 add(tr,a,'off',x='0',y=str(128*9525));add(tr,a,'ext',cx=str(400*9525),cy=str(int(316.5*9525)))
 add(tr,a,'chOff',x='0',y='0');add(tr,a,'chExt',cx=str(527*9525),cy=str(417*9525))
 for index,an in enumerate(old):
  sp=an.find('{'+x+'}sp')
  if sp is None:continue
  off=sp.find('.//{'+a+'}xfrm/{'+a+'}off')
  quadrant=index//4;part=index%4
  dx=271 if quadrant%2 else 0;dy=203 if quadrant//2 else 0
  coords=[(53,49,132,68),(67,38,106,30),(69,40,51,26),(29,123,180,76)]
  px,py,pw,ph=coords[part]
  off.set('x',str((px+dx)*9525));off.set('y',str((py+dy)*9525))
  ext=sp.find('.//{'+a+'}xfrm/{'+a+'}ext')
  ext.set('cx',str(pw*9525));ext.set('cy',str(ph*9525))
  for rp in sp.findall('.//{'+a+'}rPr'):rp.set('sz','2100')
  grp.append(sp)
 add(anchor,x,'clientData')
 xml=E.tostring(root,encoding='utf-8',xml_declaration=True)
 with ZipFile(dst,'w',ZIP_DEFLATED) as out:
  for i in z.infolist():out.writestr(i,xml if i.filename==name else z.read(i.filename))
with ZipFile(dst) as z:
 r=E.fromstring(z.read(name))
 assert len(r)==1 and len(r.findall('.//{'+x+'}sp'))==16
 # Every child uses the same group coordinate system; all bounding boxes remain inside it.
 for sp in r.findall('.//{'+x+'}sp'):
  tr=sp.find('{'+x+'}spPr/{'+a+'}xfrm');off=tr.find('{'+a+'}off');ext=tr.find('{'+a+'}ext')
  assert 0<=int(off.get('x')) and 0<=int(off.get('y'))
  assert int(off.get('x'))+int(ext.get('cx'))<=527*9525
  assert int(off.get('y'))+int(ext.get('cy'))<=417*9525
print(dst)
