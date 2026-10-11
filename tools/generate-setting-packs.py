"""Generate editable FUS starter content. Values are game abstractions for 6 HP."""
from pathlib import Path
import hashlib,json,re
ROOT=Path(__file__).resolve().parents[1]
def uid(key):return hashlib.sha256(key.encode()).hexdigest()[:16]
def component(kind,value):return {'type':kind,'formula':str(value)}
def action(name='Attack',cost=1,mode='test',focus='',damage=None,spend=0,target='required',rules='',modifier=0,required=False,reset=False,skill=''):
 return dict(id=uid('action:'+name),name=name,cost=cost,mode=mode,targetMode=target,skill=skill,focusId='',focusName=focus,focusActorUuid='',requiresFocus=required,modifier=modifier,damage=bool(damage),damageComponents=damage or [],adjustResource=bool(spend or reset),resourceMode='reset' if reset else 'adjust',resourceAmount=-spend if spend else 0,description=rules)
def build(setting,weapon_rows,armour_rows,item_rows,forms=()):
 dest=ROOT/'pack-sources'/setting;dest.mkdir(parents=True,exist_ok=True)
 for p in dest.glob('*.json'):p.unlink()
 documents=[];folders={}
 for i,name in enumerate(['Weapons','Armour','Items']+(['Forms'] if forms else [])):
  key=uid(setting+':folder:'+name);folders[name]=key
  documents.append({'_id':key,'name':name,'type':'Item','folder':None,'sorting':'a','sort':i*100000,'color':{'Weapons':'#9d493d','Armour':'#426784','Items':'#887847','Forms':'#6b5e91'}[name],'flags':{},'_key':'!folders!'+key})
 def add(name,kind,system,folder):
  key=uid(setting+':'+kind+':'+name)
  documents.append({'_id':key,'name':name,'type':kind,'img':{'weapon':'icons/svg/sword.svg' if system.get('combatMode')=='melee' else 'icons/svg/target.svg','armour':'icons/svg/shield.svg','item':'icons/svg/item-bag.svg','form':'icons/svg/mystery-man.svg'}[kind],'system':system,'effects':[],'folder':folders[folder],'sort':len(documents)*100000,'flags':{'FUS':{'starterSetting':setting,'balanceHP':6}},'ownership':{'default':0},'_key':'!items!'+key})
 for name,mode,damage,optimal,maximum,ammo,focus,style,notes in weapon_rows:
  components=[component(t,v) for t,v in damage]
  rules='One attack roll; damage is rolled separately. '+notes
  actions=[action('Strike' if mode=='melee' else 'Single shot',focus=focus,damage=components,spend=1 if ammo else 0,rules=rules)]
  if style in ['blade','polearm']:
   actions.append(action('Thrust',focus=focus,damage=[component('piercing',max(v for _,v in damage))],rules='Use the point instead of the edge. '+notes))
  if style=='heavy':
   heavy=[component(t,v+1 if i==0 else v) for i,(t,v) in enumerate(damage)]
   actions.append(action('Heavy swing',cost=2,focus=focus,damage=heavy,required=True,rules='Two hands. Requires the named Focus; damage bonus is already included.'))
  if style in ['rifle','auto','precision','bow','crossbow','laser']:
   actions.append(action('Aimed shot',cost=2,focus=focus,damage=components,spend=1 if ammo else 0,modifier=1,required=True,rules='Take time to line up one shot. Starter variant: +1 to the roll is already configured; no automatic DC or cover adjustment.'))
  if style in ['auto']:
   actions.append(action('Burst fire',cost=2,focus=focus,damage=[component(t,v+1 if i==0 else v) for i,(t,v) in enumerate(damage)],spend=3,rules='Spend three rounds for one attack against one target. Starter variant: +1 damage is included; do not roll three attacks.'))
   actions.append(action('Suppress',cost=2,focus=focus,spend=10,rules='Spend ten rounds; nominate a 20-ft area and target the affected tokens. Post the roll without damage. GM resolves suppression and cover manually.'))
  if style=='shotgun':
   actions.append(action('Close shot',focus=focus,damage=[component(t,v+1 if i==0 else v) for i,(t,v) in enumerate(damage)],spend=1,required=True,rules='Target within 10 ft. Once per turn; +1 to the first damage component is included. Range and frequency are checked manually.'))
  if ammo:
   actions.append(action('Reload' if mode=='ranged' else 'Recharge',mode='none',target='self',reset=True,rules='Requires a spare magazine, ammunition or suitable power source. Restore the counter to maximum; track supplies manually.'))
  add(name,'weapon',dict(quantity=1,description='6-HP starter profile; ranges are game distances in feet, not real-world specifications. '+notes,combatMode=mode,optimal=optimal,maximum=maximum,resourceCurrent=ammo,resourceMax=ammo,weaponActions=actions),'Weapons')
 for name,resist,speed,hp,notes,weak in armour_rows:
  adjustments=[dict(component(t,v),kind='resistance') for t,v in resist]+[dict(component(t,v),kind='weakness') for t,v in weak]
  add(name,'armour',dict(quantity=1,equipped=False,healthBonus=hp,speedBonus=speed,adjustments=adjustments,description='6-HP starter profile. '+notes+' Equip one body-armour profile at a time; the sheet stacks all equipped pieces, so manage overlapping layers manually.'),'Armour')
 for name,notes in item_rows:add(name,'item',dict(quantity=1,description=notes+' Quantity, supplies and effects are managed manually.'),'Items')
 for name,hp,move,description,actions in forms:
  add(name,'form',dict(maxhp=hp,move=move,description=description,rules='6-HP campaign starter Form. Printed action effects are adjudicated manually; no automatic healing, conditions or DC checks.',weaponActions=actions),'Forms')
 for document in documents:
  slug=re.sub(r'[^a-z0-9]+','-',document['name'].lower()).strip('-')
  (dest/(slug+'.json')).write_text(json.dumps(document,indent=2)+'\n')
 return {kind:sum(d.get('type')==kind and d['_key'].startswith('!items!') for d in documents) for kind in ['weapon','armour','item','form']}
# name, combat mode, typed damage, optimal, max, capacity, Focus, action family, handling
medieval=[
('Dagger','melee',[('cutting',1)],5,5,0,'Blades','blade','Concealable; one hand.'),
('Shortsword','melee',[('cutting',1)],5,5,0,'Blades','blade','One hand; compact sidearm.'),
('Longsword','melee',[('cutting',2)],5,5,0,'Blades','blade','Two hands for this damage profile.'),
('Claymore','melee',[('cutting',2)],5,5,0,'Heavy Weapons','heavy','Two hands; forceful.'),
('Rapier','melee',[('piercing',1)],5,5,0,'Blades','plain','One hand; narrow thrusting blade.'),
('Falchion','melee',[('cutting',2)],5,5,0,'Blades','plain','One hand; broad chopping blade.'),
('Hand Axe','melee',[('cutting',1)],5,5,0,'Axes','plain','One hand; doubles as a chopping tool.'),
('Battleaxe','melee',[('cutting',2)],5,5,0,'Axes','heavy','Two hands; forceful.'),
('Mace','melee',[('bludgeoning',2)],5,5,0,'Blunt Weapons','plain','One hand; solid striking head.'),
('Warhammer','melee',[('bludgeoning',2)],5,5,0,'Blunt Weapons','heavy','Two hands; forceful.'),
('Quarterstaff','melee',[('bludgeoning',1)],5,5,0,'Staves','plain','Two hands; walking staff.'),
('Spear','melee',[('piercing',1)],10,10,0,'Polearms','plain','Two hands; 10-ft reach.'),
('Halberd','melee',[('cutting',2)],10,10,0,'Polearms','polearm','Two hands; hook, point and axe head.'),
('Pike','melee',[('piercing',2)],15,15,0,'Polearms','plain','Two hands; awkward in confined spaces.'),
('Lance','melee',[('piercing',2)],10,10,0,'Polearms','plain','Designed for mounted use; no automatic charge bonus.'),
('Shortbow','ranged',[('piercing',1)],60,180,1,'Bows','bow','Two hands. Reload represents nocking an arrow.'),
('Longbow','ranged',[('piercing',2)],120,360,1,'Bows','bow','Two hands. Reload represents nocking an arrow.'),
('Light Crossbow','ranged',[('piercing',2)],90,270,1,'Crossbows','crossbow','Two hands; reload between shots.'),
('Heavy Crossbow','ranged',[('piercing',3)],120,360,1,'Crossbows','crossbow','Two hands; slow, at most one shot per turn.'),
('Sling','ranged',[('bludgeoning',1)],40,120,1,'Slings','plain','Requires a stone or sling bullet for each reload.'),
('Throwing Knife','ranged',[('piercing',1)],15,45,1,'Thrown Weapons','plain','One hand; reload requires another knife or recovery.'),
('Javelin','ranged',[('piercing',2)],30,90,1,'Thrown Weapons','plain','One hand; reload requires another javelin or recovery.')]
modern=[
('Combat Knife','melee',[('cutting',1)],5,5,0,'Blades','blade','One hand; concealable.'),
('Police Baton','melee',[('bludgeoning',1)],5,5,0,'Blunt Weapons','plain','One hand. Nonlethal intent does not automatically prevent injury.'),
('Fire Axe','melee',[('cutting',2)],5,5,0,'Axes','heavy','Two hands; breaching tool.'),
('Glock 17','ranged',[('piercing',1)],30,90,17,'Sidearms','plain','One hand; compact 9mm service pistol.'),
('M1911','ranged',[('piercing',2)],30,90,7,'Sidearms','plain','One hand; heavy sidearm. Repeated attack penalties are handled manually.'),
('Beretta 92','ranged',[('piercing',1)],40,100,15,'Sidearms','plain','One hand; service pistol.'),
('Magnum Revolver','ranged',[('piercing',2)],40,100,6,'Sidearms','plain','One hand; strong recoil.'),
('MP5','ranged',[('piercing',1)],50,150,30,'Submachine Guns','auto','Two hands; compact automatic weapon.'),
('Uzi','ranged',[('piercing',1)],40,120,25,'Submachine Guns','auto','Two hands; compact automatic weapon.'),
('M4 Carbine','ranged',[('piercing',2)],90,300,30,'Rifles','auto','Two hands; carbine.'),
('M16A4','ranged',[('piercing',2)],120,360,30,'Rifles','rifle','Two hands; service rifle. Burst profile is listed separately.'),
('AK-47','ranged',[('piercing',2)],90,300,30,'Rifles','auto','Two hands; assault rifle.'),
('L85A2','ranged',[('piercing',2)],100,330,30,'Rifles','auto','Two hands; bullpup service rifle.'),
('FN SCAR-H','ranged',[('piercing',3)],120,360,20,'Rifles','rifle','Two hands; battle rifle with strong recoil.'),
('Remington 700','ranged',[('piercing',2)],180,600,5,'Sniper Rifles','precision','Two hands; scoped, slow, at most one shot per turn.'),
('Barrett M82','ranged',[('piercing',3)],180,600,10,'Sniper Rifles','precision','Two hands; heavy, scoped; ready carry reduces Move by 5 ft manually.'),
('Mossberg 500','ranged',[('piercing',1),('bludgeoning',1)],25,80,6,'Shotguns','shotgun','Two hands; buckshot components resolve separately.'),
('Benelli M4','ranged',[('piercing',1),('bludgeoning',1)],30,90,7,'Shotguns','shotgun','Two hands; combat shotgun.'),
('M249 SAW','ranged',[('piercing',2)],120,450,100,'Light Machine Guns','auto','Two hands; heavy. Ready carry reduces Move by 5 ft manually.'),
('Taser','ranged',[('electrical',1)],10,25,1,'Sidearms','plain','Two hands recommended; incapacitation is adjudicated manually.'),
('Flare Pistol','ranged',[('heat',1)],30,90,1,'Sidearms','plain','Signal device; fires are adjudicated manually.')]
scifi=[
('Mono Knife','melee',[('cutting',1)],5,5,0,'Blades','blade','One hand; fine cutting edge.'),
('Vibro Longsword','melee',[('cutting',2)],5,5,0,'Blades','blade','Two hands; vibrating edge. No ammo needed for this profile.'),
('Plasma Blade','melee',[('heat',2)],5,5,10,'Blades','plain','One hand; spends one charge per strike; uses a spare cell to recharge.'),
('Shock Baton','melee',[('electrical',1)],5,5,6,'Blunt Weapons','plain','One hand; spends one charge per strike.'),
('Gravity Maul','melee',[('bludgeoning',2)],5,5,0,'Heavy Weapons','heavy','Two hands; forceful.'),
('Laser Pistol','ranged',[('heat',1)],40,120,12,'Sidearms','laser','One hand; rechargeable cell.'),
('Heavy Laser Pistol','ranged',[('heat',2)],40,100,6,'Sidearms','plain','One hand; high-output cell.'),
('Laser Carbine','ranged',[('heat',2)],90,300,24,'Rifles','laser','Two hands; standard energy carbine.'),
('Pulse Rifle','ranged',[('electrical',2)],100,330,30,'Rifles','auto','Two hands; pulsed energy weapon.'),
('Gauss Rifle','ranged',[('piercing',2)],120,360,20,'Rifles','auto','Two hands; electromagnetically accelerated projectiles.'),
('Plasma Rifle','ranged',[('heat',3)],80,240,8,'Rifles','rifle','Two hands; high-output plasma; limited capacity.'),
('Rail Sniper','ranged',[('piercing',3)],200,650,5,'Sniper Rifles','precision','Two hands; scoped, slow; ready carry reduces Move by 5 ft manually.'),
('Sonic Carbine','ranged',[('sonic',2)],60,180,15,'Rifles','rifle','Two hands; acoustic weapon; no automatic area effect.'),
('Disruptor Pistol','ranged',[('disruption',2)],30,90,6,'Sidearms','plain','One hand; disrupts matter. No automatic armour bypass.'),
('Radiation Projector','ranged',[('radiation',2)],40,120,10,'Heavy Launchers','plain','Two hands; hazardous beam; long-term effects are manual.'),
('Toxin Dart Pistol','ranged',[('piercing',1),('toxic',1)],30,90,8,'Sidearms','plain','One hand; two components resolve separately; no automatic poison condition.'),
('Psi Focus Emitter','ranged',[('psychic',2)],60,180,6,'Psi Weapons','plain','One hand; neural interface. Psychic damage has no automatic mind-control effect.'),
('Energy Scattergun','ranged',[('heat',1),('bludgeoning',1)],25,80,8,'Shotguns','shotgun','Two hands; short-range scatter pattern.'),
('Pulse Support Gun','ranged',[('electrical',2)],120,450,60,'Light Machine Guns','auto','Two hands; heavy. Ready carry reduces Move by 5 ft manually.'),
('Industrial Cutter','melee',[('heat',1)],5,5,8,'Tools','plain','Two hands; cutting tool; spends one charge per use.')]
ma=[
('Padded Gambeson',[('bludgeoning',1)],0,0,'Light padded body armour.',[]),
('Leather Armour',[('cutting',1)],0,0,'Flexible leather body armour.',[]),
('Studded Leather',[('cutting',1),('piercing',1)],0,0,'Reinforced light armour.',[]),
('Mail Shirt',[('cutting',1),('piercing',1)],0,0,'Linked metal rings; no bludgeoning resistance.',[]),
('Brigandine',[('cutting',1),('piercing',1)],-5,1,'Plates beneath fabric; +1 maximum HP.',[]),
('Scale Armour',[('cutting',1),('piercing',1)],-5,0,'Overlapping scales.',[]),
('Half Plate',[('cutting',1),('piercing',1),('bludgeoning',1)],-5,0,'Rigid partial plate.',[]),
('Full Plate',[('cutting',2),('piercing',1),('bludgeoning',1)],-5,0,'Strong cutting protection; slow and conspicuous.',[]),
('Winter Clothing',[('cold',1)],0,0,'Insulated layers; not combat armour.',[])]
mo=[
('Reinforced Jacket',[('bludgeoning',1)],0,0,'Padded practical outerwear.',[]),
('Concealable Ballistic Vest',[('piercing',1)],0,0,'Low-profile soft body armour.',[]),
('Tactical Vest',[('piercing',1),('cutting',1)],0,0,'General combat vest.',[]),
('Plate Carrier',[('piercing',2)],-5,0,'Specialised bullet protection; no cutting resistance.',[]),
('Heavy Assault Armour',[('piercing',2),('cutting',1)],-5,1,'Bulky armour; +1 maximum HP.',[]),
('Riot Armour',[('bludgeoning',1),('cutting',1)],-5,0,'Designed for impacts and blades.',[]),
('Bomb Suit',[('bludgeoning',2),('heat',1),('piercing',1)],-10,0,'Heavy hazard protection; does not grant blast immunity.',[]),
('Insulated Work Suit',[('heat',1),('electrical',1)],0,0,'Protective industrial clothing.',[]),
('Hazmat Suit',[('toxic',1),('radiation',1)],-5,0,'Hazard protection; environmental sealing is manual.',[]),
('Cold-Weather Suit',[('cold',1)],0,0,'Insulated environmental clothing.',[])]
sa=[
('Spacer Jacket',[('cold',1)],0,0,'Light thermal clothing.',[]),
('Flex-Weave Armour',[('cutting',1),('piercing',1)],0,0,'Light general armour.',[]),
('Marine Combat Suit',[('piercing',1),('heat',1)],0,1,'Standard combat suit; +1 maximum HP.',[]),
('Assault Exosuit',[('piercing',2),('bludgeoning',1)],-5,1,'Heavy powered armour; +1 maximum HP.',[('electrical',1)]),
('Scout Exosuit',[('piercing',1)],5,0,'Mobility frame; +5 ft Move.',[('electrical',1)]),
('Vacuum Suit',[('cold',1),('radiation',1)],-5,0,'Sealed suit. Oxygen supply and vacuum exposure are manual.',[]),
('Thermal Ablative Suit',[('heat',2)],0,0,'Specialised heat protection.',[]),
('Faraday Suit',[('electrical',2)],0,0,'Specialised electrical protection.',[]),
('Psi-Shield Hood',[('psychic',1)],0,0,'Wearable neural shield; stacks with body armour only if the GM permits.',[]),
('Sonic Dampening Suit',[('sonic',1)],0,0,'Acoustic protection.',[]),
('Disruption Screen',[('disruption',1)],0,0,'Wearable field generator; no tracked field battery.',[]),
('Adaptive Nanoweave',[('piercing','1d2')],0,0,'Variable protection; roll 1d2 each time a piercing component is resolved.',[])]
mi=[('Round Shield','One hand while ready. May provide cover when credibly positioned; GM adjudicates.'),('Tower Shield','One hand; bulky. May provide substantial cover; reduce Move by 5 ft manually while ready.'),('Healer Satchel','Ten treatment uses. Supplies for Medicine; does not automatically heal.'),('Herbal Antidote','One dose. Supports Medicine against an identified toxin; result is manual.'),('Tool Kit','Tools for Craft without improvised-tool penalties.'),('Lockpicks','Fine tools for lock work; require a suitable test and access.'),('Rope (50 ft)','50 ft of rope for climbing, hauling or restraint; anchors and tests are manual.'),('Grappling Hook','Requires rope and a suitable anchor; supports climbing.'),('Lantern','Illuminates a 20-ft area for one scene per oil use; lighting is manual.'),('Torch Bundle','Six torches; each lasts one scene. Lighting is manual.'),('Rations (3 days)','Three days of food for one character.'),('Waterskin','One day of drinking water under ordinary conditions.'),('Bedroll','Portable bedding; suitable shelter is still needed.'),('Flint and Steel','Starts a small fire with dry tinder and time.'),('Spyglass','Magnifies distant visible subjects; does not grant an automatic test bonus.'),('Repair Supplies','Five uses for patching ordinary equipment; Craft outcomes are manual.')]
moi=[('Trauma Kit','Ten treatment uses; supports Field Patch and Stabilise procedures. No automatic HP restoration.'),('First Aid Pouch','Three treatment uses for minor injuries and basic stabilisation.'),('Rifle Magazine','One full 30-round spare magazine; compatible weapon required.'),('Pistol Magazine','One full 15-round spare magazine; compatible weapon required.'),('Shotgun Shell Box','Ten shells; load into a compatible shotgun manually.'),('Handheld Radio','Local voice communications; terrain and jamming affect reliability.'),('Smartphone','Local computing, camera and network access when available.'),('Binoculars','Magnifies distant visible subjects; no automatic roll bonus.'),('Night-Vision Goggles','Allows sight in low light while powered; ineffective in total darkness without illumination.'),('Flashlight','Handheld light; set token lighting manually.'),('Multitool','Small tools for simple Craft tasks.'),('Mechanic Tool Kit','Supports equipment repair; requires parts and time.'),('Breaching Kit','Pry bar, cutters and wedges for doors and obstacles; tests are manual.'),('Climbing Kit','50-ft rope, harness and anchors; does not remove climbing tests.'),('Gas Mask','Protection from inhaled hazards with the correct filter; no automatic resistance.'),('Smoke Canister','One use; creates a roughly 20-ft obscured area for one scene in still air. Place effects manually.'),('Restraints','One pair; apply after a suitable opportunity or opposed test.'),('Field Rations (3 days)','Three days of food for one character.')]
si=[('Medgel Kit','Ten treatment uses for Medicine. No automatic healing.'),('Nanite Patch','One dose; assists equipment or tissue repair as the GM permits.'),('Universal Power Cell','One spare standard cell; compatible weapon or device required.'),('Gauss Magazine','One full 20-round spare magazine; compatible gauss weapon required.'),('Multispectrum Scanner','Handheld scan within 30 ft; supports Awareness or Systems; no automatic bonus.'),('Commlink','Local encrypted communications when compatible networks permit.'),('Holo Projector','Projects a small visual decoy within 15 ft; no automatic deception result.'),('Hacking Deck','Interface tools for Systems; access and test outcomes are manual.'),('Repair Drone','Small assistant for Craft; provides tools, not an extra turn or automatic bonus.'),('Fusion Tool Kit','Tools for advanced Craft repairs; parts and time remain necessary.'),('Mag Boots','Adhere to suitable metal surfaces; mode and movement are manual.'),('Oxygen Canister','One scene of breathable supply for a compatible sealed suit.'),('Emergency Beacon','Broadcasts a distress signal; reception depends on local conditions.'),('Gravity Anchor','Portable anchor for climbing or tethering in low gravity.'),('Stasis Restraints','One set of powered restraints; apply after an appropriate test or opportunity.'),('Thermal Cloak','Reduces visual thermal signature; no automatic invisibility or roll bonus.'),('Portable Barrier','Deploy as one Interact action to create a 5-ft cover segment. Strength and cover are adjudicated manually.'),('Ration Synthesizer','With supplies and power, prepares one day of food for one character.')]
forms=[
('Synthetic',6,15,'Artificial person with a human-sized chassis. Environmental advantages depend on campaign fiction, not automatic immunity.',[action('Diagnostic scan',mode='test',target='self',skill='systems',rules='Report a self-diagnostic roll; GM determines faults and useful information.'),action('Servo strike',damage=[component('bludgeoning',1)],skill='meleeCombat',rules='Built-in unarmed strike; cannot normally be disarmed.')]),
('Cyborg',7,15,'Augmented human. Reinforced body provides 7 base HP; other upgrades are equipment.',[action('Interface',skill='systems',target='required',rules='Requires a compatible nearby device or synthetic target. GM resolves access manually.'),action('Internal status',mode='none',target='self',rules='Review fitted augmentations and current condition; does not restore HP.')]),
('Veyari',6,20,'Light-built telepathic alien. Move 20 ft; a focused psychic pulse is an innate attack.',[action('Psychic pulse',cost=2,skill='rangedCombat',damage=[component('psychic',1)],rules='Innate psychic attack within 30 ft. Range and line of sight are checked manually.'),action('Empathic read',skill='insight',rules='Read surface emotional cues from a visible target within 30 ft; result is manual.')]),
('Kharan',7,10,'Broad, dense-bodied alien. Base HP 7, Move 10 ft; built for forceful close combat.',[action('Crushing strike',cost=2,skill='meleeCombat',damage=[component('bludgeoning',2)],rules='Innate strike within 5 ft; requires two free limbs.'),action('Brace',mode='none',target='self',rules='Plant your stance. Describe the position; GM adjudicates resistance to forced movement. No automatic armour bonus.')])]
# Distinct selectable burst for the M16A4 without treating it as a support gun.
counts={s:build(s,*args) for s,args in {'medieval':(medieval,ma,mi),'modern':(modern,mo,moi),'sci-fi':(scifi,sa,si,forms)}.items()}
p=ROOT/'pack-sources'/'modern'/'m16a4.json';d=json.loads(p.read_text());d['system']['weaponActions'].insert(2,action('Three-round burst',cost=2,focus='Rifles',damage=[component('piercing',3)],spend=3,rules='Spend three rounds for one attack against one target. Starter variant: +1 damage is already included.'));p.write_text(json.dumps(d,indent=2)+'\n')
print(json.dumps(counts,indent=2))
