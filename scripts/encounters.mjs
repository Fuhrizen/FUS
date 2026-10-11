import {newEncounter,transitionEncounter,normalizeEncounter} from './encounter-model.mjs';
const {HandlebarsApplicationMixin,ApplicationV2}=foundry.applications.api;
const {AbstractSidebarTab}=foundry.applications.sidebar;
let queue=Promise.resolve();const views=new Set();
function reportError(error){console.error('FUS Encounters:',error);try{ui.notifications.error(error.message);}catch(notificationError){console.error('FUS notification failed:',notificationError);}}
const state=()=>game.settings.get('FUS','encounters');
let popupEncounter=null;
export async function syncEncounterPopup(data=state()){
 const encounter=data.encounters.find(e=>e.id===data.selectedId),key=encounter?.round>0?encounter.id:null;
 const changed=key!==popupEncounter;popupEncounter=key;
 if(!changed)return;
 if(key && game.settings.get('FUS','autoEncounterPopup')!==false){if(!game.FUS?.encountersPopup?.rendered)await openEncounters();}
 else if(!key && game.FUS?.encountersPopup?.rendered)await game.FUS.encountersPopup.close();
}
const refresh=async data=>{try{for(const view of views)if(view.rendered)await view.render({force:true});await syncEncounterPopup(data);}catch(error){reportError(error);}};
async function write(change){const task=queue.catch(()=>{}).then(async()=>{if(!game.user.isGM)throw new Error('The GM manages the encounter.');const data=structuredClone(state());await change(data);await game.settings.set('FUS','encounters',data);});queue=task;return task;}
async function context(){const data=state(),raw=data.encounters.find(e=>e.id===data.selectedId),encounter=raw?normalizeEncounter(raw):null;return {gm:game.user.isGM,encounter,encounters:data.encounters.map(e=>({...e,selected:e.id===data.selectedId})),remaining:encounter?.pool.length??0,participants:(encounter?.participants??[]).filter(p=>game.user.isGM||!p.hidden).map(p=>({...p,active:encounter.active.includes(p.id),drawn:encounter.drawn.includes(p.id)}))};}
async function action(event,target){
 const name=target.dataset.action,id=target.dataset.participant;
 try{
  if(name==='popout'){await openEncounters();return;}
  if(name==='openActor'){const p=state().encounters.find(e=>e.id===state().selectedId)?.participants.find(p=>p.id===id);const token=p?.tokenUuid?await fromUuid(p.tokenUuid):null;const actor=token?.actor??await fromUuid(p.actorUuid);if(actor?.isOwner)await actor.sheet.render({force:true});return;}
  if(name==='createEncounter'){const label=await foundry.applications.api.DialogV2.prompt({window:{title:'New encounter'},content:'<label>Name <input name="name" value="Encounter" required></label>',ok:{label:'Create',callback:(_e,b)=>b.form.elements.name.value.trim()},rejectClose:false});if(!label)return;await write(data=>{const e=newEncounter(foundry.utils.randomID(),label);data.encounters.push(e);data.selectedId=e.id;});return;}
  if(name==='selectEncounter'){await write(data=>{data.selectedId=target.dataset.encounter;});return;}
  if(name==='deleteEncounter'){if(!await foundry.applications.api.DialogV2.confirm({window:{title:'Delete encounter'},content:'<p>Delete this FUS encounter?</p>',rejectClose:false}))return;await write(data=>{data.encounters=data.encounters.filter(e=>e.id!==data.selectedId);data.selectedId=data.encounters[0]?.id??'';});return;}
  await write(async data=>{
   let index=data.encounters.findIndex(e=>e.id===data.selectedId);if(index<0 && name==='addTokens'){const e=newEncounter(foundry.utils.randomID());data.encounters.push(e);data.selectedId=e.id;index=data.encounters.length-1;}if(index<0)throw new Error('Add selected tokens to begin.');
   data.encounters[index]=normalizeEncounter(data.encounters[index]);
   if(name==='addTokens'){const selected=canvas.tokens?.controlled??[];if(!selected.length)throw new Error('Select tokens on the canvas first.');for(const token of selected){if(!token.actor || data.encounters[index].participants.some(p=>p.tokenUuid===token.document.uuid))continue;data.encounters[index].participants.push({id:foundry.utils.randomID(),name:token.name,img:token.document.texture.src,actorUuid:token.actor.uuid,tokenUuid:token.document.uuid,hidden:token.document.hidden,incapacitated:token.actor.system.hp<=0,ignored:false});}return;}
   if(['start','next','setTurn'].includes(name))for(const p of data.encounters[index].participants){const token=p.tokenUuid?await fromUuid(p.tokenUuid):null;const actor=token?.actor??(p.actorUuid?await fromUuid(p.actorUuid):null);if(actor)p.incapacitated=actor.system.hp<=0;}
   data.encounters[index]=transitionEncounter(data.encounters[index],name,{id});
  });
  if(name==='addTokens')await openEncounters();
 }catch(error){reportError(error);}
}
const actions=Object.fromEntries(['popout','openActor','createEncounter','selectEncounter','deleteEncounter','addTokens','start','stop','next','ignore','remove','setTurn'].map(key=>[key,action]));
export class FUSEncountersPopup extends HandlebarsApplicationMixin(ApplicationV2){
 static DEFAULT_OPTIONS={id:'fus-encounters-popup',classes:['fus-encounters-window'],position:{width:320,height:340},window:{title:'FUS Encounters',resizable:true},actions};
 static PARTS={body:{template:'systems/FUS/templates/encounters.hbs',scrollable:['.fus-encounters']}};
 async _prepareContext(){return context();}
 async _onRender(...args){await super._onRender(...args);views.add(this);const select=this.element.querySelector('[data-encounter-select]');select?.addEventListener('change',async()=>{try{await write(data=>{data.selectedId=select.value;});}catch(error){reportError(error);}});}
}
export class FUSEncountersSidebar extends HandlebarsApplicationMixin(AbstractSidebarTab){
 static tabName='combat';
 static DEFAULT_OPTIONS={id:'combat',classes:['fus-encounters-tab'],actions};
 static PARTS={body:{template:'systems/FUS/templates/encounters.hbs',scrollable:['.fus-encounters']}};
 async _prepareContext(){return context();}
 async _onRender(...args){await super._onRender(...args);views.add(this);const select=this.element.querySelector('[data-encounter-select]');select?.addEventListener('change',async()=>{try{await write(data=>{data.selectedId=select.value;});}catch(error){reportError(error);}});}
}
export async function openEncounters(){game.FUS.encountersPopup??=new FUSEncountersPopup();const popup=game.FUS.encountersPopup;const firstRender=!popup.rendered;await popup.render({force:true});if(firstRender){const chat=document.querySelector('#sidebar, #ui-right'),bounds=chat?.getBoundingClientRect(),width=320,height=Math.min(340,window.innerHeight-40);popup.setPosition({width,height,left:Math.max(10,(bounds?.left??window.innerWidth)-width-12),top:Math.max(10,window.innerHeight-height-24)});}popup.bringToFront();}
export function registerEncounters(){
 game.settings.register('FUS','autoEncounterPopup',{name:'Show encounter tracker when combat starts',hint:'Automatically open the compact tracker when an encounter starts, including after joining an ongoing encounter.',scope:'client',config:true,type:Boolean,default:true});
 Hooks.once?.('ready',()=>syncEncounterPopup().catch(reportError));
 game.settings.register('FUS','encounters',{scope:'world',config:false,type:Object,default:{selectedId:'',encounters:[]},onChange:refresh});
 CONFIG.ui.combat=FUSEncountersSidebar;
 const tabs=CONFIG.ui.sidebar?.TABS??foundry.applications.sidebar.Sidebar.TABS;
 if(tabs?.combat)tabs.combat={...tabs.combat,icon:'fa-solid fa-dice',tooltip:'FUS Encounters'};
 Hooks.on('renderTokenHUD',(_app,html)=>{const root=html?.querySelector?html:html?.[0];root?.querySelectorAll('[data-action="toggleCombat"],[data-action="combat"],[data-control="combat"]').forEach(node=>node.remove());});
 Hooks.on('preCreateCombat',()=>{ui.notifications.info('Use the FUS Encounters tab.');return false;});
 Hooks.on('preCreateCombatant',()=>false);
 Hooks.on('preUpdateCombat',()=>false);
 Hooks.on('renderApplicationV2',(app)=>{if(app.constructor.name==='TokenHUD'){app.element?.querySelectorAll('[data-action="toggleCombat"],[data-action="combat"],[data-control="combat"]').forEach(node=>node.remove());}});
 Hooks.on('renderSidebar',()=>{const button=document.querySelector('[data-tab="combat"]');if(button){button.title='FUS Encounters';button.setAttribute('aria-label','FUS Encounters');const icon=button.querySelector('i');if(icon)icon.className='fa-solid fa-dice';}});
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
