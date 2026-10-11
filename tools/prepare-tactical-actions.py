"""Reproducible baseline reaction and setting-independent area consumables."""
from pathlib import Path
import json,hashlib,re
root=Path(__file__).resolve().parents[1]
def write(path,doc):path.write_text(json.dumps(doc,indent=2)+'\n')
def uid(text):return hashlib.sha256(text.encode()).hexdigest()[:16]
folder=uid('actions:universal')
reaction={'_id':'fusDefensiveReac','name':'Brace','type':'action','img':'systems/FUS/assets/actions/brace.svg','system':{'action':{'cost':1,'mode':'none','skill':'meleeCombat','targetMode':'self','damage':False,'defensiveReaction':True,'description':'React defensively until the round ends. Gain one cover stage, capped at Hard Cover. Against melee attacks, dodge instead (+2 DC). Does not stack with itself.'}},'effects':[],'folder':folder,'sort':0,'flags':{'FUS':{'setting':'universal'}},'ownership':{'default':2},'_key':'!items!fusDefensiveReac'}
write(root/'pack-sources/actions/fusDefensiveReac.json',reaction)
p=root/'pack-sources/baseline/standard-human.json';doc=json.loads(p.read_text());links=doc['system']['actionLinks']
if not any(l['id']=='defensiveReaction' for l in links):links.append({'id':'defensiveReaction','uuid':'Compendium.FUS.actions.Item.fusDefensiveReac','focusId':'','focusName':'','focusActorUuid':''})
write(p,doc)
for name,damage,size in [('Grenade',[{'type':'bludgeoning','formula':'2d6'}],10),('Molotov',[{'type':'heat','formula':'1d6'}],5)]:
 aid=uid('area-action:'+name);action={'_id':aid,'name':'Throw '+name,'type':'action','img':'systems/FUS/assets/actions/burst.svg','system':{'action':{'cost':1,'mode':'none','skill':'rangedCombat','targetMode':'area','areaShape':'circle','areaSize':size,'rangeOptimal':15,'rangeMaximum':30,'consumeSource':True,'damage':True,'damageComponents':damage,'description':'Place the blast freely on the map. Roll damage for affected visible tokens; a native measured template remains on the scene. Lasting fire effects are adjudicated separately.'}},'effects':[],'folder':folder,'sort':0,'flags':{'FUS':{'setting':'universal'}},'ownership':{'default':2},'_key':'!items!'+aid};write(root/f'pack-sources/actions/{aid}.json',action)
 iid=uid('universal:'+name);item={'_id':iid,'name':name,'type':'item','img':action['img'],'system':{'quantity':1,'description':f'One {name.lower()}. Uses a shared free-placement area action.','weaponActions':[],'actionLinks':[{'id':'throw','uuid':'Compendium.FUS.actions.Item.'+aid,'focusId':'','focusName':'','focusActorUuid':''}]},'effects':[],'folder':uid('equipment:Supplies'),'sort':0,'flags':{'FUS':{'universalEquipment':1}},'ownership':{'default':2},'_key':'!items!'+iid};write(root/f'pack-sources/equipment/{iid}.json',item)
# Removed starter martial actions; preserve other custom links.
removed={'fusMartialGrappl','fusMartialEscape','fusMartialReleas','fusMartialIntera'}
links[:]=[l for l in links if l['uuid'].split('.')[-1] not in removed]
for aid in removed:(root/f'pack-sources/actions/{aid}.json').unlink(missing_ok=True)
write(p,doc)
# Two-handed starter profiles; imported copies can be configured individually.
for directory in ['medieval','modern','sci-fi']:
 for path in (root/'pack-sources'/directory).glob('*.json'):
  weapon=json.loads(path.read_text())
  if weapon.get('type')!='weapon':continue
  name=weapon['name'].lower();system=weapon['system'];system['handsRequired']=2 if re.search(r'two[ -]hand(?:ed|s)?(?! recommended)',system.get('description',''),re.I) else 1
  system['carryState']='stowed';system['handsHeld']=0;write(path,weapon)
