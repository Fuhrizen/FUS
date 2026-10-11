import {ammoTrackingEnabled} from './rules-settings.mjs';
import {attackBonuses,isAttackAction} from './hit-chance.mjs';
import {linkedActions,loadSourceActions,executeActionAutomation} from './action-library.mjs';
import {clearActionTargets} from './targeting.mjs';
import {isFUSActor} from './actor-types.mjs';
import {actionTargets,targetRows} from './targeting.mjs';
import {costPips} from './action-damage.mjs';
import {SKILLS,focusId,focusLabel} from './config.mjs';
import {escapeHTML} from './rolls.mjs';
import {renderChatCard} from './chat-card.mjs';
export const DEFAULT_ATTACK={id:'attack',name:'Attack',cost:1,mode:'test',targetMode:'none',skill:'',focusId:'',focusName:'',focusActorUuid:'',adjustResource:false,resourceMode:'adjust',resourceAmount:-1,requiresFocus:false,modifier:0,damage:true,damageComponents:[],description:''};
export function sourceActions(source){if(source.system.actionLinks?.length || (source.system.actionLinks && !source.system.weaponActions?.length))return linkedActions(source);return source.system.weaponActions?.length?Array.from(source.system.weaponActions):source.type==='weapon'?[DEFAULT_ATTACK]:[];}
export const weaponActions=sourceActions;
export function attackSkill(weapon,action){const linked=(weapon.parent?.system.focuses??[]).find((f,i)=>focusId(f,i)===action.focusId);const key=linked?.skill||action.skill|| (weapon.type!=='weapon'?'athletics':weapon.system.combatMode==='melee'?'meleeCombat':'rangedCombat');if(!Object.hasOwn(SKILLS,key))throw new Error('Unknown action skill.');return key;}
export function matchingFocuses(actor,weapon,action){
 const skill=attackSkill(weapon,action),all=(actor.system.focuses??[]).map((f,i)=>({...f,id:focusId(f,i),label:focusLabel(f)})).filter(f=>f.skill===skill);
 if(action.focusId){const exact=all.find(f=>f.id===action.focusId);if(exact)return [exact];if(action.focusActorUuid===actor.uuid)return [];}
 if(action.focusName)return all.filter(f=>f.name.trim().toLocaleLowerCase()===action.focusName.trim().toLocaleLowerCase());
 return [];
}
export function hasWeaponResource(weapon){return weapon.type==='weapon' && (Number(weapon.system.resourceCurrent??0)>0 || Number(weapon.system.resourceMax??0)>0);}
export function resourceAfterUse(weapon,action){
 const current=Number(weapon.system.resourceCurrent??0),maximum=Number(weapon.system.resourceMax??0);
 if(!action.adjustResource || !hasWeaponResource(weapon)||weapon.system.combatMode==='ranged'&&!ammoTrackingEnabled())return current;
 if(action.resourceMode==='reset')return maximum;
 const amount=Number(action.resourceAmount??0);
 if(!Number.isSafeInteger(amount))throw new Error('Enter a whole-number resource adjustment.');
 if(current+amount<0)throw new Error(`Not enough ${weapon.system.combatMode==='melee'?'Charges':'Ammo'}.`);
 return Math.min(maximum,current+amount);
}
export function actionAvailability(actor,weapon,action){
 if(action.missing)return {locked:true,reason:'The linked Action definition is unavailable.'};
 if(action.requiresFocus && !matchingFocuses(actor,weapon,action).some(f=>f.rank>=1))return {locked:true,reason:'This action requires its selected Focus at +1 or higher.'};
 try{requiredActionItem(actor,action);ammoRequirement(weapon,action);resourceAfterUse(weapon,action);}catch(e){return {locked:true,reason:e.message};}
 return {locked:false,reason:''};
}
export function requiredActionItem(actor,action){
 const reference=String(action.requiredItem??'').trim();if(!reference)return null;
 const amount=Number(action.requiredItemQuantity??1);if(!Number.isSafeInteger(amount)||amount<1)throw new Error('Required item quantity must be a positive whole number.');
 const item=Array.from(actor.items??[]).find(i=>i.id===reference||i.uuid===reference||i._stats?.compendiumSource===reference||i.flags?.core?.sourceId===reference||i.name?.trim().toLocaleLowerCase()===reference.toLocaleLowerCase());
 if(!item||Number(item.system.quantity??1)<amount)throw new Error(`Requires ${amount} × ${reference}.`);
 return {item,amount};
}
export function ammoRequirement(source,action){
 if(!ammoTrackingEnabled()||source.type!=='weapon'||source.system.combatMode!=='ranged'||!action.adjustResource||action.resourceMode!=='reset'||!source.system.ammoType)return [];
 const reference=String(source.system.ammoType),needed=Math.max(0,Number(source.system.resourceMax??0)-Number(source.system.resourceCurrent??0));if(!needed)return [];
 const items=Array.from(source.parent?.items??[]).filter(i=>i.type==='item'&&(i.system.ammoType===reference||i.uuid===reference||i._stats?.compendiumSource===reference||i.flags?.core?.sourceId===reference||i.name?.toLowerCase()===reference.toLowerCase()));
 let remaining=needed;const uses=[];for(const item of items){const count=Math.max(0,Number(item.system.quantity??0));const amount=Math.min(count,remaining);if(amount>0)uses.push({item,amount});remaining-=amount;if(remaining<=0)break;}if(remaining>0)throw new Error(`Reload requires ${needed} ${reference} rounds / charges (${needed-remaining} available).`);return uses;
}
async function postActionMessage(weapon,action,message){
 const previous=Number(weapon.system.resourceCurrent??0),next=resourceAfterUse(weapon,action),requirement=requiredActionItem(weapon.parent,action),ammo=ammoRequirement(weapon,action),spent=[];
 try{
  const deductions=new Map();
  for(const {item,amount} of [...ammo,...(requirement&&action.consumeRequiredItem?[requirement]:[])]){if(item.id===weapon.id)throw new Error('A reload cannot consume its own source item.');deductions.set(item,(deductions.get(item)??0)+amount);}
  for(const [item,amount]of deductions){const before=Number(item.system.quantity??1);if(before<amount)throw new Error(`Not enough ${item.name}.`);}
  for(const [item,amount]of deductions){const before=Number(item.system.quantity??1);await item.update({'system.quantity':before-amount});spent.push([item,{'system.quantity':before}]);}
  if(action.adjustResource&&hasWeaponResource(weapon)&&!(weapon.system.combatMode==='ranged'&&!ammoTrackingEnabled())){await weapon.update({'system.resourceCurrent':next});spent.push([weapon,{'system.resourceCurrent':previous}]);}
  return await foundry.documents.ChatMessage.create(message);
 }catch(error){for(const [item,changes]of spent.reverse())await item.update(changes);throw error;}
}
const actionQueues=new WeakMap();
export function executeSourceAction(actor,weapon,actionId,options={}){
 const previous=actionQueues.get(actor)??Promise.resolve();
 const next=previous.catch(()=>{}).then(()=>executeAction(actor,weapon,actionId,options));actionQueues.set(actor,next);return next;
}
export const executeWeaponAction=executeSourceAction;
function checkOwnership(actor,weapon){if(!actor?.isOwner || !isFUSActor(actor) || !['weapon','armour','item','form'].includes(weapon.type) || weapon.parent?.uuid!==actor.uuid)throw new Error('Use an action source owned by this character.');}
async function executeAction(actor,weapon,actionId,{focus=null,force=false,skipTarget=false}={}){
 checkOwnership(actor,weapon);await loadSourceActions(weapon);const definition=sourceActions(weapon).find(a=>a.id===actionId);if(!definition)throw new Error('This action no longer exists.');const action={...definition};
 const availability=actionAvailability(actor,weapon,action);
 if(availability.locked && !force)throw new Error(availability.reason);
 if(action.missing)throw new Error('The linked Action definition is unavailable.');
 const skill=attackSkill(weapon,action),focuses=(actor.system.focuses??[]).map((f,i)=>({...f,id:focusId(f,i)}));
 const matches=matchingFocuses(actor,weapon,action);
 if(action.mode!=='none'&&focus===null&&matches.length>1){focus=await foundry.applications.api.DialogV2.wait({window:{title:'Choose Focus'},content:'<p>Select the Focus used for this attack and hit-chance preview.</p>',buttons:[...matches.map(f=>({action:f.id,label:focusLabel(f),callback:()=>f.id})),{action:'cancel',label:'Cancel'}],rejectClose:false});if(!matches.some(f=>f.id===focus))return;}
 const selected=focus===null?matches[0]:focuses.find(f=>f.id===focus && f.skill===skill);
 if(focus && !selected)throw new Error('Selected Focus no longer exists under this skill.');
 if(action.requiresFocus && !force && (!selected || selected.rank<1 || !matches.some(f=>f.id===selected.id)))throw new Error('This action requires a relevant Focus of +1 or higher.');
 action._focusBonus=Number(selected?.rank??0);action._attackSkill=skill;
 const targets=await actionTargets(actor,action,weapon,{skipTarget});if(targets===null)return;
 try{
 if(action.mode==='none')return await finishAction(actor,weapon,action,targets,{speaker:foundry.documents.ChatMessage.getSpeaker({actor}),content:await renderChatCard({title:action.name,img:action.img,cost:action.cost,subtitle:`${weapon.name} · ${force?'Forced use · ':''}${action.cost} action${action.cost===1?'':'s'}`,bodyHTML:escapeHTML(action.description).replace(/\n/g,'<br>'),rows:targetRows(targets),actions:action.damage&&action.damageComponents?.length?[{action:'weaponDamage',label:'Roll damage'}]:[]}),flags:{FUS:{kind:'weaponAction',actorUuid:actor.uuid,weaponUuid:weapon.uuid,actionId,targets,forced:force}}});
 const base=Number(action.modifier??0);if(!Number.isFinite(base))throw new Error('Enter a valid action roll modifier.');
 const bonuses=attackBonuses(actor,weapon,action);const data={skill:Number(actor.system.skills[skill]??0),focus:Number(selected?.rank??0),modifier:isAttackAction(weapon,action)?(targets.find(t=>t.hitChance)?.hitChance.rollModifier??bonuses.modifier):base};
 const roll=new foundry.dice.Roll('2d10 + @skill + @focus + @modifier',data);await roll.evaluate();for(const target of targets)if(target.hitChance)target.hit=!target.hitChance.blocked&&roll.total>=target.hitChance.dc;
 const content=await renderChatCard({title:action.name,img:action.img,cost:action.cost,subtitle:`${weapon.name} · ${force?'Forced use · ':''}${action.cost} action${action.cost===1?'':'s'} · ${SKILLS[skill]}${selected?` · ${focusLabel(selected)}`:''}`,bodyHTML:escapeHTML(action.description).replace(/\n/g,'<br>'),rows:[...targetRows(targets),...targets.filter(t=>t.hitChance).map(t=>({label:`${t.name} · ${t.hit?'HIT':'MISS'}`,detail:t.hitChance.factors.join(' · ')+` · 2d10 + ${t.hitChance.bonus} vs DC ${t.hitChance.dc}`,value:`${t.hitChance.chance}%`})),{label:'Roll',detail:`2d10 + skill ${data.skill} + focus ${data.focus} + modifier ${data.modifier}`,value:roll.total}],actions:action.damage&&action.damageComponents?.length&&(!targets.some(t=>t.hitChance)||targets.some(t=>t.hit))?[{action:'weaponDamage',label:'Roll damage'}]:[]});
 return await finishAction(actor,weapon,action,targets,{speaker:foundry.documents.ChatMessage.getSpeaker({actor}),rolls:[roll],content,flags:{FUS:{kind:'attack',actorUuid:actor.uuid,weaponUuid:weapon.uuid,actionId,skill,focusId:selected?.id??'',modifier:data.modifier,total:roll.total,targets,forced:force}}});
 }finally{if(['required','self'].includes(action.targetMode))clearActionTargets();}
}
async function finishAction(actor,source,action,targets,data){const message=await postActionMessage(source,action,data);try{await executeActionAutomation(actor,source,action,targets,message);}catch(error){console.error('FUS Action automation failed',error);ui.notifications.error(`Action used, but automation failed: ${error.message}`);}return message;}
export async function openSourceActions(actor,weapon,actionId=null,{force=false,skipTarget=false}={}){
 checkOwnership(actor,weapon);await loadSourceActions(weapon);const actions=sourceActions(weapon);
 const selected=actionId??await foundry.applications.api.DialogV2.wait({window:{title:`${weapon.name}: Actions`},content:'<p>Choose an action.</p>',buttons:[...actions.map(a=>({action:a.id,label:`${a.name} (${a.cost})`,callback:()=>a.id})),{action:'cancel',label:'Cancel'}],rejectClose:false});
 const action=actions.find(a=>a.id===selected);if(!action)return;
 const availability=actionAvailability(actor,weapon,action);if(availability.locked && !force)throw new Error(availability.reason);
 return executeSourceAction(actor,weapon,action.id,{force,skipTarget});
}

export const openWeaponActions=openSourceActions;

export function availableActionGroups(actor,{hideLocked=false}={}){
 return [...(actor.items??[])].filter(item=>(['weapon','armour','item'].includes(item.type) && (item.system.quantity??1)>0 || item.type==='form' && item.id===actor.system.formItemId)).sort((a,b)=>a.name.localeCompare(b.name)).map(item=>({itemId:item.id,name:item.name,img:item.img,hasResource:(!(item.system.combatMode==='ranged')||ammoTrackingEnabled())&&((item.system.resourceCurrent??0)>0 || (item.system.resourceMax??0)>0),resourceLabel:item.system.combatMode==='melee'?'Charges':'Ammo',resourceCurrent:item.system.resourceCurrent??0,resourceMax:item.system.resourceMax??0,actions:sourceActions(item).map(action=>({id:action.id,name:action.name,cost:action.cost,costPips:costPips(action.cost),description:action.description,img:action.img,...actionAvailability(actor,item,action),test:action.mode==='test',skillLabel:action.mode==='test'?SKILLS[attackSkill(item,action)]:'No roll'})).filter(action=>!hideLocked || !action.locked)})).filter(group=>group.actions.length);
}
