import {ensureBaselineReactions} from './reactions.mjs';
import {migrateStarterAmmo} from './starter-ammo.mjs';
import {registerRulesSettings} from './rules-settings.mjs';
import {migrateActionIcons,actionIcon} from './action-icons.mjs';
import {mountCoverConfig} from './cover.mjs';
import {registerCoverPreview} from './cover-preview.mjs';
import {registerConditions,syncDeadStatus,changePins,registerSuppressionEffects} from './conditions.mjs';
import {migrateBoardRanges} from './board-ranges.mjs';
import {FUSActionData} from './action-model.mjs';
import {FUSActionSheet} from './action-sheet.mjs';
import {rememberAction,forgetAction,migrateActionLibrary,loadSourceActions,migrateSourceActions} from './action-library.mjs';
import {ensureActorForm,preventFormRemoval,validFormSelection} from './forms.mjs';
import {isFUSActor,actorCreationDefaults,sceneCreationDefaults} from './actor-types.mjs';
import {registerEncounters,openEncounters,updateEncounterHealth} from './encounters.mjs';
import {mountActionDamage,rollActionDamage} from './action-damage.mjs';
import {characterStats,healthAfterCapacityChange} from './health.mjs';
import {openWeaponActions,executeWeaponAction} from './attacks.mjs';
import {renderChatCard,restoreActionChatCard} from './chat-card.mjs';
import {DAMAGE_TYPES,rollDamage,resolveDamage,registerDamageLinks,registerDamageChat} from './damage.mjs';
import {FUSItemData,FUSWeaponData,FUSArmourData} from './item-model.mjs';
import {FUSItemSheet} from './item-sheet.mjs';
import {formMaximum} from './forms.mjs';
import {FUSCharacterData} from "./model.mjs";
import {FUSCharacterSheet} from "./character-sheet.mjs";
import {rollMacro, actionMacro, onHotbarDrop} from "./rolls.mjs";
Hooks.on("hotbarDrop", onHotbarDrop);
import {FUSFormData} from "./form-model.mjs";
import {FUSFormSheet} from "./form-sheet.mjs";
Hooks.once("init", () => {
  registerRulesSettings();registerEncounters();registerConditions();registerCoverPreview();registerSuppressionEffects();
  CONFIG.Item.dataModels.form = FUSFormData;
  CONFIG.Item.dataModels.action=FUSActionData;
  foundry.applications.apps.DocumentSheetConfig.registerSheet(foundry.documents.Item,"FUS",FUSActionSheet,{types:["action"],makeDefault:true,label:"FUS Action"});
  Object.assign(CONFIG.Item.dataModels,{item:FUSItemData,weapon:FUSWeaponData,armour:FUSArmourData});
  foundry.applications.apps.DocumentSheetConfig.registerSheet(foundry.documents.Item,"FUS",FUSItemSheet,{types:["item","weapon","armour"],makeDefault:true,label:"FUS Item"});
  foundry.applications.apps.DocumentSheetConfig.registerSheet(foundry.documents.Item,"FUS",FUSFormSheet,{types:["form"],makeDefault:true,label:"FUS Form"});
  CONFIG.FUS={...(CONFIG.FUS??{}),damageTypes:DAMAGE_TYPES};
  game.FUS = {changePins,openEncounters,rollActionDamage,openWeaponActions,executeWeaponAction,renderChatCard,rollMacro,actionMacro,damageTypes:DAMAGE_TYPES,rollDamage,resolveDamage};
  registerDamageLinks();
  registerDamageChat();
  CONFIG.Actor.dataModels.character = FUSCharacterData;
  CONFIG.Actor.dataModels.npc = FUSCharacterData;
  foundry.documents.collections.Actors.registerSheet("FUS", FUSCharacterSheet, {
    types: ["character","npc"], makeDefault: true, label: "FUS Character"
  });
});

// Apply the same HP ceiling to document updates, including lowering Max HP.
Hooks.on("preUpdateActor", (actor, changes) => {
  if (!isFUSActor(actor)) return;
  if(!validFormSelection(actor,changes))return false;
  const read = key => changes[`system.${key}`] ?? changes.system?.[key];
  if (read("hp") === undefined && read("maxhp") === undefined) return;
  const hp = Number(read("hp") ?? actor.system.hp);
  const maximum=formMaximum(actor);
  const maxhp = Number(maximum ?? read("maxhp") ?? actor._source?.system.maxhp ?? actor.system.maxhp);
  if(maximum!==null){
    if(Object.hasOwn(changes,"system.maxhp"))changes["system.maxhp"]=maximum;
    else {changes.system??={};changes.system.maxhp=maximum;}
  }
  if (!Number.isFinite(hp) || !Number.isFinite(maxhp)) return;
  const capped = Math.min(hp, characterStats(actor,{baseHP:maxhp}).maximum);
  if (Object.hasOwn(changes, "system.hp")) changes["system.hp"] = capped;
  else { changes.system ??= {}; changes.system.hp = capped; }
});

// Persist the HP ceiling when an owned Form changes; never refill current HP.


// Forms are replaceable but cannot be cleared or deleted while selected.
Hooks.on('preDeleteItem',item=>preventFormRemoval(item));
Hooks.on('preUpdateItem',(item,changes)=>{if(item.type==='form'&&item.parent && (changes['system.maxhp']===null || changes['system.maxhp']==='' || changes.system?.maxhp===null))return false;});
Hooks.on('preCreateItem',item=>{if(item.type==='action'&&['systems/FUS/assets/action.svg','icons/svg/item.svg','icons/svg/item-bag.svg'].includes(item.img))item.updateSource({img:actionIcon(item.name)});});
Hooks.on('createActor',async(actor,_options,userId)=>{if(userId===game.user.id){await ensureActorForm(actor);for(const item of actor.items)await loadSourceActions(item);}});
for(const event of ['createItem','updateItem'])Hooks.on(event,async item=>{if(item.type==='action'){rememberAction(item);await refreshActionViews();}else {if(event==='createItem'&&game.user.isGM&&(!game.users.activeGM||game.users.activeGM.id===game.user.id))await migrateSourceActions(item);await loadSourceActions(item);}});
Hooks.on('deleteItem',async item=>{if(item.type==='action'){forgetAction(item);await refreshActionViews();}});
async function refreshActionViews(){const actors=[...game.actors,...game.scenes.contents.flatMap(s=>s.tokens.contents.filter(t=>!t.actorLink).map(t=>t.actor).filter(Boolean))];for(const doc of [...actors,...game.items,...actors.flatMap(a=>a.items.contents)])if(doc.sheet?.rendered)await doc.sheet.render({force:true});}
Hooks.once('ready',async()=>{try{if(!game.users.activeGM || game.users.activeGM.id===game.user.id){for(const actor of game.actors)await ensureActorForm(actor);for(const scene of game.scenes)for(const token of scene.tokens)if(!token.actorLink&&token.actor)await ensureActorForm(token.actor);}await migrateActionLibrary();await ensureBaselineReactions();await migrateBoardRanges();await migrateActionIcons();await migrateStarterAmmo();for(const actor of game.actors)if(game.user.isGM&&game.users.activeGM?.id===game.user.id)await syncDeadStatus(actor);for(const token of canvas.tokens?.placeables??[])if(game.user.isGM&&game.users.activeGM?.id===game.user.id)await syncDeadStatus(token.actor);}catch(error){console.error('FUS migration failed',error);ui.notifications.error(error.message);}});

Hooks.on('renderChatMessageHTML',(message,html)=>{
  const reference=message.flags?.FUS;if(!['attack','weaponAction'].includes(reference?.kind))return;
  const container=html.querySelector('.message-content');
  restoreActionChatCard(container,message.content);
  const button=html.querySelector('[data-fus-chat-action="weaponDamage"]');
  button?.addEventListener('click',async()=>{
    button.disabled=true;
    try{const weapon=await fromUuid(reference.weaponUuid);const actor=await fromUuid(reference.actorUuid);
      if(!actor?.isOwner || weapon?.parent?.uuid!==actor.uuid || !['weapon','armour','item','form'].includes(weapon.type))throw new Error('This weapon is unavailable or not owned.');
      await rollActionDamage(actor,weapon,reference.actionId,{targets:reference.targets?.filter(t=>t.hit!==false)??null});
    }catch(e){ui.notifications.error(e.message);}finally{button.disabled=false;}
  });
});

Hooks.on('renderApplicationV2',(app)=>{
 const root=app.element?.querySelector?.('.fus-action-editor');if(!root)return;
 mountActionDamage(root);
 const field=name=>root.querySelector(`[name="${name}"]`);
 const focus=field('focus'),skill=field('skill');
 const show=(name,visible)=>{const control=field(name);if(control)control.closest('label').hidden=!visible;};
 const refresh=()=>{
   if(focus && skill){const key=skill.value||skill.dataset.defaultSkill;for(const option of focus.options){const relevant=!option.value || !option.dataset.skill || option.dataset.skill===key;option.hidden=!relevant;option.disabled=!relevant;}if(focus.selectedOptions[0]?.disabled)focus.value='';}
   const hasResource=root.dataset.sourceType!=='form' && root.dataset.hasResource==='true';
   const test=field('mode').value==='test',required=field('requiresFocus').checked,adjust=hasResource && field('adjustResource').checked;
   field('adjustResource').disabled=!hasResource;
   for(const name of ['modifier'])show(name,test);
   for(const name of ['skill','focus','focusName'])show(name,test||required);
   show('adjustResource',hasResource);show('resourceMode',adjust);show('resourceAmount',adjust && field('resourceMode').value!=='reset');
 };
 root.addEventListener('change',refresh);refresh();
});

// Capture capacity before item changes, including edits to equipped armour.
for(const event of ['preUpdateItem','preCreateItem','preDeleteItem'])Hooks.on(event,(item,...args)=>{
 const options=event==='preDeleteItem'?args[0]:args[1];
 if(isFUSActor(item.parent)&&options)options.fusPreviousMaximum=characterStats(item.parent).maximum;
});
for(const event of ['updateItem','createItem','deleteItem'])Hooks.on(event,async(item,...args)=>{
 const userId=args.at(-1),options=args.at(-2),actor=item.parent;
 if(userId!==game.user.id||!isFUSActor(actor)||!actor.isOwner)return;
 if(item.type!=='armour' && !(event==='updateItem'&&item.type==='form'&&actor.system.formItemId===item.id))return;
 const maximum=characterStats(actor).maximum,before=options?.fusPreviousMaximum??maximum;
 const hp=healthAfterCapacityChange(actor._source?.system.hp??actor.system.hp,before,maximum);
 const changes={'system.hp':hp};const formMax=formMaximum(actor);if(item.type==='form'&&formMax!==null)changes['system.maxhp']=formMax;
 await actor.update(changes);
});

Hooks.on('preCreateActor',actorCreationDefaults);
Hooks.on('preCreateScene',sceneCreationDefaults);

Hooks.on('updateActor',async(actor,changes,_options,userId)=>{
 if(!isFUSActor(actor)|| !(Object.hasOwn(changes,'system.hp') || changes.system?.hp!==undefined))return;
 if(userId===game.user.id&&actor.isOwner)await syncDeadStatus(actor);
 await updateEncounterHealth(actor);
});

Hooks.on('renderApplicationV2',mountCoverConfig);
Hooks.on('canvasReady',async()=>{if(game.user.isGM&&game.users.activeGM?.id===game.user.id)for(const token of canvas.tokens.placeables)await syncDeadStatus(token.actor);});

Hooks.on('createToken',async(token,_options,userId)=>{if(userId===game.user.id)await syncDeadStatus(token.actor);});
