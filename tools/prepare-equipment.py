"""Generate setting-independent equipment and wire starter ammunition and icons."""
from pathlib import Path
import json,hashlib
root=Path(__file__).resolve().parents[1]
def read(p):return json.loads(p.read_text())
def write(p,d):p.write_text(json.dumps(d,indent=2)+'\n')
def stable(s):return hashlib.sha256(s.encode()).hexdigest()[:16]
def icon(name):
 n=name.lower()
 for words,key in [(['reload','recharge'],'reload'),(['aim'],'aim'),(['suppress'],'suppress'),(['burst','grenade','molotov'],'burst'),(['shot','fire'],'fire'),(['thrust'],'thrust'),(['heavy','crush','servo'],'heavy'),(['strike','swing'],'strike'),(['brace','defensive','dodge'],'brace'),(['scan','status'],'scan'),(['interface'],'interface'),(['psychic','empathic','pulse'],'psychic')]:
  if any(w in n for w in words):return f'systems/FUS/assets/actions/{key}.svg'
 return 'systems/FUS/assets/action.svg'
for p in (root/'pack-sources/actions').glob('*.json'):
 d=read(p)
 if d.get('type')=='action':
  d['img']=icon(d['name'])
  if d['name'] in ['Reload','Recharge']:d['system']['action']['description']='Reload as many compatible rounds as available, up to capacity; charges reset to maximum. With ammunition tracking enabled, compatible supplies are required and consumed for weapons with a configured ammo type.'
  write(p,d)
profiles={
 'Javelin':'Javelins','Throwing Knife':'Throwing Knives','Shortbow':'Arrows','Longbow':'Arrows','Light Crossbow':'Bolts','Heavy Crossbow':'Bolts','Sling':'Sling Stones',
 'M4 Carbine':'5.56 NATO','M16A4':'5.56 NATO','L85A2':'5.56 NATO','M249 SAW':'5.56 NATO','AK-47':'7.62×39','FN SCAR-H':'7.62 NATO','Remington 700':'7.62 NATO','Barrett M82':'.50 BMG','Glock 17':'9×19','Beretta 92':'9×19','MP5':'9×19','Uzi':'9×19','M1911':'.45 ACP','Magnum Revolver':'.357 Magnum','Mossberg 500':'12 gauge','Benelli M4':'12 gauge','Taser':'Taser Cartridges','Flare Pistol':'Flares',
 'Gauss Rifle':'Gauss Rounds','Rail Sniper':'Rail Slugs','Toxin Dart Pistol':'Toxin Darts','Pulse Rifle':'Pulse Charges','Pulse Support Gun':'Pulse Charges','Plasma Rifle':'Plasma Charges','Heavy Laser Pistol':'Laser Charges','Laser Pistol':'Laser Charges','Laser Carbine':'Laser Charges','Sonic Carbine':'Sonic Charges','Energy Scattergun':'Scatter Charges','Radiation Projector':'Radiation Charges','Psi Focus Emitter':'Psi Charges','Disruptor Pistol':'Disruptor Charges'
}
for setting in ['medieval','modern','sci-fi']:
 for p in (root/'pack-sources'/setting).glob('*.json'):
  d=read(p)
  if d.get('type')=='weapon' and d['system']['combatMode']=='ranged':
   if d['name'] not in profiles:raise ValueError('Missing ammo mapping: '+d['name'])
   d['system']['ammoType']=profiles[d['name']]
  if 'Rations (3 days)' in d['name']:d['name']=d['name'].replace('(3 days)','(1 day)');d['system']['description']='One day of food for one character. Each inventory unit represents one day.'
  write(p,d)
out=root/'pack-sources/equipment';out.mkdir(exist_ok=True)
folders={name:stable('equipment:'+name) for name in ['Tools','Supplies','Ammunition']}
for name,id in folders.items():write(out/('folder-'+name.lower()+'.json'),{'_id':id,'name':name,'type':'Item','folder':None,'sorting':'a','sort':0,'color':None,'flags':{},'_key':'!folders!'+id})
def item(name,description,folder,quantity=1,ammo='',img='icons/svg/item-bag.svg'):
 id=stable('universal:'+name);d={'_id':id,'name':name,'type':'item','img':img,'system':{'quantity':quantity,'description':description,'ammoType':ammo,'weaponActions':[],'actionLinks':[]},'effects':[],'folder':folders[folder],'sort':0,'flags':{'FUS':{'universalEquipment':1}},'ownership':{'default':2},'_key':'!items!'+id};write(out/(id+'.json'),d)
for name,description in [
 ('Tool Kit','General-purpose tools for Craft tasks. Parts and suitable training may still be required.'),('Repair Supplies','Five uses for ordinary equipment repairs. Tests and repair results are adjudicated normally.'),('Medical Supplies','Ten treatment uses for Medicine. Does not automatically restore HP.'),('Lockpicks','Fine tools for lock work; access and a suitable test are required.'),('Rope (50 ft)','50 ft of rope for climbing, hauling or restraint. Anchors and tests are required.'),('Grappling Hook','A reusable hook for rope, with a suitable anchor.'),('Compass','A simple directional navigation tool.'),('Shovel','A general digging tool.'),('Pickaxe','A general excavation tool.'),('Pry Bar','Leverage for opening and moving objects; tests still apply.'),('Hammer','A reusable tool for construction or repair.'),('Waterskin','One day of drinking water in ordinary conditions.'),('Bedroll','Portable bedding. Shelter may still be needed.'),('Backpack','An ordinary pack for carrying equipment.'),('Tent','Portable shelter for two people.'),('Chalk','Ten pieces for marking trails, surfaces or diagrams.'),('Lantern','A portable light source. Fuel and lighting are managed separately.'),('Torch','One portable torch, lasting one scene under ordinary conditions.'),('Flint and Steel','Start a fire with dry tinder, suitable conditions and time.')]:item(name,description,'Tools')
item('Rations (1 day)','One day of food for one character. Quantity counts days.','Supplies',img='icons/svg/food.svg')
for ammo in sorted(set(profiles.values())):
 quantity=5 if ammo in ['Javelins','Throwing Knives'] else 20 if ammo in ['Arrows','Bolts','Sling Stones','Taser Cartridges','Flares'] else 60
 item(ammo+' Ammunition',f'Compatible ammunition: {ammo}. Each quantity unit is one round, projectile or charge. Reloading consumes only the amount needed to refill the weapon.','Ammunition',quantity,ammo,img='systems/FUS/assets/actions/reload.svg')
# Explicit compatibility for existing setting supplies; quantities now count rounds/charges.
for setting,mapping in {'modern':{'Pistol Magazine':('9×19',15),'Rifle Magazine':('5.56 NATO',30),'Shotgun Shell Box':('12 gauge',10)},'sci-fi':{'Gauss Magazine':('Gauss Rounds',20),'Universal Power Cell':('Laser Charges',30)}}.items():
 for p in (root/'pack-sources'/setting).glob('*.json'):
  d=read(p)
  if d['name'] not in mapping:continue
  ammo,count=mapping[d['name']];d['system']['ammoType']=ammo;d['system']['quantity']=count;d['system']['description']=f'Compatible ammunition: {ammo}. Quantity counts individual rounds or charges; reload consumes only those needed to refill a compatible weapon.';write(p,d)
(root/'scripts/starter-ammo.mjs').write_text('export const STARTER_AMMO='+json.dumps(profiles,indent=2)+';\n'+'''export async function migrateStarterAmmo(){
 if(!game.user.isGM||game.users?.activeGM&&game.users.activeGM.id!==game.user.id)return;
 const actors=[...game.actors,...game.scenes.contents.flatMap(s=>s.tokens.contents.filter(t=>!t.actorLink).map(t=>t.actor).filter(Boolean))];
 for(const item of [...game.items,...actors.flatMap(a=>a.items.contents)]){
  if(item.flags?.FUS?.balanceHP!==6)continue;
  const supplies={'Pistol Magazine':['9×19',15],'Rifle Magazine':['5.56 NATO',30],'Shotgun Shell Box':['12 gauge',10],'Gauss Magazine':['Gauss Rounds',20],'Universal Power Cell':['Laser Charges',30]};
  if(item.type==='item'&&!item.system.ammoType&&supplies[item.name]){const [ammo,units]=supplies[item.name];await item.update({'system.ammoType':ammo,'system.quantity':Number(item.system.quantity??1)*units,'system.description':`Compatible ammunition: ${ammo}. Quantity counts individual rounds or charges.`});}
  if(item.type==='weapon'&&!item.system.ammoType&&STARTER_AMMO[item.name])await item.update({'system.ammoType':STARTER_AMMO[item.name]});
  if(item.type==='item'&&item.name.includes('Rations (3 days)'))await item.update({name:item.name.replace('(3 days)','(1 day)'),'system.description':'One day of food for one character. Quantity counts days.'});
 }
}
''')
