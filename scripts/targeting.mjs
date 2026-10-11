import {promptTargetSelection} from './target-preview.mjs';
export const TARGET_MODES={none:'No target',required:'Requires target',self:'Target self'};
export function selectedActionTargets(){return Array.from(globalThis.game?.user?.targets??[]).map(token=>({name:token.name??token.document?.name??'Target',tokenUuid:token.document?.uuid??'',actorUuid:token.actor?.uuid??''}));}
export async function actionTargets(actor,action,source,{prompt=promptTargetSelection}={}){
 const mode=action.targetMode??'none';
 if(!Object.hasOwn(TARGET_MODES,mode))throw new Error('Unknown action target mode.');
 if(mode==='none')return [];
 if(mode==='self')return [{name:actor.name??'Self',actorUuid:actor.uuid,tokenUuid:actor.token?.uuid??''}];
 return prompt(actor,action,source,selectedActionTargets);
}
export const targetRows=targets=>targets.length?[{label:'Target',detail:targets.map(t=>t.name).join(', '),value:''}]:[];
