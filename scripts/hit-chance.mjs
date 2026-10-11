import {focusId} from './config.mjs';
import {pinAttackPenalty} from './rules-settings.mjs';
export function twoD10Chance(dc,bonus=0){let hits=0;for(let a=1;a<=10;a++)for(let b=1;b<=10;b++)if(a+b+bonus>=dc)hits++;return hits;}
export function isAttackAction(source,action){const skill=action._attackSkill||action.skill||(source.type==='weapon'?(source.system.combatMode==='melee'?'meleeCombat':'rangedCombat'):'');return action.mode!=='none'&&['meleeCombat','rangedCombat'].includes(skill);}
export function sourceAttackProfile(source,action={}){const system=source?.system??{},melee=system.combatMode==='melee'||action._attackSkill==='meleeCombat'||action.skill==='meleeCombat',optimal=Math.max(0,Number(system.optimal)||((melee&&source?.type!=='weapon')?5:0));return {...system,combatMode:melee?'melee':'ranged',optimal,maximum:melee?optimal:Math.max(optimal,Number(system.maximum)||0)};}
export function actingTokenPins(actor,origin=null){const token=origin??actor.token?.object??globalThis.canvas?.tokens?.controlled?.find(t=>t.actor?.uuid===actor.uuid);return Math.max(0,Number((token?.document??token)?.flags?.FUS?.pins??0)||0);}
export function attackBonuses(actor,source,action,origin=null){
 const linked=(actor.system.focuses??[]).find((f,i)=>focusId(f,i)===action.focusId),skill=action._attackSkill||linked?.skill||action.skill||(source.system.combatMode==='melee'?'meleeCombat':'rangedCombat');
 const selected=linked??(actor.system.focuses??[]).find(f=>f.skill===skill&&action.focusName&&f.name.trim().toLowerCase()===action.focusName.trim().toLowerCase());
 const pins=actingTokenPins(actor,origin),pinPenalty=pins*pinAttackPenalty(),statuses=actor.statuses??new Set(),hindered=statuses.has('fus-hindered')||statuses.has('fus-suppressed')?2:0;
 return {skill:Number(actor.system.skills?.[skill]??0),focus:Number(action._focusBonus??selected?.rank??0),modifier:Number(action.modifier??0)-pinPenalty-hindered,pins,pinPenalty,hindered};
}
export function hitChance(context,profile,bonuses,{targetStatuses=new Set()}={}){
 const distance=Number(context.distance??0),optimal=Number(profile.optimal??0),maximum=profile.combatMode==='melee'?optimal:Math.max(optimal,Number(profile.maximum??0)),cover=Number(context.cover?.level??0),rangePenalty=optimal>0&&distance>optimal?2:0;
 const blocked=context.los===false||cover===99||maximum>0&&distance>maximum;
 const exposed=targetStatuses.has('fus-exposed')?2:0,dc=14+(cover===2||cover===4?cover:0)+rangePenalty-exposed,bonus=bonuses.skill+bonuses.focus+bonuses.modifier;
 const factors=[`DC 14`,...(cover===2||cover===4?[`${context.cover?.label??'Cover'} +${cover} DC`]:[]),...(rangePenalty?[`Extended range +2 DC`]:[]),...(bonuses.pinPenalty?[`${bonuses.pins} pin${bonuses.pins===1?'':'s'} −${bonuses.pinPenalty} roll`]:[]),...(bonuses.hindered?['Hindered / suppressed −2 roll']:[]),...(exposed?['Exposed −2 DC']:[])];
 return {chance:blocked?0:twoD10Chance(dc,bonus),dc,bonus,blocked,reason:context.los===false||cover===99?'Line of attack blocked':maximum>0&&distance>maximum?'Out of range':'',factors,rollModifier:bonuses.modifier};
}
export function targetHitChance(actor,source,action,origin,token,context){if(!isAttackAction(source,action))return null;return hitChance(context,sourceAttackProfile(source,action),attackBonuses(actor,source,action,origin),{targetStatuses:token?.actor?.statuses??new Set()});}
