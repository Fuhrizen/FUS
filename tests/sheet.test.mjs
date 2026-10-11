import test from 'node:test';
import assert from 'node:assert/strict';
const messages=[];
class BaseSheet {
  async _prepareContext(){return {};}
  _processFormData(event,form,data){return structuredClone(data.object);}
  async _processSubmitData(event,form,data){await data.run();}
}
let nextId=0;
globalThis.foundry={utils:{randomID:()=>`focus-${++nextId}`},applications:{api:{HandlebarsApplicationMixin:cls=>cls,ApplicationV2:BaseSheet},sidebar:{AbstractSidebarTab:BaseSheet,Sidebar:{TABS:{}}},sheets:{ActorSheetV2:BaseSheet}},dice:{Roll:class {
  constructor(formula,data){this.formula=formula;this.data=data;}
  async evaluate(){this.evaluated=true;}
  async toMessage(message){assert.ok(this.evaluated);messages.push({formula:this.formula,data:this.data,message});}
}},documents:{Combat:class {},ChatMessage:{getSpeaker:({actor})=>({actor:actor.id})}}};
globalThis.ui={notifications:{error:message=>{throw new Error(message);}}};
const {FUSCharacterSheet:Sheet}=await import('../scripts/character-sheet.mjs');
const {SKILLS}=await import('../scripts/config.mjs');
function sheet(){
  const s=new Sheet();s.isEditable=true;s._focusManagement=true;s.id='test';s.element={reportValidity:()=>true};
  s.document={id:'actor1',uuid:'Actor.actor1',type:'character',isOwner:true,name:'Tester',img:'portrait.png',system:{skills:Object.fromEntries(Object.keys(SKILLS).map(k=>[k,0])),focuses:[]},async update(data){
    for(const [path,value] of Object.entries(data)){const bits=path.split('.');const last=bits.pop();let o=this;for(const bit of bits)o=o[bit];o[last]=value;}
  }};
  s.submit=async()=>{};s._focusDialog=async(index,draft)=>{s.lastFocusEditor=index;if(draft)await s._createFocus(draft,{name:draft.name,skill:draft.skill,rank:String(draft.rank)});};return s;
}
const action=(s,data)=>Sheet.onAction.call(s,{}, {dataset:data});
test('skill adjustments have no cap or floor',async()=>{
  const s=sheet();s.document.system.skills.athletics=3;
  await action(s,{action:'adjust',kind:'skill',key:'athletics',delta:'1'});assert.equal(s.document.system.skills.athletics,4);
  s.document.system.skills.athletics=0;
  await action(s,{action:'adjust',kind:'skill',key:'athletics',delta:'-1'});assert.equal(s.document.system.skills.athletics,-1);
});
test('focus add, adjustment and popup removal persist arrays',async()=>{
  const s=sheet();await action(s,{action:'addFocus',key:'rangedCombat'});
  await action(s,{action:'adjust',kind:'focus',index:'0',delta:'-1'});assert.equal(s.document.system.focuses[0].rank,-1);
  await s._changeFocus(s.document.system.focuses[0].id,{action:'delete'});assert.deepEqual(s.document.system.focuses,[]);
});
test('hidden focus data survives expanded form conversion',()=>{
  const s=sheet();const data=s._processFormData(null,null,{object:{system:{focuses:{0:{name:'Bows',skill:'rangedCombat',rank:2}},notes:'Keep'}}});
  assert.equal(data.system.focuses[0].name,'Bows');assert.equal(data.system.notes,'Keep');
  assert.deepEqual(s._processFormData(null,null,{object:{system:{notes:'Keep'}}}).system.focuses,[]);
});
test('all skill labels roll with saved values',async()=>{
  const s=sheet();
  for(const key of Object.keys(SKILLS)){await s._roll('skill',key);assert.equal(messages.at(-1).formula,'2d10 + @skill');}
});
test('focus roll includes exactly its parent and own rank and escapes labels',async()=>{
  const s=sheet();s.document.system.skills.rangedCombat=3;s.document.system.focuses=[{name:'<img src=x>',skill:'rangedCombat',rank:2}];
  await s._roll('focus',null,0);const result=messages.at(-1);
  assert.equal(result.formula,'2d10 + @skill + @focus');assert.deepEqual(result.data,{skill:3,focus:2});assert.ok(result.message.flavor.includes('&lt;img'));assert.equal(result.message.speaker.actor,'actor1');
});
test('roll action saves pending edits before reading values',async()=>{
  const s=sheet();s.submit=async()=>{s.document.system.skills.athletics=7;};
  await action(s,{action:'roll',kind:'skill',key:'athletics'});assert.equal(messages.at(-1).data.skill,7);
});
test('read-only sheets cannot change values or roll',async()=>{
  const s=sheet();s.isEditable=false;const before=messages.length;
  await action(s,{action:'adjust',kind:'skill',key:'athletics',delta:'1'});await action(s,{action:'roll',kind:'skill',key:'athletics'});
  assert.equal(s.document.system.skills.athletics,0);assert.equal(messages.length,before);
});
test('autosaves execute in order',async()=>{
  const s=sheet();const order=[];let release;const gate=new Promise(r=>release=r);
  const a=s._processSubmitData(null,null,{run:async()=>{order.push('start1');await gate;order.push('end1');}});
  const b=s._processSubmitData(null,null,{run:async()=>order.push('save2')});
  await Promise.resolve();release();await Promise.all([a,b]);assert.deepEqual(order,['start1','end1','save2']);
});
test('selected tab is retained in render context and totals are sums',async()=>{
  const s=sheet();s.element={querySelectorAll:()=>[]};Sheet.selectSection.call(s,{}, {dataset:{section:'notes'}});
  s.document.system.skills.athletics=5;s.document.system.focuses=[{rank:3}];
  const context=await s._prepareContext({});assert.ok(context.notesActive);assert.equal(context.skillAssigned,5);assert.equal(context.focusAssigned,3);
});

test('grouped focuses retain global indexes and compute combined bonus', async()=>{
  const s=sheet();s.document.system.skills.rangedCombat=4;
  s.document.system.focuses=[{name:'Bow',skill:'rangedCombat',rank:2},{name:'Climb',skill:'athletics',rank:1},{name:'Rifle',skill:'rangedCombat',rank:3}];
  const c=await s._prepareContext({});
  const ranged=c.skillGroups.flatMap(g=>g.rows).find(r=>r.key==='rangedCombat');
  assert.deepEqual(ranged.focuses.map(f=>f.index),[0,2]);assert.deepEqual(ranged.focuses.map(f=>f.total),['+6','+7']);
  await action(s,{action:'addFocus',key:'medicine'});assert.equal(s.document.system.focuses.at(-1).skill,'medicine');assert.ok(s.document.system.focuses.at(-1).id);
});
test('Main, Actions and Inventory tabs are selectable',async()=>{
  const s=sheet();s.element={querySelectorAll:()=>[]};
  for(const section of ['main','actions','inventory']) {
    Sheet.selectSection.call(s,{}, {dataset:{section}});
    const context=await s._prepareContext({});assert.ok(context[section+'Active']);
  }
});
test('HP form values cap current when entering HP or lowering maximum',()=>{
  const s=sheet();
  for(const [hp,maxhp,expected] of [[120,100,100],[90,40,40],[-5,100,-5],[123456,200000,123456]]) {
    const result=s._processFormData(null,null,{object:{system:{hp,maxhp}}});assert.equal(result.system.hp,expected);
  }
});

const {numericInput}=await import('../scripts/numeric.mjs');
test('signed entries adjust and unsigned entries replace',()=>{
  assert.equal(numericInput('-10',50),40);assert.equal(numericInput('+10',50),60);
  assert.equal(numericInput('10',50),10);assert.equal(numericInput('-2',0),-2);
  assert.equal(numericInput('+0.5',1),1.5);assert.throws(()=>numericInput('abc',1));
});
test('negative ranks do not reduce assigned totals',async()=>{
  const s=sheet();s.document.system.skills.athletics=-5;s.document.system.skills.ride=3;
  s.document.system.focuses=[{skill:'ride',rank:-4},{skill:'ride',rank:2}];
  const c=await s._prepareContext({});assert.equal(c.skillAssigned,3);assert.equal(c.focusAssigned,2);
});
test('signed input is applied once across repeated submissions',()=>{
  const s=sheet();s.document.system.hp=50;
  const input={name:'system.hp',value:'-10',defaultValue:'50',dataset:{numericDirty:'true'}};
  const form={querySelectorAll:()=>[input]};
  let data=s._processFormData(null,form,{object:{'system.hp':'-10',system:{maxhp:100}}});
  assert.equal(data['system.hp'],40);s.document.system.hp=40;
  data=s._processFormData(null,form,{object:{'system.hp':'40',system:{maxhp:100}}});assert.equal(data['system.hp'],40);
  s.document.system.hp=-5;input.value='-5';input.defaultValue='-5';
  data=s._processFormData(null,form,{object:{'system.hp':'-5',system:{maxhp:100}}});assert.equal(data['system.hp'],-5);
});
const {DEFAULT_ORDER, SKILL_GROUPS}=await import('../scripts/config.mjs');
const {rollActor, createRollMacro, onHotbarDrop}=await import('../scripts/rolls.mjs');
test('logical groups contain every skill exactly once',()=>{
  assert.equal(DEFAULT_ORDER.length,15);assert.equal(new Set(DEFAULT_ORDER).size,15);
  assert.deepEqual([...DEFAULT_ORDER].sort(),Object.keys(SKILLS).sort());
});


test('popup deletion preserves the identity of remaining focuses',async()=>{
  const s=sheet();s.document.system.focuses=[{id:'a',skill:'ride',rank:0},{id:'x',skill:'medicine',rank:0},{id:'b',skill:'ride',rank:2}];
  await s._changeFocus('b',{action:'delete'});assert.deepEqual(s.document.system.focuses.map(f=>f.id),['a','x']);
});
test('search matches parent and child names without removing saved form fields',()=>{
  const s=sheet();const make=(label,names)=>({dataset:{label},hidden:false,focuses:names.map(name=>({dataset:{focusLabel:name},hidden:false})),querySelectorAll(){return this.focuses;}});
  const ranged=make('Ranged Combat',['Bow','Rifle']), ride=make('Ride',['Horses']);
  const groups=[{hidden:false,querySelectorAll:()=>[ranged]},{hidden:false,querySelectorAll:()=>[ride]}];const empty={};
  s.element={querySelectorAll:sel=>sel==='[data-skill]'?[ranged,ride]:groups,querySelector:()=>empty};
  s._search=' RIFLE ';s._filterSkills();assert.equal(ranged.hidden,false);assert.equal(ride.hidden,true);assert.deepEqual(ranged.focuses.map(f=>f.hidden),[true,false]);assert.equal(empty.hidden,true);
  s._search='absent';s._filterSkills();assert.equal(empty.hidden,false);
  s._search='';s._filterSkills();assert.ok(groups.every(g=>!g.hidden));assert.equal(ranged.focuses.length,2);
});
test('drag payload carries actor UUID and stable focus reference',()=>{
  const s=sheet();s.document.system.focuses=[{id:'focusA',skill:'ride',rank:2}];let payload;
  const event={dataTransfer:{setData:(type,data)=>{assert.equal(type,'text/plain');payload=JSON.parse(data);}}};
  s._dragRoll(event,{dataset:{kind:'focus',index:'0'}});assert.deepEqual(payload,{type:'FUSRoll',actorUuid:'Actor.actor1',kind:'focus',focusId:'focusA'});
});
test('macro uses live bonuses after focus rename and reorder, and fails after deletion',async()=>{
  const s=sheet();s.document.system.focuses=[{id:'a',name:'Bow',skill:'ride',rank:2},{id:'b',name:'Climb',skill:'athletics',rank:1}];
  globalThis.fromUuid=async()=>s.document;
  const macros=[];let assigned;
  globalThis.game={macros,user:{assignHotbarMacro:async(macro,slot)=>{assigned={macro,slot};}}};
  foundry.documents.Macro={create:async data=>{const macro={...data,isOwner:true};macros.push(macro);return macro;}};
  const data={type:'FUSRoll',actorUuid:s.document.uuid,kind:'focus',focusId:'a'};
  const macro=await createRollMacro(data,4);assert.equal(assigned.slot,4);assert.ok(macro.command.includes('"focusId":"a"'));
  await createRollMacro(data,5);assert.equal(macros.length,1);
  s.document.system.focuses.reverse();s.document.system.focuses[1].name='Horse';s.document.system.focuses[1].rank=7;s.document.system.skills.ride=4;
  await rollActor(s.document,{kind:'focus',focusId:'a'});assert.deepEqual(messages.at(-1).data,{skill:4,focus:7});assert.ok(messages.at(-1).message.flavor.includes('Horse'));
  s.document.system.focuses.pop();await assert.rejects(rollActor(s.document,{kind:'focus',focusId:'a'}),/no longer exists/);
});
test('legacy macro persists stable focus IDs before array removal',async()=>{
  const s=sheet();s.document.system.focuses=[{name:'A',skill:'ride',rank:0},{name:'B',skill:'ride',rank:3}];
  globalThis.fromUuid=async()=>s.document;
  await createRollMacro({type:'FUSRoll',actorUuid:s.document.uuid,kind:'focus',focusId:'legacy-1'},2);
  assert.deepEqual(s.document.system.focuses.map(f=>f.id),['legacy-0','legacy-1']);
  s.document.system.focuses.shift();await rollActor(s.document,{kind:'focus',focusId:'legacy-1'});assert.equal(messages.at(-1).data.focus,3);
});
test('foreign hotbar drops pass through and permission checks reject unauthorised macros',async()=>{
  assert.equal(onHotbarDrop(null,{type:'Item'},1),undefined);
  const s=sheet();s.document.isOwner=false;globalThis.fromUuid=async()=>s.document;
  await assert.rejects(createRollMacro({type:'FUSRoll',actorUuid:s.document.uuid,kind:'skill',key:'ride'},1),/cannot create/);
});

test('hotbar drop cancels default handling immediately and assigns asynchronously',async()=>{
  const s=sheet();globalThis.fromUuid=async()=>s.document;let assigned=false;
  game.user.assignHotbarMacro=async()=>{assigned=true;};
  const result=onHotbarDrop(null,{type:'FUSRoll',actorUuid:s.document.uuid,kind:'skill',key:'ride'},3);
  assert.equal(result,false);await new Promise(resolve=>setImmediate(resolve));assert.equal(assigned,true);
});

test('fixed grouping ignores old favourite and ordering preferences',async()=>{
  const s=sheet();s.document.system.favorites=['skill:medicine'];s.document.system.skillOrder=['rangedCombat','meleeCombat'];
  const c=await s._prepareContext({});assert.deepEqual(c.skillGroups.map(g=>g.id),SKILL_GROUPS.map(g=>g.id));
  assert.deepEqual(c.skillGroups.flatMap(g=>g.rows).map(r=>r.key),DEFAULT_ORDER);
  assert.equal(Sheet.DEFAULT_OPTIONS.actions.favorite,undefined);assert.equal(Sheet.DEFAULT_OPTIONS.actions.skillMenu,undefined);
});
test('Acrobatics retains previous Mobility ranks, focus parent and macro keys',async()=>{
  const s=sheet();s.document.system.skills.mobility=4;s.document.system.focuses=[{id:'acro',name:'Tumble',skill:'mobility',rank:2}];
  const c=await s._prepareContext({});const row=c.skillGroups.flatMap(g=>g.rows).find(r=>r.label==='Acrobatics');
  assert.equal(row.key,'mobility');assert.equal(row.rank,4);assert.equal(row.focuses[0].total,'+6');
  await s._roll('skill','mobility');assert.equal(messages.at(-1).data.skill,4);assert.ok(messages.at(-1).message.flavor.includes('Acrobatics'));
  await rollActor(s.document,{kind:'focus',focusId:'acro'});assert.deepEqual(messages.at(-1).data,{skill:4,focus:2});
});

test('focus editor commits only on Submit and has no Cancel or delete button',async()=>{
  const s=sheet();s.document.system.focuses=[{id:'a',name:'Bow',skill:'rangedCombat',rank:3}];let config;
  foundry.applications.api.DialogV2=class {constructor(options){config=options;} async render(){}};
  await Sheet.prototype._focusDialog.call(s,0);
  assert.deepEqual(config.buttons.map(b=>b.action),['submit']);
  assert.deepEqual(s.document.system.focuses[0],{id:'a',name:'Bow',skill:'rangedCombat',rank:3});
  const fields={focusName:{value:'Rifle'},skill:{value:'athletics'},rank:{value:'-2'}};
  await config.buttons[0].callback({}, {form:{elements:fields}});
  assert.deepEqual(s.document.system.focuses[0],{id:'a',name:'Rifle',skill:'athletics',rank:1});
  assert.equal(config.buttons.some(button=>button.action==='delete'),false);
});
test('invalid submitted bonus does not partially apply name or parent',async()=>{
  const s=sheet();s.document.system.focuses=[{id:'a',name:'Bow',skill:'ride',rank:3}];
  await assert.rejects(s._changeFocus('a',{action:'submit',name:'Changed',skill:'athletics',rank:'bad',originalRank:3}));
  assert.deepEqual(s.document.system.focuses,[{id:'a',name:'Bow',skill:'ride',rank:3}]);
});
test('submitting unchanged negative bonus preserves it rather than subtracting again',async()=>{
  const s=sheet();s.document.system.focuses=[{id:'a',name:'Bow',skill:'ride',rank:-2}];
  await s._changeFocus('a',{action:'submit',name:'Bow',skill:'ride',rank:'-2',originalRank:-2});
  assert.equal(s.document.system.focuses[0].rank,-2);
});

test('focus row deletion asks confirmation and Cancel preserves the focus',async()=>{
  const s=sheet();s.document.system.focuses=[{id:'a',name:'<Bow>',skill:'ride',rank:2}];let prompt;
  foundry.applications.api.DialogV2.confirm=async options=>{prompt=options;return false;};
  await action(s,{action:'removeFocus',index:'0'});assert.equal(s.document.system.focuses.length,1);assert.ok(prompt.content.includes('&lt;Bow&gt;'));
  foundry.applications.api.DialogV2.confirm=async()=>true;await action(s,{action:'removeFocus',index:'0'});assert.deepEqual(s.document.system.focuses,[]);
});
test('tab order is Main Actions Skills Inventory Memory Notes and Memory survives render',async()=>{
  const s=sheet();s.element={querySelectorAll:()=>[]};Sheet.selectSection.call(s,{}, {dataset:{section:'memory'}});
  const c=await s._prepareContext({});assert.deepEqual(c.sections.map(tab=>tab.label),['Main','Actions','Skills','Inventory','Memory','Notes']);assert.equal(c.memoryActive,true);
});
test('collapsed filtered memories retain full fields during autosave',()=>{
  const s=sheet();const data=s._processFormData(null,null,{object:{system:{memories:{1:{id:'b',title:'B',content:'Hidden content',tags:'event'},0:{id:'a',title:'A',content:'Visible',tags:'character'}}}}});
  assert.deepEqual(data.system.memories.map(entry=>entry.id),['a','b']);assert.equal(data.system.memories[1].content,'Hidden content');
});
const {parseTags,tagColour,tagStyle,memoryScore,memoryRows}=await import('../scripts/memory.mjs');
test('CSV tags support quoted commas, escaped quotes and case-insensitive deduplication',()=>{
  assert.deepEqual(parseTags('character, Event, character, "New York, city", "a ""quote""", ,'),['character','Event','New York, city','a "quote"']);
});
test('tag colours are deterministic and validated manual overrides control contrast',()=>{
  assert.equal(tagColour('Event'),tagColour('event'));assert.match(tagColour('event'),/^#[0-9a-f]{6}$/);
  assert.equal(tagColour('event',[{tag:'EVENT',colour:'#123456'}]),'#123456');assert.ok(tagStyle('event',[{tag:'event',colour:'#000000'}]).includes('color:#ffffff'));
  assert.notEqual(tagColour('event',[{tag:'event',colour:'red;display:none'}]),'red;display:none');
});
test('memory search covers content, title, CSV tags, phrases, accents and related partial matches',()=>{
  const entry={title:'The Queen',content:'The café held a secret meeting near the bridge.',tags:'character, event'};
  for(const query of ['queen','cafe','event','"secret meeting"','tag:"character"','queen missing'])assert.ok(memoryScore(entry,query)>0,query);
  assert.equal(memoryScore(entry,'tag:place'),0);assert.equal(memoryScore(entry,'absent'),0);
  assert.ok(memoryScore(entry,'queen bridge')>memoryScore(entry,'queen missing'));
});
test('memories normally sort by title and search ranks strong matches first without losing indexes',()=>{
  const entries=[{id:'z',title:'Zulu',content:'queen',tags:''},{id:'a',title:'Alpha Queen',content:'',tags:'character'}];
  assert.deepEqual(memoryRows(entries).map(entry=>entry.id),['a','z']);assert.deepEqual(memoryRows(entries,'queen').map(entry=>entry.index),[1,0]);
  const rows=memoryRows(entries,'',[],new Set(['z']));assert.equal(rows.find(entry=>entry.id==='z').open,true);
});
test('memory creation stays a draft until Submit and deletion is confirmed',async()=>{
  const s=sheet();let config;foundry.applications.api.DialogV2=class {constructor(options){config=options;} async render(){}};
  await action(s,{action:'addMemory'});assert.deepEqual(s.document.system.memories??[],[]);assert.equal(config.buttons[0].callback,undefined);
  await config.buttons[1].callback({}, {form:{elements:{memoryTitle:{value:'Bridge'},entryContent:{value:'Remember the key.'},tags:{value:'event character'}}}});
  const entry=s.document.system.memories[0];assert.ok(entry.id);assert.ok(s._openMemories.has(entry.id));assert.equal(entry.tags,'event, character');
  foundry.applications.api.DialogV2.confirm=async()=>false;await action(s,{action:'removeMemory',index:'0'});assert.equal(s.document.system.memories.length,1);
  foundry.applications.api.DialogV2.confirm=async()=>true;await action(s,{action:'removeMemory',index:'0'});assert.deepEqual(s.document.system.memories,[]);
});
test('post to chat saves edits first and escapes title body and tags',async()=>{
  const s=sheet();let result;foundry.documents.ChatMessage.create=async data=>{result=data;};
  s.submit=async()=>{s.document.system.memories=[{id:'a',title:'<script>',content:'Fresh <img>\nNext line',tags:'<event>'}];};
  await action(s,{action:'postMemory',index:'0'});assert.ok(result.content.includes('&lt;script&gt;'));assert.ok(result.content.includes('Fresh &lt;img&gt;<br>Next line'));assert.ok(result.content.includes('&lt;event&gt;'));assert.equal(result.speaker.actor,'actor1');
});
test('tag colour settings automatically disable Automatic and persist manual choices',async()=>{
  const s=sheet();s.document.system.memories=[{id:'a',title:'A',tags:'event',content:''}];let config;const auto={checked:true},events={};
  const colour={dataset:{colourIndex:'0'},addEventListener:(name,fn)=>{events[name]=fn;}};
  foundry.applications.api.DialogV2=class {constructor(options){config=options;this.element={querySelectorAll:()=>[colour],querySelector:()=>auto};} async _onRender(){} async render(){await this._onRender();}};
  await action(s,{action:'tagSettings'});assert.equal(auto.checked,true);events.input();assert.equal(auto.checked,false);
  auto.checked=true;events.change();assert.equal(auto.checked,false);
  await config.buttons[1].callback({}, {form:{elements:{auto0:auto,colour0:{value:'#445566'}}}});assert.deepEqual(s.document.system.tagColours,[{tag:'event',colour:'#445566'}]);
});
test('empty tag settings notify without a dialog even when old overrides exist',async()=>{
  const s=sheet();s.document.system.memories=[];s.document.system.tagColours=[{tag:'old',colour:'#112233'}];let notification,opened=false;
  ui.notifications.info=text=>{notification=text;};foundry.applications.api.DialogV2.wait=async()=>{opened=true;};
  await action(s,{action:'tagSettings'});assert.equal(notification,'Create a tag on a note first!');assert.equal(opened,false);
});
test('blank focus names show numbered defaults that keep increasing after deletion',async()=>{
  const s=sheet();await action(s,{action:'addFocus',key:'ride'});let focus=s.document.system.focuses[0];assert.equal(focus.name,'');assert.equal(focus.defaultName,'new focus (1)');
  await s._changeFocus(focus.id,{action:'delete'});await action(s,{action:'addFocus',key:'ride'});focus=s.document.system.focuses[0];assert.equal(focus.defaultName,'new focus (2)');
  const c=await s._prepareContext({});assert.equal(c.skillGroups.flatMap(g=>g.rows).find(r=>r.key==='ride').focuses[0].displayName,'new focus (2)');
  await s._roll('focus',null,0);assert.ok(messages.at(-1).message.flavor.includes('new focus (2)'));
});
test('space and comma separated tags generate the same safe coloured boxes',()=>{
  const s=sheet();assert.deepEqual(parseTags('event character, clue'),['event','character','clue']);
  const html=s._tagBoxes('event character <evil>');assert.equal((html.match(/class="fus-tag"/g)??[]).length,3);assert.ok(html.includes('&lt;evil&gt;'));assert.ok(html.includes('background-color:#'));
});
test('memory edit Cancel leaves data untouched and Submit updates only its stable entry',async()=>{
  const s=sheet();s.document.system.memories=[{id:'a',title:'Original',content:'Keep',tags:'event'},{id:'b',title:'Other',content:'Other',tags:''}];let config;
  foundry.applications.api.DialogV2=class {constructor(options){config=options;} async render(){}};
  await action(s,{action:'editMemory',index:'0'});assert.equal(s.document.system.memories[0].title,'Original');assert.equal(config.buttons[0].callback,undefined);
  s.document.system.memories.reverse();await config.buttons[1].callback({}, {form:{elements:{memoryTitle:{value:'Changed'},entryContent:{value:'New text'},tags:{value:'character event'}}}});
  assert.equal(s.document.system.memories[1].title,'Changed');assert.equal(s.document.system.memories[0].title,'Other');
});
test('dragged document references insert at the caret without saving the draft',async()=>{
  const s=sheet();const inserted=[];const textarea={value:'Before After',selectionStart:7,selectionEnd:7,focus(){},setSelectionRange(a,b){this.selectionStart=a;this.selectionEnd=b;},dispatchEvent(event){inserted.push(event.type);}};
  foundry.applications.ux={TextEditor:{getDragEventData:event=>event.data,getContentLink:async data=>`@UUID[${data.uuid}]{Reference}`}};
  for(const uuid of ['Actor.a','Item.b','JournalEntry.c','JournalEntry.c.JournalEntryPage.d','Compendium.world.notes.JournalEntry.c']){
    textarea.value='Before After';textarea.selectionStart=7;textarea.selectionEnd=7;
    await s._dropMemoryReference({data:{uuid}},textarea);assert.equal(textarea.value,`Before @UUID[${uuid}]{Reference}After`);
  }
  assert.equal(inserted.length,5);assert.deepEqual(s.document.system.memories??[],[]);
  delete foundry.applications.ux;
});
test('memory enrichment escapes HTML and enables document references without inline rolls',async()=>{
  const {enrichMemory}=await import('../scripts/memory.mjs');let input,options;
  foundry.applications.ux={TextEditor:{enrichHTML:async(html,config)=>{input=html;options=config;return html.replace('@UUID[Actor.a]{Alaric}','<a class="content-link">Alaric</a>');}}};
  const result=await enrichMemory('<script>\n@UUID[Actor.a]{Alaric}',{});assert.ok(input.includes('&lt;script&gt;<br>'));assert.ok(result.includes('content-link'));assert.equal(options.documents,true);assert.equal(options.rolls,false);
  delete foundry.applications.ux;
});
test('chat memory tags retain manual colours as boxes',async()=>{
  const s=sheet();s.document.system.memories=[{id:'a',title:'A',content:'Body',tags:'event'}];s.document.system.tagColours=[{tag:'event',colour:'#336699'}];let result;
  foundry.documents.ChatMessage.create=async data=>{result=data;};await action(s,{action:'postMemory',index:'0'});assert.ok(result.content.includes('class="fus-tag"'));assert.ok(result.content.includes('background-color:#336699;'));
});
test('dropping on a reading entry opens a reference draft without changing the saved note',async()=>{
  const s=sheet();s.document.system.memories=[{id:'a',title:'A',content:'Keep',tags:''}];let draft;
  foundry.applications.ux={TextEditor:{getDragEventData:()=>({uuid:'Item.x'}),getContentLink:async()=> '@UUID[Item.x]{Sword}'}};
  s._memoryDialog=async(memory,reference)=>{draft={memory,reference};};
  await s._dropOnMemory({},'a');assert.equal(draft.reference,'@UUID[Item.x]{Sword}');assert.equal(s.document.system.memories[0].content,'Keep');assert.equal(s._fusBusy,false);
  delete foundry.applications.ux;
});

test('main cog toggles focus controls without saving and blocks hidden Add/Delete actions',async()=>{
  const s=sheet();s._focusManagement=false;let toggled,pressed;
  s.element={querySelector:()=>({classList:{toggle:(name,value)=>{toggled=value;}}}),reportValidity:()=>true};
  await action(s,{action:'addFocus',key:'ride'});assert.equal(s.document.system.focuses.length,0);
  Sheet.toggleFocusControls.call(s,{}, {setAttribute:(key,value)=>{pressed=value;}});assert.equal(toggled,true);assert.equal(pressed,'true');
  await action(s,{action:'addFocus',key:'ride'});assert.equal(s.document.system.focuses.length,1);
  Sheet.toggleFocusControls.call(s,{}, {setAttribute:()=>{}});assert.equal(s._focusManagement,false);
  const context=await s._prepareContext({});assert.equal(context.focusManagement,false);
});
const {setupTagEntry}=await import('../scripts/tag-entry.mjs');
test('tag entry commits chips inside the control, supports removal and preserves unfinished text',()=>{
  const element=()=>({children:[],style:{},listeners:{},append(...items){this.children.push(...items);},replaceChildren(){this.children=[];},addEventListener(name,fn){this.listeners[name]=fn;},setAttribute(){}});
  const hidden={value:'event'},input={...element(),value:'',focus(){}},boxes=element(),control=element();
  control.querySelector=selector=>selector==='[name="tags"]'?hidden:selector==='[data-tag-entry]'?input:boxes;
  const root={querySelector:()=>control,ownerDocument:{createElement:element,createTextNode:text=>({text})}};
  setupTagEntry(root,[{tag:'event',colour:'#336699'}]);assert.equal(boxes.children.length,1);assert.ok(boxes.children[0].style.cssText.includes('#336699'));
  input.value='character ';input.listeners.input();assert.equal(input.value,'');assert.equal(boxes.children.length,2);assert.equal(hidden.value,'event, character');
  input.value='clue';input.listeners.input();assert.equal(hidden.value,'event, character, clue');assert.equal(boxes.children.length,2);
  input.listeners.blur();assert.equal(boxes.children.length,3);
  boxes.children[1].children[1].listeners.click();assert.equal(hidden.value,'event, clue');
  input.listeners.keydown({key:'Backspace'});assert.equal(input.value,'clue');assert.equal(boxes.children.length,1);
});

test('closing a new focus draft leaves focuses and counter unchanged',async()=>{
  const s=sheet();let draft;s._focusDialog=async(index,entry)=>{draft=entry;};
  await action(s,{action:'addFocus',key:'ride'});assert.equal(draft.name,'');assert.equal(draft.defaultName,'new focus (1)');assert.deepEqual(s.document.system.focuses,[]);assert.equal(s.document.system.focusCounter,undefined);
  await s._createFocus(draft,{name:'Riding',skill:'ride',rank:'2'});assert.equal(s.document.system.focuses[0].name,'Riding');assert.equal(s.document.system.focusCounter,1);
});


test('assigning a compendium Form creates one owned copy and preserves character values',async()=>{
  const s=sheet();s.document.items=[];s.document.system.hp=7;s.document.system.maxhp=10;const before=structuredClone(s.document.system);let creates=0;
  const item={type:'form',uuid:'Compendium.FUS.baseline.Item.fusHumanBaseline',toObject:()=>({_id:'fusHumanBaseline',name:'Baseline',type:'form',system:{move:15,maxhp:null},flags:{}})};
  s.document.createEmbeddedDocuments=async(type,[source])=>{creates++;assert.equal(type,'Item');assert.equal(source._id,undefined);const owned={...source,id:'owned',uuid:'Actor.actor1.Item.owned',getFlag:(scope,key)=>source.flags[scope]?.[key]};s.document.items.push(owned);return [owned];};
  await s._assignForm(item);assert.equal(s.document.system.formItemId,'owned');assert.deepEqual({...s.document.system,formItemId:undefined},{...before,formItemId:undefined});
  await s._assignForm(item);assert.equal(creates,1);assert.equal(s.document.items[0].flags.core.sourceId,item.uuid);
});
test('Form assignment rejects other item types and read-only sheets',async()=>{
  const s=sheet();s.document.createEmbeddedDocuments=()=>assert.fail('must not create');await s._assignForm({type:'weapon'});s.isEditable=false;await s._assignForm({type:'form'});assert.equal(s.document.system.formItemId,undefined);
});
test('blank Form overrides remain inherited defaults',async()=>{
  foundry.applications.sheets.ItemSheetV2=BaseSheet;const {FUSFormSheet}=await import('../scripts/form-sheet.mjs');const s=new FUSFormSheet();
  const result=s._processFormData(null,null,{object:{'system.move':'','system.description':'Text','system.maxhp':''}});
  assert.equal(result['system.move'],null);assert.equal(result['system.maxhp'],null);assert.equal(result['system.description'],'Text');
});

test('Forms are unique per character and an explicit maximum caps HP without healing',async()=>{
  const item={type:'form',uuid:'Item.human',toObject:()=>({_id:'human',name:'Human',type:'form',system:{maxhp:8,move:15,rules:'Human rules'},flags:{}})};
  const actors=[sheet(),sheet()];
  for(const [index,s] of actors.entries()){
    s.document.items=[];s.document.system.hp=index?3:12;s.document.system.maxhp=20;
    s.document.createEmbeddedDocuments=async(type,[source])=>{const owned={...source,id:`owned${index}`,uuid:`Actor.${index}.Item.owned`,getFlag:(scope,key)=>source.flags[scope]?.[key]};s.document.items.push(owned);return [owned];};
    await s._assignForm(item);
  }
  assert.equal(actors[0].document.system.hp,8);assert.equal(actors[1].document.system.hp,3);assert.equal(actors[0].document.system.maxhp,8);
  actors[0].document.items[0].system.rules='Personal rules';assert.equal(actors[1].document.items[0].system.rules,'Human rules');
});
test('applied Form supplies Main details and protects max HP during sheet saves',async()=>{
  const s=sheet();s.document.system.formItemId='form';s.document.items=[{id:'form',type:'form',name:'Human',system:{maxhp:10,move:15,description:'Person',rules:'Rule'}}];
  const context=await s._prepareContext({});assert.equal(context.selectedFormName,'Human');assert.equal(context.formDetails.moveDisplay,15);assert.equal(context.formOptions,undefined);
  const result=s._processFormData(null,null,{object:{system:{hp:15,maxhp:100}}});assert.equal(result.system.maxhp,10);assert.equal(result.system.hp,10);
});
test('legacy Form notes and movement migrate while removed fields stay absent',async()=>{
  const {migrateFormData}=await import('../scripts/forms.mjs');const source={system:{description:'Original',defaults:{move:10,equipLimit:3,traumaThreshold:4},physiology:'Breathing rule',source:'p9'}};
  migrateFormData(source);assert.equal(source.system.move,10);assert.equal(source.system.carryLimit,undefined);assert.equal(source.system.maxhp,null);assert.ok(source.system.rules.includes('Breathing rule'));assert.ok(source.system.rules.includes('Equip Limit: 3'));
  source.system.rules='Edited';migrateFormData(source);assert.equal(source.system.rules,'Edited');
});
test('clearing an owned Form maximum retains its previous value',async()=>{
 const {FUSFormSheet}=await import('../scripts/form-sheet.mjs');const s=new FUSFormSheet();s.document={parent:{},system:{maxhp:12}};
 const result=s._processFormData(null,null,{object:{'system.maxhp':''}});assert.equal(result['system.maxhp'],12);
});
test('editing an applied Form persists maximum HP and caps current HP without healing',async()=>{
  const hooks={};globalThis.Hooks={on:(name,fn)=>{hooks[name]=fn;},once:()=>{}};foundry.abstract={TypeDataModel:class {prepareBaseData(){}prepareDerivedData(){}}};globalThis.game={user:{id:'editor'}};
  await import('../scripts/fus.mjs');
  const s=sheet();s.document.system.formItemId='owned';s.document.system.hp=15;s.document.system.maxhp=20;s.document.items=[{id:'owned',type:'form',system:{maxhp:8}}];
  const item=s.document.items[0];item.parent=s.document;
  await hooks.updateItem(item,{}, {},'editor');assert.equal(s.document.system.hp,8);assert.equal(s.document.system.maxhp,8);
  item.system.maxhp=25;await hooks.updateItem(item,{}, {},'editor');assert.equal(s.document.system.hp,8);assert.equal(s.document.system.maxhp,25);
  const changes={'system.hp':40,'system.maxhp':100};hooks.preUpdateActor(s.document,changes);assert.equal(changes['system.hp'],25);assert.equal(changes['system.maxhp'],25);
});
test('derived actor data reads the unique owned Form maximum',async()=>{
 const {FUSCharacterData}=await import('../scripts/model.mjs');const data=new FUSCharacterData();data.hp=12;data.maxhp=20;data.parent={system:{formItemId:'f'},items:[{id:'f',type:'form',system:{maxhp:9}}]};
 data.prepareDerivedData();assert.equal(data.maxhp,9);assert.equal(data.hp,9);
});
test('every inventory drop creates an independent owned copy with a source reference',async()=>{
  const s=sheet();s.document.items=[];let count=0;
  s.document.createEmbeddedDocuments=async(type,[source])=>{assert.equal(type,'Item');assert.equal(source._id,undefined);assert.equal(source.folder,null);const owned={...source,id:`copy${++count}`};s.document.items.push(owned);return [owned];};
  const source={_id:'source',folder:'world-folder',name:'Rope',type:'item',img:'rope.svg',system:{description:'A rope'},flags:{}};
  const item={type:'item',uuid:'Item.source',toObject:()=>structuredClone(source)};
  const a=await s._copyInventoryItem(item),b=await s._copyInventoryItem(item);assert.notEqual(a.id,b.id);a.system.description='Cut rope';assert.equal(b.system.description,'A rope');assert.equal(source.system.description,'A rope');assert.equal(a.flags.core.sourceId,'Item.source');
});
test('inventory accepts Item, Weapon and Armour but rejects Forms and read-only writes',async()=>{
  const s=sheet();let creates=0;s.document.createEmbeddedDocuments=async(type,[source])=>{creates++;return [source];};
  for(const type of ['item','weapon','armour'])await s._copyInventoryItem({type,uuid:`Item.${type}`,toObject:()=>({type,system:{description:''}})});
  await s._copyInventoryItem({type:'form'});s.isEditable=false;await s._copyInventoryItem({type:'item'});assert.equal(creates,3);
});
test('inventory removal confirms and targets only the requested owned item',async()=>{
  const s=sheet();s.document.items=[{id:'a',type:'item',name:'<Rope>'},{id:'f',type:'form',name:'Baseline'}];let confirmation,deletions=[];
  s.document.deleteEmbeddedDocuments=async(type,ids)=>{deletions.push({type,ids});};
  foundry.applications.api.DialogV2.confirm=async config=>{confirmation=config;return false;};await s._removeInventoryItem('a');assert.equal(deletions.length,0);assert.ok(confirmation.content.includes('&lt;Rope&gt;'));
  foundry.applications.api.DialogV2.confirm=async()=>true;await s._removeInventoryItem('a');assert.deepEqual(deletions,[{type:'Item',ids:['a']}]);await s._removeInventoryItem('f');assert.equal(deletions.length,1);
});
test('inventory context includes only inventory types sorted by title',async()=>{
 const s=sheet();s.document.items=[{id:'b',type:'weapon',name:'Sword',img:'sword.svg',system:{description:'Blade'}},{id:'f',type:'form',name:'Baseline',system:{}},{id:'a',type:'armour',name:'Coat',img:'coat.svg',system:{description:'Cloth'}}];
 const context=await s._prepareContext({});assert.deepEqual(context.inventoryRows.map(i=>i.id),['a','b']);assert.equal(context.inventoryRows[0].typeLabel,'Armour');assert.equal(context.inventoryRows[1].description,'Blade');
});
test('read-only inventory can open an item without submitting character data',async()=>{
 const s=sheet();s.isEditable=false;let opened=false;s.submit=()=>assert.fail('must not save');s.document.items=[{id:'a',type:'item',sheet:{render:async()=>{opened=true;}}}];await action(s,{action:'openInventoryItem',itemId:'a'});assert.equal(opened,true);
});
const {inventoryGroups,quantity}=await import('../scripts/inventory.mjs');
function transferSetup(amount){
 const s=sheet();s.document.name='Recipient';s.document.items=[];let deleted=false;
 const source={type:'character',uuid:'Actor.source',isOwner:true,deleteEmbeddedDocuments:async(type,ids)=>{assert.deepEqual(ids,['sourceItem']);deleted=true;}};
 const item={id:'sourceItem',uuid:'Actor.source.Item.sourceItem',name:'Rope',type:'item',parent:source,system:{description:'Unique rope',quantity:5},toObject(){return {name:this.name,type:this.type,system:structuredClone(this.system)};},async update(data){this.system.quantity=data['system.quantity'];}};
 s.document.createEmbeddedDocuments=async(type,[data])=>{const owned={...data,id:'recipientItem'};s.document.items.push(owned);return [owned];};s.document.deleteEmbeddedDocuments=async()=>{s.document.items=[];};
 foundry.applications.api.DialogV2.wait=async()=>amount;
 return {s,item,source,deleted:()=>deleted};
}
test('quantity defaults and categories preserve zero and separate all types',()=>{
 assert.equal(quantity({system:{}}),1);assert.equal(quantity({system:{quantity:0}}),0);assert.equal(quantity({system:{quantity:-1}}),1);
 const groups=inventoryGroups({items:[{id:'w',name:'Sword',type:'weapon',system:{quantity:2}},{id:'f',name:'Form',type:'form',system:{}},{id:'i',name:'Rope',type:'item',system:{}}]});assert.deepEqual(groups.map(g=>g.label),['Weapons','Armour','Items']);assert.equal(groups[0].rows[0].quantity,2);assert.equal(groups[1].rows.length,0);assert.equal(groups[2].rows[0].quantity,1);
});
test('partial transfers preserve total quantity and independent item data',async()=>{
 const {s,item,deleted}=transferSetup(2);const owned=await s._transferInventoryItem(item);assert.equal(item.system.quantity,3);assert.equal(owned.system.quantity,2);assert.equal(deleted(),false);owned.system.description='Changed';assert.equal(item.system.description,'Unique rope');
});
test('full transfers remove the source only after destination creation',async()=>{
 const {s,item,source,deleted}=transferSetup(5);source.deleteEmbeddedDocuments=async()=>{assert.equal(s.document.items.length,1);};await s._transferInventoryItem(item);assert.equal(s.document.items[0].system.quantity,5);
});
test('cancelled, invalid and unauthorized transfers do not create copies',async()=>{
 for(const amount of [null,false,0,6,1.5]){const {s,item}=transferSetup(amount);await s._transferInventoryItem(item);assert.equal(s.document.items.length,0);assert.equal(item.system.quantity,5);}
 const {s,item,source}=transferSetup(2);let warned;ui.notifications.warn=text=>{warned=text;};source.isOwner=false;await s._transferInventoryItem(item);assert.ok(warned.includes('ownership'));assert.equal(s.document.items.length,0);
});
test('failed source updates roll back the destination copy',async()=>{
 const {s,item}=transferSetup(2);item.update=async()=>{throw new Error('Source failed');};await assert.rejects(s._transferInventoryItem(item),/Source failed/);assert.equal(s.document.items.length,0);assert.equal(item.system.quantity,5);
});
test('failed destination creation leaves source untouched',async()=>{
 const {s,item,deleted}=transferSetup(5);s.document.createEmbeddedDocuments=async()=>{throw new Error('Destination failed');};await assert.rejects(s._transferInventoryItem(item),/Destination failed/);assert.equal(item.system.quantity,5);assert.equal(deleted(),false);
});
test('quantity controls update owned items and reject invalid values',async()=>{
 const s=sheet();const item={id:'a',type:'item',system:{quantity:1},async update(data){this.system.quantity=data['system.quantity'];}};s.document.items=[item];
 await action(s,{action:'adjustItemQuantity',itemId:'a',delta:'-1'});assert.equal(item.system.quantity,0);await action(s,{action:'adjustItemQuantity',itemId:'a',delta:'-1'});assert.equal(item.system.quantity,0);await s._setItemQuantity('a',3);assert.equal(item.system.quantity,3);
 await s._setItemQuantity('a',-1);await s._setItemQuantity('a',1.5);s.isEditable=false;await s._setItemQuantity('a',10);assert.equal(item.system.quantity,3);
});
test('dropping an item back on its source sheet does nothing',async()=>{
 const {s,item}=transferSetup(5);item.parent.uuid=s.document.uuid;foundry.applications.ux={TextEditor:{getDragEventData:()=>({type:'Item',uuid:item.uuid})}};foundry.documents.Item={fromDropData:async()=>item};await s._dropInventoryItem({});assert.equal(s.document.items.length,0);delete foundry.applications.ux;
});
test('selected Form cannot be removed and retains all health values',async()=>{
 const s=sheet();s.document.items=[{id:'old',type:'form',name:'Old',system:{maxhp:10}}];s.document.system.formItemId='old';
 await assert.rejects(()=>s._removeForm(),/always have a Form/);assert.equal(s.document.system.formItemId,'old');
});

test('Form replacement removes previous owned Form after applying new maximum',async()=>{
 const s=sheet();s.document.system={...s.document.system,hp:8,maxhp:10,formItemId:'old'};s.document.items=[{id:'old',type:'form',system:{maxhp:10}}];s.document.createEmbeddedDocuments=async(type,[source])=>{const item={...source,id:'new'};s.document.items.push(item);return [item];};s.document.deleteEmbeddedDocuments=async(type,ids)=>{assert.equal(s.document.system.formItemId,'new');s.document.items=s.document.items.filter(i=>!ids.includes(i.id));};
 await s._assignForm({type:'form',uuid:'Item.new',toObject:()=>({type:'form',system:{maxhp:5},flags:{}})});assert.deepEqual(s.document.items.map(i=>i.id),['new']);assert.equal(s.document.system.hp,5);
});
test('adding weapon or armour component preserves scroll and focuses new value',async()=>{
 const {FUSItemSheet}=await import('../scripts/item-sheet.mjs');
 for(const type of ['armour']){
  const key=type==='weapon'?'damage':'adjustments';const s=new FUSItemSheet();s.isEditable=true;s.element={querySelector:()=>({scrollTop:270})};s.document={type,system:{[key]:[{type:'heat',formula:'2'}]},update:async(data,options)=>{assert.equal(options.render,false);s.document.system[key]=data[`system.${key}`];}};s.submit=async()=>{};s.render=async()=>{assert.equal(s._scrollPosition,270);assert.equal(s._focusComponent,1);};
  await FUSItemSheet.editComponent.call(s,{}, {dataset:{action:'addComponent'}});assert.equal(s.document.system[key].length,2);assert.equal(s._componentBusy,false);
 }
});
test('inventory armour equip toggles persist and reject wrong types or read-only edits',async()=>{
 const s=sheet();s.document.isOwner=true;const armour={id:'armour',parent:s.document,type:'armour',system:{equipped:false},update:async data=>{armour.system.equipped=data['system.equipped'];}};s.document.items=[armour,{id:'weapon',type:'weapon',system:{}}];
 await action(s,{action:'toggleArmourEquip',itemId:'armour'});assert.equal(armour.system.equipped,true);
 await action(s,{action:'toggleArmourEquip',itemId:'armour'});assert.equal(armour.system.equipped,false);
 await action(s,{action:'toggleArmourEquip',itemId:'weapon'});s.isEditable=false;await action(s,{action:'toggleArmourEquip',itemId:'armour'});assert.equal(armour.system.equipped,false);
});
test('inventory rows expose weapon and armour controls with live equip state',async()=>{
 const {inventoryGroups}=await import('../scripts/inventory.mjs');const groups=inventoryGroups({items:[{id:'a',type:'armour',name:'Plate',system:{equipped:true}},{id:'w',type:'weapon',name:'Pistol',system:{}}]});
 assert.equal(groups.find(g=>g.type==='armour').rows[0].equipped,true);assert.equal(groups.find(g=>g.type==='weapon').rows[0].weapon,true);
});
test('inventory weapon damage saves actor edits and posts configured typed damage',async()=>{
 const s=sheet();const OriginalRoll=foundry.dice.Roll;const originalCreate=foundry.documents.ChatMessage.create;let posted;
 foundry.dice.Roll=class{static validate(){return true;}constructor(formula){this.formula=formula;}async evaluate(){this.total=4;}};foundry.documents.ChatMessage.create=async data=>{posted=data;};
 try{const weapon={id:'w',type:'weapon',name:'Pistol',parent:s.document,system:{weaponActions:[{id:'fire',name:'Fire',cost:1,damageComponents:[{type:'piercing',formula:'1d6'}]}]}};s.document.items=[weapon];let saved=false;s.submit=async()=>{saved=true;};await action(s,{action:'rollInventoryDamage',itemId:'w'});assert.equal(saved,true);assert.equal(posted.flags.FUS.kind,'damage');assert.equal(posted.flags.FUS.components[0].total,4);assert.ok(posted.content.includes('Pistol'));}finally{foundry.dice.Roll=OriginalRoll;foundry.documents.ChatMessage.create=originalCreate;}
});
test('item reorder preserves action IDs and component formulas',async()=>{
 const {FUSItemSheet}=await import('../scripts/item-sheet.mjs');const s=new FUSItemSheet();s.isEditable=true;s.submit=async()=>{};s.render=async()=>{};s.document={system:{weaponActions:[{id:'a',focusId:'focus',resourceAmount:-1},{id:'b'}],adjustments:[{type:'heat',formula:'1d6'},{type:'cold',formula:'2'}]},update:async(data)=>{for(const [key,value]of Object.entries(data))s.document.system[key.split('.')[1]]=value;}};
 await FUSItemSheet.moveEntry.call(s,{}, {dataset:{list:'weaponActions',index:'0',direction:'1'}});assert.equal(s.document.system.weaponActions[1].focusId,'focus');await FUSItemSheet.moveEntry.call(s,{}, {dataset:{list:'adjustments',index:'1',direction:'-1'}});assert.equal(s.document.system.adjustments[0].formula,'2');
});
