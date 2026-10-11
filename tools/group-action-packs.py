"""Organize shared Actions by rules category, ammunition and weapon training."""
from pathlib import Path
import json,hashlib
root=Path(__file__).resolve().parents[1];out=root/'pack-sources/actions'
def read(p):return json.loads(p.read_text())
def write(p,d):p.write_text(json.dumps(d,indent=2)+'\n')
def uid(path):return hashlib.sha256(('action-category:'+path).encode()).hexdigest()[:16]
def folder(parts):
 parent=None
 for i,name in enumerate(parts):
  path='/'.join(parts[:i+1]);fid=uid(path)
  write(out/f'folder-{fid}.json',{'_id':fid,'name':name,'type':'Item','folder':parent,'sorting':'a','sort':0,'color':None,'flags':{},'_key':'!folders!'+fid});parent=fid
 return parent
uses={}
for setting in ['baseline','medieval','modern','sci-fi','equipment']:
 for p in (root/'pack-sources'/setting).glob('*.json'):
  doc=read(p);s=doc.get('system',{})
  if doc.get('type')=='form':s.setdefault('hands',2);write(p,doc)
  for link in s.get('actionLinks',[]):uses.setdefault(link['uuid'].split('.')[-1],[]).append(doc)
for p in list(out.glob('*.json')):
 if read(p).get('type')=='Item':p.unlink()
for p in out.glob('*.json'):
 doc=read(p)
 if doc.get('type')!='action':continue
 a=doc['system']['action'];sources=uses.get(doc['_id'],[]);paths=set()
 if doc['name'].lower()=='suppress':a.update(mode='test',skill='rangedCombat',requiresFocus=True,trainedOnly=True)
 if a.get('defensiveReaction'):doc['name']='Brace'
 for source in sources:
  s=source.get('system',{})
  if source['type']=='weapon':
   calibre=s.get('ammoType','Melee' if s.get('combatMode')=='melee' else 'Unspecified').replace(' NATO','');family=a.get('focusName') or ('Melee' if s.get('combatMode')=='melee' else 'Ranged')
   paths.add(('Weapons',calibre,family))
  elif source['type']=='form':paths.add(('Forms',))
  else:paths.add(('Items',))
 if a.get('defensiveReaction'):parts=('Forms',)
 elif len(paths)==1:parts=next(iter(paths))
 elif paths and all(path[0]=='Weapons' for path in paths):parts=('Weapons','Shared')
 else:parts=('Items',) if doc['name'].startswith('Throw ') else ('General',)
 doc['folder']=folder(parts);doc.setdefault('flags',{}).setdefault('FUS',{})['categories']=['/'.join(p) for p in sorted(paths)];write(p,doc)
