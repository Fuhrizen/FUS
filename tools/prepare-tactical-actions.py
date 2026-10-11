"""Reproducible baseline reaction and setting-independent area consumables."""
from pathlib import Path
import json,hashlib
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
