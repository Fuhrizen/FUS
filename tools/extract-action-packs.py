"""Convert legacy embedded pack actions into stable shared Action documents."""
from pathlib import Path
import json,hashlib
root=Path(__file__).resolve().parents[1]
out=root/'pack-sources'/'actions';out.mkdir(exist_ok=True)
calibres={'M4 Carbine':'5.56','M16A4':'5.56','L85A2':'5.56'}
profiles={}
for setting in ['baseline','medieval','modern','sci-fi']:
 for path in sorted((root/'pack-sources'/setting).glob('*.json')):
  doc=json.loads(path.read_text());system=doc.get('system',{});legacy=system.get('weaponActions',[])
  if not legacy:continue
  links=[]
  for action in legacy:
   data=dict(action);binding_id=data.pop('id');name=data.pop('name');data.pop('focusId',None);data.pop('focusActorUuid',None)
   if doc['name'] in calibres and name in ['Single shot','Aimed shot','Burst fire']:
    calibre=calibres[doc['name']];name={'Single shot':'Fire','Aimed shot':'Aimed Fire','Burst fire':'Burst Fire'}[name]+f' ({calibre})'
    data['description']={'Fire': 'Fire one round. Damage is defined by this shared calibre profile.', 'Aimed': 'Spend two actions aiming and firing one round. The +1 roll modifier is included.', 'Burst': 'Fire a three-round burst with one attack roll. The damage bonus is included.'}[name.split()[0]]
    data['skill']='rangedCombat';data['focusName']='Rifles'
   signature=json.dumps({'name':name,'action':data},sort_keys=True)
   aid='fusUnarmedStrike' if name=='Unarmed Strike' else hashlib.sha256(signature.encode()).hexdigest()[:16]
   profiles[aid]={'_id':aid,'name':name,'type':'action','img':'icons/svg/dice-target.svg','system':{'action':data},'effects':[],'folder':None,'sort':0,'flags':{},'ownership':{'default':2},'_key':f'!items!{aid}'}
   links.append({'id':binding_id,'uuid':f'Compendium.FUS.actions.Item.{aid}','focusId':'','focusActorUuid':'','focusName':''})
  system['actionLinks']=links;system['weaponActions']=[]
  if doc['name']=='Baseline':system['maxhp']=6
  path.write_text(json.dumps(doc,indent=2)+'\n')
for aid,doc in profiles.items():(out/f'{aid}.json').write_text(json.dumps(doc,indent=2)+'\n')
print(f'Extracted {len(profiles)} reusable Action definitions')
