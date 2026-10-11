import {characterStats,healthAfterCapacityChange} from './health.mjs';
export function appliedForm(actor){return [...(actor.items??[])].find(item=>item.type==='form' && item.id===actor.system.formItemId);}
export function formMaximum(actor){const value=appliedForm(actor)?.system.maxhp;return typeof value==='number' && Number.isFinite(value)?value:null;}
export function migrateFormData(data){
  const s=data.system??data;
  if(s.move===undefined)s.move=s.defaults?.move??15;
  if(s.maxhp===undefined)s.maxhp=null;
  if(s.rules===undefined)s.rules=[s.physiology,s.structure,s.interactions,s.defaults?.equipLimit!=null?`Equip Limit: ${s.defaults.equipLimit}`:'',s.source].filter(Boolean).join('\n\n');
  return data;
}


export function baselineForm(maxhp=6){return {name:'Basic',type:'form',img:'icons/svg/mystery-man.svg',system:{hands:2,maxhp:Number(maxhp)||6,move:15,description:'Standard basic Form.',rules:'Standard movement is 15 ft.',weaponActions:[],actionLinks:[{id:'unarmedStrike',uuid:'Compendium.FUS.actions.Item.fusUnarmedStrike',focusId:'',focusName:'Unarmed',focusActorUuid:''},{id:'defensiveReaction',uuid:'Compendium.FUS.actions.Item.fusDefensiveReac',focusId:'',focusName:'',focusActorUuid:''}]}};}
export async function ensureActorForm(actor){
 if(!actor.isOwner || appliedForm(actor))return;
 const before=characterStats(actor).maximum,current=Number(actor._source?.system.hp??actor.system.hp??0);
 let form=Array.from(actor.items??[]).find(i=>i.type==='form');
 if(!form){const data=baselineForm(actor._source?.system.maxhp??6);[form]=await actor.createEmbeddedDocuments('Item',[data]);}
 if(form.system.maxhp==null)await form.update({'system.maxhp':actor._source?.system.maxhp??6});
 const maximum=characterStats(actor,{baseHP:form.system.maxhp}).maximum;
 await actor.update({'system.formItemId':form.id,'system.maxhp':form.system.maxhp,'system.hp':healthAfterCapacityChange(current,before,maximum)});
}
export function preventFormRemoval(item){return !(item.type==='form' && item.parent?.system.formItemId===item.id);}
export function validFormSelection(actor,changes){const id=changes['system.formItemId']??changes.system?.formItemId;return id===undefined || Array.from(actor.items??[]).some(i=>i.type==='form' && i.id===id);}

export async function migrateBasicForms(){if(!game.user.isGM||game.users?.activeGM&&game.users.activeGM.id!==game.user.id)return;const actors=[...game.actors,...[...(game.scenes??[])].flatMap(s=>[...s.tokens].filter(t=>!t.actorLink).map(t=>t.actor).filter(Boolean))];const items=new Set([...game.items,...actors.flatMap(a=>[...a.items])]);for(const item of items)if(item.type==='form'&&item.name==='Baseline')await item.update({name:'Basic'});}
