// Host APIs are explicit fixtures. Application code/templates/styles are production FUS files.
const hooks=new Map();globalThis.Hooks={on(name,fn){const list=hooks.get(name)??[];list.push(fn);hooks.set(name,list);return fn;},off(name,fn){hooks.set(name,(hooks.get(name)??[]).filter(x=>x!==fn));},once(name,fn){this.on(name,fn);}};
const call=(name,...args)=>{for(const fn of hooks.get(name)??[])fn(...args);};
Handlebars.registerHelper('checked',v=>v?'checked':'');
const renderTemplate=async(file,context)=>Handlebars.compile(await (await fetch('/'+file.replace(/^systems\/FUS\//,''))).text())(context);
class App{
 constructor({document}={}){this.document=document;this.id=this.constructor.DEFAULT_OPTIONS?.id??'test-sheet';this.isEditable=true;}
 async _prepareContext(){return {};}
 async _onRender(){}
 async render(){this.rendered=true;this.element??=Object.assign(document.createElement('div'),{id:this.id});this.element.className=(this.constructor.DEFAULT_OPTIONS?.classes??[]).join(' ');this.element.style.position='absolute';if(!this.element.style.width)this.setPosition(this.constructor.DEFAULT_OPTIONS?.position??{left:100,top:60,width:320,height:340});this.element.innerHTML='<header class="window-header">Tracker<button data-close>×</button></header><div class="window-content">'+await renderTemplate(this.constructor.PARTS.body.template,await this._prepareContext())+'</div>';document.body.append(this.element);this.element.addEventListener('click',event=>{const target=event.target.closest('[data-action]');if(target)this.constructor.DEFAULT_OPTIONS.actions[target.dataset.action]?.call(this,event,target);});this.element.querySelector('[data-close]').onclick=()=>this.close();await this._onRender();return this;}
 setPosition(p){for(const key of ['left','top','width','height'])if(p[key]!=null)this.element.style[key]=p[key]+'px';}
 bringToFront(){}
 async close(){this.rendered=false;this.element?.remove();}
}
globalThis.foundry={applications:{api:{ApplicationV2:App,HandlebarsApplicationMixin:C=>C},sheets:{ActorSheetV2:App,ItemSheetV2:App},sidebar:{AbstractSidebarTab:App,Sidebar:{TABS:{combat:{}}}},handlebars:{renderTemplate}},utils:{randomID:()=>crypto.randomUUID().replaceAll('-','').slice(0,16)}};
globalThis.CONFIG={ui:{},statusEffects:[],Canvas:{polygonBackends:{sight:{testCollision:()=>false}}}};
const settingDefinitions=new Map();const settings=new Map([['encounters',{selectedId:'',encounters:[]}],['autoEncounterPopup',false],['ammoTracking',true],['pinAttackPenalty',1]]);
globalThis.game={user:{id:'gm',isGM:true,targets:new Set(),updateTokenTargets(){this.targets.clear();}},users:{activeGM:{id:'gm'}},FUS:{},actors:[],items:[],settings:{register(_s,k,definition){settingDefinitions.set(k,definition);},get:(_s,k)=>settings.get(k),set:async(_s,k,v)=>{settings.set(k,v);await settingDefinitions.get(k)?.onChange?.(v);return v;}}};globalThis.ui={notifications:{error:m=>{throw new Error(m);},info(){}}};
const {SKILLS}=await import('/scripts/config.mjs');
const actor={id:'actor',uuid:'Actor.actor',name:'Test Actor',img:'icons/svg/mystery-man.svg',type:'character',isOwner:true,statuses:new Set(),system:{hp:6,maxhp:6,baseSpeed:15,formItemId:'form',skills:Object.fromEntries(Object.keys(SKILLS).map(k=>[k,0])),focuses:[],memories:[],tagColours:{},notes:''},toggleStatusEffect:async()=>{},async update(data){for(const [key,value]of Object.entries(data))if(key.startsWith('system.'))this.system[key.slice(7)]=value;}};
actor.items=[{id:'form',name:'Baseline',type:'form',system:{maxhp:6,move:15,actionLinks:[],weaponActions:[]}}];actor.items.contents=actor.items;
const doc={id:'origin',uuid:'Scene.s.Token.origin',name:'Actor',actor,isOwner:true,elevation:0,flags:{FUS:{pins:0}},texture:{src:actor.img},async setFlag(_s,k,v){this.flags.FUS[k]=v;}};
globalThis.fromUuid=async uuid=>uuid===doc.uuid?doc:uuid===actor.uuid?actor:null;
const token={name:'Actor',id:'origin',document:doc,actor,isOwner:true,controlled:true,visible:true,x:200,y:250,w:60,h:60,get center(){return {x:this.x+30,y:this.y+30};},bounds:{contains:(x,y)=>x>=200&&x<=260&&y>=250&&y<=310}};doc.object=token;
const target={id:'target',name:'Target',document:{uuid:'Scene.s.Token.target',elevation:0},actor:{uuid:'Actor.target',statuses:new Set()},visible:true,w:60,h:60,center:{x:450,y:280},bounds:{contains:(x,y)=>x>=420&&x<=480&&y>=250&&y<=310},setTarget(active,{releaseOthers}){if(releaseOthers)game.user.targets.clear();if(active)game.user.targets.add(this);else game.user.targets.delete(this);call('targetToken',game.user,this,active);}};
globalThis.canvas={ready:true,level:null,dimensions:{width:1200,height:800},scene:{walls:[{id:'cover',c:[350,100,350,700],flags:{FUS:{cover:2}}}],grid:{units:'ft'}},grid:{size:60,distance:5,units:'ft',measurePath:([a,b])=>({distance:Math.hypot(a.x-b.x,a.y-b.y)/12})},stage:{toGlobal:p=>p,toLocal:p=>p,worldTransform:{a:1,tx:0,ty:0}},tokens:{controlled:[token],placeables:[token,target]}};
const encounters=await import('/scripts/encounters.mjs'),conditions=await import('/scripts/conditions.mjs'),cover=await import('/scripts/cover-preview.mjs');
game.FUS.changePins=conditions.changePins;encounters.registerEncounters();conditions.registerSuppressionEffects();cover.registerCoverPreview();call('canvasReady');call('renderTokenHUD',{document:doc},document.querySelector('#token-hud'));
// Emulate the host's outside-click dismissal; production pin controls must suppress it.
document.addEventListener('pointerdown',e=>{if(e.target.closest('#token-hud'))document.querySelector('#token-hud').dataset.dismissed='true';});
const sidebar=new encounters.FUSEncountersSidebar();sidebar.element=document.querySelector('#sidebar');sidebar.render=async()=>{sidebar.rendered=true;sidebar.element.innerHTML=await renderTemplate('templates/encounters.hbs',await sidebar._prepareContext());sidebar.element.onclick=e=>{const b=e.target.closest('[data-action]');if(b)encounters.FUSEncountersSidebar.DEFAULT_OPTIONS.actions[b.dataset.action]?.call(sidebar,e,b);};await sidebar._onRender();return sidebar;};await sidebar.render();
document.querySelector('[data-tab="combat"]').oncontextmenu=e=>{e.preventDefault();sidebar.renderPopout();};
document.querySelector('#toggle-sidebar').onclick=()=>{const root=document.querySelector('#ui-right'),closed=root.dataset.closed!=='true';root.dataset.closed=String(closed);root.style.width=closed?'40px':'320px';document.querySelector('#sidebar').style.display=closed?'none':'';};
const {FUSCharacterSheet}=await import('/scripts/character-sheet.mjs');const sheet=new FUSCharacterSheet({document:actor});sheet.id='character';
document.querySelector('#open-sheet').onclick=async()=>{const root=document.querySelector('#sheet-host');root.hidden=false;root.classList.add('fus-starter');root.innerHTML=await renderTemplate('templates/character-sheet.hbs',await sheet._prepareContext());sheet.element=root;await sheet._onRender();root.onclick=e=>{const b=e.target.closest('[data-action]');if(b)FUSCharacterSheet.DEFAULT_OPTIONS.actions[b.dataset.action]?.call(sheet,e,b);};};
const {actionTargets}=await import('/scripts/targeting.mjs');
document.querySelector('#target-action').onclick=async()=>{window.targetResult=await actionTargets(actor,{name:'Fire',mode:'test',skill:'rangedCombat',damage:true,targetMode:'required'},{type:'weapon',system:{combatMode:'ranged',optimal:30,maximum:60}});};
const {damageContent}=await import('/scripts/damage-application.mjs');document.querySelector('#chat-host').innerHTML=await damageContent({label:'Damage',components:[{type:'piercing',formula:'2',total:2}],applied:true});
window.fixture={call,token,doc,cover,sidebar,encounters,actor};window.ready=true;
