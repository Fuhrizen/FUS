import {targetHitChance,sourceAttackProfile} from './hit-chance.mjs';
import {resolveOriginToken,targetContext} from './cover.mjs';
import {promptTargetSelection} from './target-preview.mjs';
export const TARGET_MODES={none:'No target',required:'Requires target',self:'Target self',area:'Free area placement'};
export function selectedActionTargets(){return Array.from(globalThis.game?.user?.targets??[]).map(token=>({name:token.name??token.document?.name??'Target',tokenUuid:token.document?.uuid??'',actorUuid:token.actor?.uuid??''}));}
export async function actionTargets(actor,action,source,{prompt=promptTargetSelection,skipTarget=false}={}){
 const mode=action.targetMode??'none';
 if(!Object.hasOwn(TARGET_MODES,mode))throw new Error('Unknown action target mode.');
 if(mode==='none'||(skipTarget&&sourceAttackProfile(source,action).optimal>0))return [];
 if(mode==='self')return [{name:actor.name??'Self',actorUuid:actor.uuid,tokenUuid:actor.token?.uuid??''}];
 const origin=await resolveOriginToken(actor);if(globalThis.canvas?.ready&&!origin)return null;
 const read=()=>selectedActionTargets().map(row=>{const token=globalThis.canvas?.tokens?.placeables?.find(t=>t.document.uuid===row.tokenUuid);if(!origin||!token)return row;const context=targetContext(origin,token);return {...row,...context,hitChance:targetHitChance(actor,source,action,origin,token,context)};});
 return prompt(actor,action,source,read,{origin});
}
const tokenTargetRows=targets=>targets.length?[{label:'Target',detail:targets.map(t=>`${t.name}${t.distance!==undefined?` · ${t.distance} ft`:''}${t.cover?.level&&t.cover.level!==99?` · ${t.cover.label} (+${t.cover.level} DC)`:''}${t.los===false?' · LOS blocked':''}${t.hitChance?` · ${t.hitChance.chance}% hit${t.hit!==undefined?` · ${t.hit?'HIT':'MISS'}`:''}`:''}`).join(' / '),value:''}]:[];
export const targetRows=targets=>[...(targets.area?[{label:'Area',detail:`${targets.area.shape} · ${targets.area.sizeFeet} ft · ${targets.length} affected`,value:''}]:[]),...tokenTargetRows(targets)];

export function clearActionTargets(){const user=globalThis.game?.user;if(user?.updateTokenTargets)user.updateTokenTargets([]);else for(const token of Array.from(user?.targets??[]))token.setTarget?.(false,{user,releaseOthers:false});}
