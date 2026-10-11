import {expireDefensiveReactions} from './reactions.mjs';
import {newEncounter,transitionEncounter,normalizeEncounter,encounterGroups} from './encounter-model.mjs';
const {HandlebarsApplicationMixin}=foundry.applications.api;
const {AbstractSidebarTab}=foundry.applications.sidebar;
let queue=Promise.resolve();const views=new Set();
function reportError(error){console.error('FUS Encounters:',error);try{ui.notifications.error(error.message);}catch(notificationError){console.error('FUS notification failed:',notificationError);}}
const state=()=>game.settings.get('FUS','encounters');
const refresh=async data=>{try{await expireDefensiveReactions(data);for(const view of views)if(view.rendered)await view.render({force:true});}catch(error){reportError(error);}};
async function write(change){const task=queue.catch(()=>{}).then(async()=>{if(!game.user.isGM)throw new Error('The GM manages the encounter.');const data=structuredClone(state());await change(data);await game.settings.set('FUS','encounters',data);});queue=task;return task;}
async function context(){const data=state(),raw=data.encounters.find(e=>e.id===data.selectedId),encounter=raw?normalizeEncounter(raw):null;return {gm:game.user.isGM,encounter,encounters:data.encounters.map(e=>({...e,selected:e.id===data.selectedId})),remaining:encounter?.pool.length??0,groups:encounterGroups(encounter,{gm:game.user.isGM})};}
async function action(event,target){
 const name=target.dataset.action,id=target.dataset.participant;
 try{
  if(name==='openActor'){const p=state().encounters.find(e=>e.id===state().selectedId)?.participants.find(p=>p.id===id);const token=p?.tokenUuid?await fromUuid(p.tokenUuid):null;const actor=token?.actor??await fromUuid(p.actorUuid);if(actor?.isOwner)await actor.sheet.render({force:true});return;}
  if(name==='createEncounter'){const label=await foundry.applications.api.DialogV2.prompt({window:{title:'New encounter'},content:'<label>Name <input name="name" value="Encounter" required></label>',ok:{label:'Create',callback:(_e,b)=>b.form.elements.name.value.trim()},rejectClose:false});if(!label)return;await write(data=>{const e=newEncounter(foundry.utils.randomID(),label);data.encounters.push(e);data.selectedId=e.id;});return;}
  if(name==='selectEncounter'){await write(data=>{data.selectedId=target.dataset.encounter;});return;}
  if(name==='deleteEncounter'){if(!await foundry.applications.api.DialogV2.confirm({window:{title:'Delete encounter'},content:'<p>Delete this FUS encounter?</p>',rejectClose:false}))return;await write(data=>{data.encounters=data.encounters.filter(e=>e.id!==data.selectedId);data.selectedId=data.encounters[0]?.id??'';});return;}
  await write(async data=>{
   let index=data.encounters.findIndex(e=>e.id===data.selectedId);if(index<0 && name==='addTokens'){const e=newEncounter(foundry.utils.randomID());data.encounters.push(e);data.selectedId=e.id;index=data.encounters.length-1;}if(index<0)throw new Error('Add selected tokens to begin.');
   data.encounters[index]=normalizeEncounter(data.encounters[index]);
   if(name==='addTokens'){const selected=canvas.tokens?.controlled??[];if(!selected.length)throw new Error('Select tokens on the canvas first.');for(const token of selected){if(!token.actor || data.encounters[index].participants.some(p=>p.tokenUuid===token.document.uuid))continue;data.encounters[index].participants.push({id:foundry.utils.randomID(),name:token.name,img:token.document.texture.src,actorUuid:token.actor.uuid,tokenUuid:token.document.uuid,hidden:token.document.hidden,incapacitated:token.actor.system.hp<=0,ignored:false});const added=data.encounters[index].participants.at(-1);if(data.encounters[index].round&&!added.incapacitated)data.encounters[index].pool.push(added.id);}return;}
   if(['start','next','setTurn'].includes(name))for(const p of data.encounters[index].participants){const token=p.tokenUuid?await fromUuid(p.tokenUuid):null;const actor=token?.actor??(p.actorUuid?await fromUuid(p.actorUuid):null);if(actor)p.incapacitated=actor.system.hp<=0;}
   data.encounters[index]=transitionEncounter(data.encounters[index],name,{id});
  });
  if(name==='addTokens')await openEncounters();
 }catch(error){reportError(error);}
}
const actions=Object.fromEntries(['openActor','createEncounter','selectEncounter','deleteEncounter','addTokens','start','stop','next','ignore','remove','setTurn'].map(key=>[key,action]));
export class FUSEncountersSidebar extends HandlebarsApplicationMixin(AbstractSidebarTab){
 async renderPopout(){await openEncounters();return this;}
 static tabName='combat';
 static DEFAULT_OPTIONS={id:'combat',classes:['fus-encounters-tab'],actions};
 static PARTS={body:{template:'systems/FUS/templates/encounters.hbs',scrollable:['.fus-encounters']}};
 async _prepareContext(){return {...await context(),sidebar:true};}
 async _onRender(...args){await super._onRender(...args);views.add(this);const positions=new Map();for(const card of this.element.querySelectorAll('.fus-token-card')){const rect=card.getBoundingClientRect(),previous=this._tokenPositions?.get(card.dataset.participant);positions.set(card.dataset.participant,rect);if(previous&&!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches&&(previous.x!==rect.x||previous.y!==rect.y))card.animate?.([{transform:`translate(${previous.x-rect.x}px,${previous.y-rect.y}px)`},{transform:'translate(0,0)'}],{duration:400,easing:'ease-out'});}this._tokenPositions=positions;const select=this.element.querySelector('[data-encounter-select]');select?.addEventListener('change',async()=>{try{await write(data=>{data.selectedId=select.value;});}catch(error){reportError(error);}});}
}
export async function openEncounters(){await ui.sidebar?.activateTab?.('combat');if(ui.combat&&!ui.combat.rendered)await ui.combat.render({force:true});}
export function registerEncounters(){
 game.settings.register('FUS','encounters',{scope:'world',config:false,type:Object,default:{selectedId:'',encounters:[]},onChange:refresh});
 CONFIG.ui.combat=FUSEncountersSidebar;
 const tabs=CONFIG.ui.sidebar?.TABS??foundry.applications.sidebar.Sidebar.TABS;
 if(tabs?.combat)tabs.combat={...tabs.combat,icon:'fa-solid fa-swords',tooltip:'FUS Encounters'};
 Hooks.on('renderTokenHUD',(app,html)=>mountEncounterHUD(app,html?.querySelector?html:html?.[0]));
 Hooks.on('preCreateCombat',()=>{ui.notifications.info('Use the FUS Encounters tab.');return false;});
 Hooks.on('preCreateCombatant',()=>false);
 Hooks.on('preUpdateCombat',()=>false);
 Hooks.on('renderApplicationV2',app=>{if(app.constructor.name==='TokenHUD')mountEncounterHUD(app,app.element);});
 Hooks.on('renderSidebar',()=>{const button=document.querySelector('[data-tab="combat"]');if(button){button.title='FUS Encounters';button.setAttribute('aria-label','FUS Encounters');const icon=button.querySelector('i');if(icon)icon.className='fa-solid fa-swords';}});
}

export async function updateEncounterHealth(actor){
 if(!game.user.isGM || (game.users?.activeGM && game.users.activeGM.id!==game.user.id))return;
 await write(data=>{for(let i=0;i<data.encounters.length;i++){
  const e=normalizeEncounter(data.encounters[i]);
  for(const p of e.participants)if(p.actorUuid===actor.uuid || (actor.token?.uuid && p.tokenUuid===actor.token.uuid)){
   const was=p.incapacitated;p.incapacitated=actor.system.hp<=0;
   if(p.incapacitated){e.pool=e.pool.filter(id=>id!==p.id);e.active=e.active.filter(id=>id!==p.id);}
   else if(was&&!p.ignored&&e.round&&!e.drawn.includes(p.id)&&!e.pool.includes(p.id))e.pool.push(p.id);
  }
  data.encounters[i]=e;
 }});
}

export async function toggleEncounterToken(token){if(!game.user.isGM)throw new Error('The GM manages encounter tokens.');await write(data=>{let i=data.encounters.findIndex(e=>e.id===data.selectedId);if(i<0){const e=newEncounter(foundry.utils.randomID());data.encounters.push(e);data.selectedId=e.id;i=data.encounters.length-1;}const e=normalizeEncounter(data.encounters[i]),existing=e.participants.find(p=>p.tokenUuid===token.uuid);if(existing){data.encounters[i]=transitionEncounter(e,'remove',{id:existing.id});return;}if(!token.actor)throw new Error('This token has no actor.');e.participants.push({id:foundry.utils.randomID(),name:token.name,img:token.texture.src,actorUuid:token.actor.uuid,tokenUuid:token.uuid,hidden:token.hidden,incapacitated:token.actor.system.hp<=0,ignored:false});if(e.round&&token.actor.system.hp>0)e.pool.push(e.participants.at(-1).id);data.encounters[i]=e;});await openEncounters();}
function mountEncounterHUD(app,root){if(!root?.querySelector)return;root.querySelectorAll('[data-action="toggleCombat"],[data-action="combat"],[data-control="combat"]').forEach(node=>node.remove());const token=app?.document??app?.object?.document??app?.object;if(!token||root.querySelector('[data-fus-encounter]'))return;const column=root.querySelector('.col.right')??root;
 if(game.user.isGM){const button=document.createElement('button');button.type='button';button.className='control-icon';button.dataset.fusEncounter='';button.title='Add selected tokens to FUS encounter';button.innerHTML='<i class="fa-solid fa-swords" aria-hidden="true"></i>';button.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();const selected=canvas.tokens?.controlled??[];if(selected.length)action({},{dataset:{action:'addTokens'}});else toggleEncounterToken(token).catch(reportError);},true);column.append(button);}
 if((token.isOwner||token.actor?.isOwner||game.user.isGM)&&!root.querySelector('.fus-pin-controls')){const row=document.createElement('div');row.className='fus-pin-controls control-icon';row.innerHTML='<button type="button" aria-label="Remove pin">−</button><span class="badge"></span><button type="button" aria-label="Add pin">+</button>';const display=row.querySelector('span');display.textContent=String(token.flags?.FUS?.pins??0);display.setAttribute('aria-label','Pins');row.querySelectorAll('button').forEach(button=>button.classList.add('control-icon'));row.querySelectorAll('button').forEach((button,index)=>button.addEventListener('click',async e=>{e.preventDefault();e.stopImmediatePropagation();try{const count=await game.FUS.changePins(token,index?1:-1);display.textContent=String(count);}catch(error){reportError(error);}},true));for(const type of ['pointerdown','mousedown','pointerup','mouseup','dblclick','contextmenu'])row.addEventListener(type,e=>{e.preventDefault();e.stopPropagation();},true);root.append(row);}
}
