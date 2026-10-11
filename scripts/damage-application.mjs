import {isFUSActor} from './actor-types.mjs';
import {resolveDamage,DAMAGE_TYPES,DAMAGE_STYLES} from './damage.mjs';
import {renderChatCard} from './chat-card.mjs';
export async function damageActors(targets){const actors=new Map();for(const target of targets){const token=target.tokenUuid?await fromUuid(target.tokenUuid):null;const actor=token?.actor??(target.actorUuid?await fromUuid(target.actorUuid):null);if(!actor)throw new Error(`Target ${target.name??''} is unavailable.`);actors.set(actor.uuid,actor);}return [...actors.values()];}
export async function damageResolutions(targets,components){const actors=await damageActors(targets);const results=[];for(const actor of actors)results.push({actorUuid:actor.uuid,name:actor.name,components:(await resolveDamage(actor,components,{requireOwnership:false})).map(({adjustments,...c})=>({...c,adjustments:adjustments.map(({roll,...a})=>a)}))});return results;}
export async function damageContent(data){const rows=data.components.map(c=>({label:DAMAGE_TYPES[c.type],icon:DAMAGE_STYLES[c.type].icon,colour:DAMAGE_STYLES[c.type].colour,detail:c.formula,value:c.total}));for(const target of data.resolutions??[])for(const c of target.components)rows.push({label:`${target.name} · ${DAMAGE_TYPES[c.type]}`,icon:DAMAGE_STYLES[c.type].icon,colour:DAMAGE_STYLES[c.type].colour,detail:`${c.total}${c.adjustments.map(a=>` ${a.kind==='weakness'?'+':'−'} ${a.total} (${a.armour})`).join('')}`,value:c.final});return renderChatCard({title:data.label??'Damage',subtitle:data.applied?'Damage applied · click Apply Damage again to undo':'Damage',rows,actions:[{action:'applyDamage',label:'Apply Damage'}]});}
const queues=new WeakMap();
export function toggleDamageApplication(message){const previous=queues.get(message)??Promise.resolve();const next=previous.catch(()=>{}).then(()=>toggle(message));queues.set(message,next);return next;}
async function toggle(message){
 if(message.isOwner===false)throw new Error('The message author or GM must apply or undo this damage.');
 const data=structuredClone(message.flags.FUS),undo=!!data.applied;
 const targets=undo?data.applications.map(a=>({actorUuid:a.actorUuid,tokenUuid:a.tokenUuid??'',name:a.name})):data.targets?.length?data.targets:Array.from(game.user.targets??[]).map(t=>({name:t.name,tokenUuid:t.document.uuid,actorUuid:t.actor?.uuid}));
 if(!targets.length)throw new Error('Target a token before applying damage.');
 const actors=await damageActors(targets);
 for(const actor of actors)if(!actor.isOwner || !isFUSActor(actor) || !Number.isFinite(actor.system.hp))throw new Error(`You cannot change HP for ${actor.name}. The GM can apply this damage.`);
 if(!undo)data.resolutions=await damageResolutions(targets,data.components);
 const changes=actors.map(actor=>{const before=actor.system.hp;const amount=undo?data.applications.find(a=>a.actorUuid===actor.uuid)?.lost??0:data.resolutions.find(r=>r.actorUuid===actor.uuid)?.components.reduce((sum,c)=>sum+c.final,0)??0;const after=undo?Math.min(actor.system.maxhp,before+amount):Math.max(0,before-amount);return {actor,before,after,lost:before-after};});
 const updated=[];
 try{
  for(const change of changes){await change.actor.update({'system.hp':change.after});updated.push(change);}
  data.applied=!undo;data.wasUndone=undo;data.targets=targets;
  if(!undo)data.applications=changes.map(c=>({actorUuid:c.actor.uuid,tokenUuid:c.actor.token?.uuid??'',name:c.actor.name,lost:c.lost}));
  await message.update({'flags.FUS':data,content:await damageContent(data)});
 }catch(error){for(const change of updated.reverse())await change.actor.update({'system.hp':change.before});throw error;}
 return data;
}
