"""Reproducible baseline reaction and setting-independent area consumables."""
from pathlib import Path
import json,hashlib,re
root=Path(__file__).resolve().parents[1]
def write(path,doc):path.write_text(json.dumps(doc,indent=2)+'\n')
def uid(text):return hashlib.sha256(text.encode()).hexdigest()[:16]
folder=uid('actions:universal')
reaction={'_id':'fusDefensiveReac','name':'Defensive Reaction','type':'action','img':'systems/FUS/assets/actions/brace.svg','system':{'action':{'cost':1,'mode':'none','skill':'meleeCombat','targetMode':'self','damage':False,'defensiveReaction':True,'description':'React defensively until the round ends. Gain one cover stage, capped at Hard Cover. Against melee attacks, dodge instead (+2 DC). Does not stack with itself.'}},'effects':[],'folder':folder,'sort':0,'flags':{'FUS':{'setting':'universal'}},'ownership':{'default':2},'_key':'!items!fusDefensiveReac'}
write(root/'pack-sources/actions/fusDefensiveReac.json',reaction)
p=root/'pack-sources/baseline/standard-human.json';doc=json.loads(p.read_text());links=doc['system']['actionLinks']
if not any(l['id']=='defensiveReaction' for l in links):links.append({'id':'defensiveReaction','uuid':'Compendium.FUS.actions.Item.fusDefensiveReac','focusId':'','focusName':'','focusActorUuid':''})
write(p,doc)
for name,damage,size in [('Grenade',[{'type':'bludgeoning','formula':'2d6'}],10),('Molotov',[{'type':'heat','formula':'1d6'}],5)]:
 aid=uid('area-action:'+name);action={'_id':aid,'name':'Throw '+name,'type':'action','img':'systems/FUS/assets/actions/burst.svg','system':{'action':{'cost':1,'mode':'none','skill':'rangedCombat','targetMode':'area','areaShape':'circle','areaSize':size,'rangeOptimal':15,'rangeMaximum':30,'consumeSource':True,'damage':True,'damageComponents':damage,'description':'Place the blast freely on the map. Roll damage for affected visible tokens; a native measured template remains on the scene. Lasting fire effects are adjudicated separately.'}},'effects':[],'folder':folder,'sort':0,'flags':{'FUS':{'setting':'universal'}},'ownership':{'default':2},'_key':'!items!'+aid};write(root/f'pack-sources/actions/{aid}.json',action)
 iid=uid('universal:'+name);item={'_id':iid,'name':name,'type':'item','img':action['img'],'system':{'quantity':1,'description':f'One {name.lower()}. Uses a shared free-placement area action.','weaponActions':[],'actionLinks':[{'id':'throw','uuid':'Compendium.FUS.actions.Item.'+aid,'focusId':'','focusName':'','focusActorUuid':''}]},'effects':[],'folder':uid('equipment:Supplies'),'sort':0,'flags':{'FUS':{'universalEquipment':1}},'ownership':{'default':2},'_key':'!items!'+iid};write(root/f'pack-sources/equipment/{iid}.json',item)
# Rulebook martial actions are opposed tests; the GM resolves restraint after comparing rolls.
martial=[('fusMartialGrappl','Grapple','test','athletics','required',1,'Spend 1 action and roll Athletics plus a relevant Focus, opposed by the target’s better Athletics or Acrobatics plus relevant Focus. The winner restrains the target until release or escape. The current state wins ties. Counts as an attack for repeated-attack penalties.'),('fusMartialEscape','Escape Grapple','test','athletics','none',0,'Spend 1 action and repeat the opposed grapple test. You may use your better Athletics or Acrobatics plus a relevant Focus. Choose the appropriate skill in the action editor or roll it from your sheet. The current state wins ties. On success the GM removes Restrained.'),('fusMartialReleas','Release Grapple','none','','none',0,'Release a creature you are restraining. The GM removes Restrained when the hold ends.'),('fusMartialIntera','Interact','none','','none',1,'Draw, stow, pick up or manipulate an object. Usually costs 1 action; complex interactions may take more. Update the item’s carry state on the inventory sheet.')]
for aid,name,mode,skill,target,free,description in martial:
 action={'_id':aid,'name':name,'type':'action','img':'systems/FUS/assets/actions/strike.svg' if mode=='test' else 'systems/FUS/assets/actions/brace.svg','system':{'action':{'cost':1,'mode':mode,'skill':skill,'targetMode':target,'freeHands':free,'rangeOptimal':5 if target=='required' else 0,'rangeMaximum':5 if target=='required' else 0,'damage':False,'description':description}},'effects':[],'folder':folder,'sort':0,'flags':{'FUS':{'setting':'universal'}},'ownership':{'default':2},'_key':'!items!'+aid}
 write(root/f'pack-sources/actions/{aid}.json',action)
 if not any(l['id']==aid for l in links):links.append({'id':aid,'uuid':'Compendium.FUS.actions.Item.'+aid,'focusId':'','focusName':'','focusActorUuid':''})
write(p,doc)
# Two-handed starter profiles; imported copies can be configured individually.
for directory in ['medieval','modern','sci-fi']:
 for path in (root/'pack-sources'/directory).glob('*.json'):
  weapon=json.loads(path.read_text())
  if weapon.get('type')!='weapon':continue
  name=weapon['name'].lower();system=weapon['system'];system['handsRequired']=2 if re.search(r'two[ -]hand(?:ed|s)?(?! recommended)',system.get('description',''),re.I) else 1
  system['carryState']='stowed';system['handsHeld']=0;write(path,weapon)
