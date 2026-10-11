import {resolveOriginToken,targetContext} from './cover.mjs';
import {promptTargetSelection} from './target-preview.mjs';
export const TARGET_MODES={none:'No target',required:'Requires target',self:'Target self'};
export function selectedActionTargets(){return Array.from(globalThis.game?.user?.targets??[]).map(token=>({name:token.name??token.document?.name??'Target',tokenUuid:token.document?.uuid??'',actorUuid:token.actor?.uuid??''}));}
export async function actionTargets(actor,action,source,{prompt=promptTargetSelection}={}){
 const mode=action.targetMode??'none';
 if(!Object.hasOwn(TARGET_MODES,mode))throw new Error('Unknown action target mode.');
 if(mode==='none')return [];
 if(mode==='self')return [{name:actor.name??'Self',actorUuid:actor.uuid,tokenUuid:actor.token?.uuid??''}];
 const origin=await resolveOriginToken(actor);if(globalThis.canvas?.ready&&!origin)return null;
 const read=()=>selectedActionTargets().map(row=>{const token=globalThis.canvas?.tokens?.placeables?.find(t=>t.document.uuid===row.tokenUuid);return origin&&token?{...row,...targetContext(origin,token)}:row;});
 return prompt(actor,action,source,read,{origin});
}
export const targetRows=targets=>targets.length?[{label:'Target',detail:targets.map(t=>`${t.name}${t.distance!==undefined?` · ${t.distance} ft`:''}${t.cover?.level?` · ${t.cover.label} (${t.cover.name}${t.cover.level!==99?`, +${t.cover.level} defence`:''})`:''}${t.los===false?' · LOS blocked':''}`).join(' / '),value:''}]:[];

export function clearActionTargets(){const user=globalThis.game?.user;if(user?.updateTokenTargets)user.updateTokenTargets([]);else for(const token of Array.from(user?.targets??[]))token.setTarget?.(false,{user,releaseOthers:false});}
