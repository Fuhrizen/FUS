import test from 'node:test';
import assert from 'node:assert/strict';
import {rememberAction,forgetAction,linkedActions,migrateSourceActions,executeActionAutomation} from '../scripts/action-library.mjs';
import {actorCreationDefaults} from '../scripts/actor-types.mjs';
import {preventFormRemoval,validFormSelection,ensureActorForm} from '../scripts/forms.mjs';
let serial=0;const definitions=[];
globalThis.game={items:definitions,user:{can:()=>true},macros:[]};
globalThis.foundry={utils:{randomID:()=>`id${++serial}`},documents:{Item:{create:async data=>{const item={...data,uuid:`Item.${++serial}`};definitions.push(item);return item;}}}};
test('two sources resolve one live definition and changes propagate without altering ammo',()=>{
 const definition={type:'action',uuid:'Item.fire',name:'Fire (5.56)',system:{action:{cost:1,damageComponents:[{type:'piercing',formula:'2'}]}}};rememberAction(definition);
 const a={system:{resourceCurrent:7,actionLinks:[{id:'a',uuid:definition.uuid}]}},b={system:{resourceCurrent:2,actionLinks:[{id:'b',uuid:definition.uuid}]}};
 assert.equal(linkedActions(a)[0].damageComponents[0].formula,'2');definition.system.action.damageComponents[0].formula='3';assert.equal(linkedActions(b)[0].damageComponents[0].formula,'3');assert.equal(a.system.resourceCurrent,7);assert.equal(b.system.resourceCurrent,2);
 forgetAction(definition);assert.equal(linkedActions(a)[0].missing,true);
});
test('legacy migration deduplicates shared definitions, keeps link IDs and owner Focus, and is idempotent',async()=>{
 const action={id:'old',name:'Fire',mode:'test',focusId:'focus',focusActorUuid:'Actor.a',modifier:2,damageComponents:[{type:'piercing',formula:'2'}]};
 const source=()=>({system:{weaponActions:[structuredClone(action)],actionLinks:[]},async update(d){for(const [k,v]of Object.entries(d))this.system[k.split('.')[1]]=v;}});
 const a=source(),b=source(),map=new Map();await migrateSourceActions(a,map);await migrateSourceActions(b,map);assert.equal(a.system.actionLinks[0].uuid,b.system.actionLinks[0].uuid);assert.equal(a.system.actionLinks[0].id,'old');assert.equal(a.system.actionLinks[0].focusId,'focus');const count=definitions.length;await migrateSourceActions(a,map);assert.equal(definitions.length,count);assert.deepEqual(a.system.weaponActions,[]);
});
test('automation receives source and captured targets and refuses script execution without permission',async()=>{
 const actor={},source={},targets=[{name:'Target'}],message={id:'chat'};
 await executeActionAutomation(actor,source,{script:'source.result = [actor, targets[0].name, message.id];'},targets,message);assert.deepEqual(source.result,[actor,'Target','chat']);
 game.user.can=()=>false;await assert.rejects(()=>executeActionAutomation(actor,source,{script:'source.bad = true;'},targets,message),/permission/);assert.equal(source.bad,undefined);game.user.can=()=>true;
 let passed;globalThis.fromUuid=async()=>({documentName:'Macro',canExecute:true,execute:async context=>{passed=context;}});await executeActionAutomation(actor,source,{macroUuid:'Macro.test'},targets,message);assert.equal(passed.source,source);assert.equal(passed.targets,targets);
});
test('new actors always start with a selected Form and custom imported Forms are preserved',()=>{
 let saved;actorCreationDefaults({type:'character',updateSource:d=>saved=d},{});const form=saved.items[0];assert.equal(form.name,'Baseline');assert.equal(form.system.maxhp,6);assert.equal(saved['system.formItemId'],form._id);
 actorCreationDefaults({type:'npc',updateSource:d=>saved=d},{items:[{_id:'custom',type:'form',system:{maxhp:9}}],system:{formItemId:'custom'}});assert.equal(saved.items.length,1);assert.equal(saved['system.formItemId'],'custom');
});
test('Form removal and clearing are rejected, replacement remains valid, repair selects existing Form',async()=>{
 const form={id:'f',type:'form',system:{maxhp:6}},actor={isOwner:true,items:[form],system:{formItemId:'f'}};form.parent=actor;assert.equal(preventFormRemoval(form),false);assert.equal(validFormSelection(actor,{'system.formItemId':''}),false);assert.equal(validFormSelection(actor,{'system.formItemId':'f'}),true);actor.system.formItemId='';actor.update=async d=>{actor.system.formItemId=d['system.formItemId'];};await ensureActorForm(actor);assert.equal(actor.system.formItemId,'f');
});

test('hotbar action macros resolve current source and definition data each time',async()=>{
 const {createActionMacro,actionMacro}=await import('../scripts/rolls.mjs');const definition={type:'action',uuid:'Item.hotbarFire',name:'Fire',system:{action:{cost:1,mode:'none'}}};rememberAction(definition);const source={id:'weapon',name:'Rifle',img:'rifle.png',system:{actionLinks:[{id:'fire',uuid:definition.uuid}]}},actor={uuid:'Actor.hotbar',isOwner:true,items:new Map([['weapon',source]])};source.parent=actor;const docs=new Map([[actor.uuid,actor],[definition.uuid,definition]]);globalThis.fromUuid=async uuid=>docs.get(uuid);let slot;game.user.assignHotbarMacro=async(m,s)=>{slot=s;};foundry.documents.Macro={create:async data=>({...data,isOwner:true})};const macro=await createActionMacro({actorUuid:actor.uuid,sourceId:'weapon',actionId:'fire'},5);assert.equal(slot,5);assert.ok(macro.command.includes('game.FUS.actionMacro'));let seen;game.FUS={executeWeaponAction:async(a,s,id)=>{seen=[a,s,linkedActions(s).find(row=>row.id===id).cost];}};definition.system.action.cost=3;await actionMacro({actorUuid:actor.uuid,sourceId:'weapon',actionId:'fire'});assert.deepEqual(seen,[actor,source,3]);
});
