import {reconcileHands} from './equipment.mjs';
import {SKILLS} from './config.mjs';
import {baselineForm} from './forms.mjs';
import {escapeHTML} from './rolls.mjs';
export function validateSetup(draft){
 let spent=0;for(const key of Object.keys(SKILLS)){const rank=Number(draft.skills[key]??0);if(!Number.isInteger(rank)||rank<0||rank>3)throw new Error('Starting skill ranks must be 0–3.');spent+=rank;}
 if(spent>4)throw new Error('Starting characters have four skill points.');
 let focusSpent=0;for(const focus of draft.focuses){if(!focus.name.trim()||!Object.hasOwn(SKILLS,focus.skill)||!Number.isInteger(focus.rank)||focus.rank<1||focus.rank>2)throw new Error('Each starting Focus needs a name, a skill and rank 1–2.');focusSpent+=focus.rank;}
 if(focusSpent>7)throw new Error('Starting characters have seven Focus points.');
 if(!draft.name.trim())throw new Error('Enter a character name.');return {skillRemaining:4-spent,focusRemaining:7-focusSpent};
}
export async function applySetup(actor,draft){
 if(!actor.isOwner)throw new Error('You do not own this character.');validateSetup(draft);let form=draft.formId?actor.items.get(draft.formId):[...actor.items].find(i=>i.type==='form'&&i.name==='Baseline');if(draft.formId&&form?.type!=='form')throw new Error('The chosen Form is no longer available.');if(!form)[form]=await actor.createEmbeddedDocuments('Item',[baselineForm()]);
 const previous={name:actor.name,system:structuredClone(actor.toObject().system)};await actor.setFlag('FUS','characterSetupBackup',previous);
 const changes={name:draft.name.trim(),'system.role':draft.role??'','system.skills':draft.skills,'system.focuses':draft.focuses,'system.formItemId':form.id};
 try{await actor.update(changes);await reconcileHands(actor);}catch(error){await actor.update(previous);throw error;}
}
const openWizards=new WeakMap();
export async function openCharacterWizard(actor){if(!actor.isOwner)throw new Error('You do not own this character.');let wizard=openWizards.get(actor);if(!wizard){const {FUSCharacterWizard}=await import('./wizard-ui.mjs');wizard=new FUSCharacterWizard({document:actor});openWizards.set(actor,wizard);}await wizard.render({force:true});return wizard;}
export async function resetCharacter(actor){
 if(!actor.isOwner)throw new Error('You do not own this character.');
 const confirmed=await foundry.applications.api.DialogV2.confirm({window:{title:'Reset character'},content:'<p>Reset skills, Focuses, role and Form to Baseline, restore base HP, and stow equipment? Items, notes and memories remain. A setup backup is saved on this actor.</p>',rejectClose:false});if(!confirmed)return;
 const previous={name:actor.name,system:structuredClone(actor.toObject().system)};await actor.setFlag('FUS','characterSetupBackup',previous);
 let form=[...actor.items].find(i=>i.type==='form'&&i.name==='Baseline');if(!form)[form]=await actor.createEmbeddedDocuments('Item',[baselineForm()]);
 const items=[...actor.items].filter(i=>['weapon','armour','item'].includes(i.type)),snapshot=items.map(i=>({_id:i.id,'system.carryState':i.system.carryState??'stowed','system.handsHeld':i.system.handsHeld??0,...(i.type==='armour'?{'system.equipped':!!i.system.equipped}:{})}));
 try{await actor.updateEmbeddedDocuments('Item',items.map(i=>({_id:i.id,'system.carryState':'stowed','system.handsHeld':0,...(i.type==='armour'?{'system.equipped':false}:{})})));await actor.update({'system.skills':Object.fromEntries(Object.keys(SKILLS).map(k=>[k,0])),'system.focuses':[],'system.role':'','system.formItemId':form.id,'system.hp':form.system.maxhp??6});}catch(error){await actor.updateEmbeddedDocuments('Item',snapshot);await actor.update(previous);throw error;}
 ui.notifications.info('Character reset to Baseline.');
}
