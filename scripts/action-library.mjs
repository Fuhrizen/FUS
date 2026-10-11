// Live action definitions; source bindings retain identity, order and owner Focus.
const cache=new Map();
export function rememberAction(item){if(item?.type==='action')cache.set(item.uuid,item);return item;}
export function forgetAction(item){cache.delete(item.uuid);}
export async function loadAction(uuid){let item;try{item=await fromUuid(uuid);}catch(error){console.warn(`FUS Action unavailable: ${uuid}`,error);cache.delete(uuid);return null;}if(item?.type!=='action'){cache.delete(uuid);return null;}return rememberAction(item);}
export async function loadSourceActions(source){await Promise.all((source.system.actionLinks??[]).map(link=>loadAction(link.uuid)));}
export function linkedActions(source){return (source.system.actionLinks??[]).map(link=>{
 const item=cache.get(link.uuid)??globalThis.game?.items?.find(i=>i.uuid===link.uuid);
 if(!item)return {id:link.id,name:'Unavailable Action',cost:1,mode:'none',missing:true,description:link.uuid};
 const action=item.system.action?.toObject?.()??item.system.action;
 return {...action,id:link.id,name:item.name,actionUuid:item.uuid,focusId:link.focusId||action.focusId,focusActorUuid:link.focusActorUuid||action.focusActorUuid,focusName:link.focusName||action.focusName};
});}
export async function attachAction(source,item){
 if(!source.isOwner || item?.type!=='action')throw new Error('Drop an Action item on an editable source.');
 rememberAction(item);const links=Array.from(source.system.actionLinks??[],l=>({...l}));
 if(!links.some(l=>l.uuid===item.uuid))links.push({id:foundry.utils.randomID(),uuid:item.uuid,focusId:'',focusName:'',focusActorUuid:''});
 await source.update({'system.actionLinks':links});
}
export async function migrateSourceActions(source,definitions=new Map()){
 const legacy=Array.from(source.system.weaponActions??[],a=>a.toObject?.()??{...a});if(!legacy.length)return;
 const links=Array.from(source.system.actionLinks??[],l=>({...l}));
 for(const row of legacy){
  if(links.some(l=>l.id===row.id))continue;
  const {id,name,focusId,focusActorUuid,...action}=row;
  const signature=JSON.stringify({name,action});let definition=definitions.get(signature)??game.items.find(i=>i.type==='action'&&i.flags?.FUS?.migrationSignature===signature);
  if(!definition){definition=await foundry.documents.Item.create({name:name||'Action',type:'action',system:{action},ownership:{default:2},flags:{FUS:{migrationSignature:signature}}});}
  definitions.set(signature,definition);rememberAction(definition);
  links.push({id:id||foundry.utils.randomID(),uuid:definition.uuid,focusId:focusId??'',focusName:row.focusName??'',focusActorUuid:focusActorUuid??''});
 }
 await source.update({'system.actionLinks':links,'system.weaponActions':[]});
}
export async function executeActionAutomation(actor,source,action,targets,message){
 const context={actor,source,action,targets,message};
 if(action.macroUuid){const macro=await fromUuid(action.macroUuid);if(!macro || macro.documentName!=='Macro' || !macro.canExecute)throw new Error('The configured Macro is unavailable or cannot be executed.');await macro.execute(context);}
 if(action.script?.trim()){
  if(!game.user.can('MACRO_SCRIPT'))throw new Error('You do not have permission to execute scripts.');
  const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
  await new AsyncFunction('actor','source','action','targets','message',action.script)(actor,source,action,targets,message);
 }
}
export async function migrateActionLibrary(){
 const actors=[...game.actors.contents,...game.scenes.contents.flatMap(scene=>scene.tokens.contents.filter(t=>!t.actorLink).map(t=>t.actor).filter(Boolean))];
 const sources=[...game.items.contents,...actors.flatMap(a=>a.items.contents)].filter(i=>['weapon','armour','item','form'].includes(i.type));
 if(game.user.isGM && (!game.users.activeGM || game.users.activeGM.id===game.user.id)){const definitions=new Map();for(const source of sources)await migrateSourceActions(source,definitions);}
 for(const source of sources)await loadSourceActions(source);
}
