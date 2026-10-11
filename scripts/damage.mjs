import {damageResolutions,damageContent,toggleDamageApplication} from './damage-application.mjs';
import {restoreActionChatCard} from './chat-card.mjs';
import {escapeHTML} from './rolls.mjs';
export const DAMAGE_TYPES=Object.freeze(Object.fromEntries(['Bludgeoning','Cutting','Piercing','Heat','Cold','Electrical','Toxic','Radiation','Sonic','Disruption','Psychic'].map(label=>[label.toLowerCase(),label])));
export const DAMAGE_STYLES=Object.freeze({
  bludgeoning:{icon:'hammer',colour:'#6b4b35'},cutting:{icon:'scissors',colour:'#9b303e'},piercing:{icon:'crosshairs',colour:'#72501e'},
  heat:{icon:'fire',colour:'#ad3914'},cold:{icon:'snowflake',colour:'#17698c'},electrical:{icon:'bolt',colour:'#856000'},
  toxic:{icon:'skull-crossbones',colour:'#41702a'},radiation:{icon:'radiation',colour:'#697010'},sonic:{icon:'wave-square',colour:'#286b68'},
  disruption:{icon:'burst',colour:'#6d428f'},psychic:{icon:'brain',colour:'#963b7f'}
});
export function damageBadge(type){const style=DAMAGE_STYLES[type];if(!style)return '';return `<span class="fus-damage-badge" style="--damage-colour:${style.colour}" title="${DAMAGE_TYPES[type]}"><i class="fa-solid fa-${style.icon}" aria-hidden="true"></i> ${DAMAGE_TYPES[type]}</span>`;}
export function displayDamageFormula(formula){return String(formula).replace(/\[(?:bludgeoning|cutting|piercing|heat|cold|electrical|toxic|radiation|sonic|disruption|psychic)\]/gi,'').trim();}
export function validateComponent(component){
  if(!Object.hasOwn(DAMAGE_TYPES,component.type))throw new Error('Unknown damage type.');
  const formula=String(component.formula??'').trim();
  if(!formula || !/^[\ddD+\-*/().\s]+$/.test(formula) || !foundry.dice.Roll.validate(formula))throw new Error('Enter a fixed number or dice formula, such as 2 or 1d6 + 2.');
  return {type:component.type,formula};
}
export async function rollDamage(components,{actor=null,label='Damage',targets=null}={}){
  if(actor && !actor.isOwner)throw new Error('You cannot roll for this character.');
  if(!components?.length)throw new Error('Add a damage component first.');
  const checked=components.map(validateComponent),rolls=[];
  for(const component of checked){const roll=new foundry.dice.Roll(`${component.formula}[${component.type}]`);await roll.evaluate();rolls.push(roll);}
  targets??=Array.from(globalThis.game?.user?.targets??[]).map(t=>({name:t.name,tokenUuid:t.document?.uuid??'',actorUuid:t.actor?.uuid??''}));
  const data={kind:'damage',label,targets,components:checked.map((c,i)=>({...c,total:rolls[i].total})),resolutions:targets.length?await damageResolutions(targets,checked.map((c,i)=>({...c,total:rolls[i].total}))):[],applied:false};
  return foundry.documents.ChatMessage.create({speaker:foundry.documents.ChatMessage.getSpeaker({actor}),rolls,content:await damageContent(data),flags:{FUS:data}});
}
export async function resolveDamage(actor,components,{requireOwnership=true}={}){
  if(!actor || (requireOwnership && !actor.isOwner))throw new Error('You cannot resolve damage for this character.');
  const armour=[...(actor.items??[])].filter(i=>i.type==='armour' && i.system.equipped && (i.system.quantity??1)>0);
  const results=[];
  for(const component of components){
    if(!Object.hasOwn(DAMAGE_TYPES,component.type) || !Number.isFinite(component.total) || component.total<0)throw new Error('Invalid damage component.');
    const adjustments=[];
    for(const item of armour)for(const entry of item.system.adjustments??[]){
      if(entry.type!==component.type)continue;
      validateComponent(entry);const roll=new foundry.dice.Roll(entry.formula);await roll.evaluate();
      adjustments.push({armour:item.name,kind:entry.kind,formula:entry.formula,total:Math.max(0,roll.total),roll});
    }
    const resistance=adjustments.filter(a=>a.kind==='resistance').reduce((n,a)=>n+a.total,0);
    const weakness=adjustments.filter(a=>a.kind==='weakness').reduce((n,a)=>n+a.total,0);
    results.push({...component,adjustments,final:Math.max(0,component.total-resistance+weakness)});
  }
  return results;
}
export function registerDamageLinks(){
  CONFIG.TextEditor.enrichers.push({pattern:/@Damage\[((?:[^\[\]]+\[[a-z]+\]\s*;?\s*)+)\](?:\{([^}]+)\})?/g,enricher:async match=>{
    try{const components=match[1].split(';').map(part=>{const m=/^(.+)\[([a-z]+)\]$/.exec(part.trim());if(!m)throw new Error('Use @Damage[1d6[heat]].');return validateComponent({formula:m[1],type:m[2]});});const link=document.createElement('a');link.className='fus-damage-link';link.dataset.components=JSON.stringify(components);link.innerHTML=`${escapeHTML(match[2]||'Roll damage')} ${components.map(c=>damageBadge(c.type)).join(' ')}`;return link;}catch{return null;}
  }});
  document.addEventListener('click',event=>{const link=event.target.closest?.('.fus-damage-link');if(!link)return;event.preventDefault();rollDamage(JSON.parse(link.dataset.components),{label:link.textContent}).catch(e=>ui.notifications.error(e.message));});
}
export function registerDamageChat(){
  Hooks.on('renderChatMessageHTML',(message,html)=>{
    const damage=message.flags?.FUS;
    if(!['damage','resolvedDamage'].includes(damage?.kind))return;
    // Native roll rendering may replace content; restore the system's explicit card.
    const container=html.querySelector('.message-content');
    restoreActionChatCard(container,message.content);
    if(damage.kind!=='damage')return;
    for(const button of html.querySelectorAll('[data-fus-chat-action="applyDamage"], [data-fus-chat-action="undoDamage"]')){
      const undo=button.dataset.fusChatAction==='undoDamage';button.disabled=!undo&&!!damage.applied;
      button.title=undo?'Restore only HP removed by this message':'Apply damage after equipped armour';
      button.addEventListener('click',async()=>{button.disabled=true;try{await toggleDamageApplication(message,{undo});}catch(error){ui.notifications.error(error.message);}finally{button.disabled=!undo&&!!message.flags.FUS.applied;}});
    }
  });
}
