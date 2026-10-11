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
async function step(title,content,read,label='Continue'){return foundry.applications.api.DialogV2.prompt({window:{title},position:{width:560},content:`<div class="fus-editor-form" style="max-height:60vh;overflow:auto;padding:4px">${content}</div>`,ok:{label,callback:(_event,button)=>read(button.form.elements)},rejectClose:false});}
export async function applySetup(actor,draft){
 if(!actor.isOwner)throw new Error('You do not own this character.');validateSetup(draft);let form=draft.formId?actor.items.get(draft.formId):[...actor.items].find(i=>i.type==='form'&&i.name==='Baseline');if(draft.formId&&form?.type!=='form')throw new Error('The chosen Form is no longer available.');if(!form)[form]=await actor.createEmbeddedDocuments('Item',[baselineForm()]);
 const previous={name:actor.name,system:structuredClone(actor.toObject().system)};await actor.setFlag('FUS','characterSetupBackup',previous);
 const changes={name:draft.name.trim(),'system.identity':draft.identity??'','system.role':draft.role??'','system.affiliation':draft.affiliation??'','system.skills':draft.skills,'system.focuses':draft.focuses,'system.formItemId':form.id};
 try{await actor.update(changes);}catch(error){await actor.update(previous);throw error;}
}
export async function openCharacterWizard(actor){
 if(!actor.isOwner)throw new Error('You do not own this character.');
 const field=(label,name,value='')=>`<label>${label}<input name="${name}" value="${escapeHTML(String(value))}"></label>`;
 const identity=await step('Character setup · 1 of 3',`<p>Set your concept and identity. Nothing changes until the final review.</p>${field('Name','name',actor.name)}${field('Concept','identity',actor.system.identity)}${field('Role','role',actor.system.role)}${field('Affiliation','affiliation',actor.system.affiliation)}`,e=>Object.fromEntries(['name','identity','role','affiliation'].map(k=>[k,e[k].value])));if(!identity)return;
 const options=Object.entries(SKILLS).map(([key,label])=>`<option value="${key}">${label}</option>`).join('');
 const content=`<p>Spend up to 4 skill points (rank 0–3) and 7 Focus points (rank 1–2). Unspent points may be assigned later.</p>${Object.entries(SKILLS).map(([k,label])=>`<label>${label}<input name="${k}" type="number" min="0" max="3" step="1" value="0"></label>`).join('')}<h3>Focuses</h3>${Array.from({length:7},(_,i)=>`<div class="fus-editor-fields">${field('Focus name',`focus${i}`)}<label>Skill<select name="skill${i}">${options}</select></label><label>Rank<input name="rank${i}" type="number" min="1" max="2" step="1" value="1"></label></div>`).join('')}`;
 const allocations=await step('Character setup · 2 of 3',content,e=>({skills:Object.fromEntries(Object.keys(SKILLS).map(k=>[k,Number(e[k].value)])),focuses:Array.from({length:7},(_,i)=>({id:foundry.utils.randomID(),name:e[`focus${i}`].value.trim(),defaultName:'',skill:e[`skill${i}`].value,rank:Number(e[`rank${i}`].value)})).filter(f=>f.name)}));if(!allocations)return;
 const draft={...identity,...allocations},budget=validateSetup(draft),forms=[...actor.items].filter(i=>i.type==='form');
 const choice=await step('Character setup · 3 of 3',`<p><strong>${escapeHTML(draft.name)}</strong>: ${4-budget.skillRemaining}/4 skill points, ${7-budget.focusRemaining}/7 Focus points.</p><label>Form<select name="form"><option value="">Baseline</option>${forms.map(f=>`<option value="${escapeHTML(f.id)}">${escapeHTML(f.name)}</option>`).join('')}</select></label><p>Apply replaces identity, skill ranks, Focuses and selected Form. Equipment, notes, memories and current HP are retained. Weapons must be held before use.</p>`,e=>({formId:e.form.value}),'Apply setup');if(!choice)return;
 await applySetup(actor,{...draft,...choice});ui.notifications.info('Character setup applied.');
}
export async function resetCharacter(actor){
 if(!actor.isOwner)throw new Error('You do not own this character.');
 const confirmed=await foundry.applications.api.DialogV2.confirm({window:{title:'Reset character'},content:'<p>Reset skills, Focuses, identity and Form to Baseline, restore base HP, and stow equipment? Items, notes and memories remain. A setup backup is saved on this actor.</p>',rejectClose:false});if(!confirmed)return;
 const previous={name:actor.name,system:structuredClone(actor.toObject().system)};await actor.setFlag('FUS','characterSetupBackup',previous);
 let form=[...actor.items].find(i=>i.type==='form'&&i.name==='Baseline');if(!form)[form]=await actor.createEmbeddedDocuments('Item',[baselineForm()]);
 const items=[...actor.items].filter(i=>['weapon','armour','item'].includes(i.type)),snapshot=items.map(i=>({_id:i.id,'system.carryState':i.system.carryState??'stowed','system.handsHeld':i.system.handsHeld??0,...(i.type==='armour'?{'system.equipped':!!i.system.equipped}:{})}));
 try{await actor.updateEmbeddedDocuments('Item',items.map(i=>({_id:i.id,'system.carryState':'stowed','system.handsHeld':0,...(i.type==='armour'?{'system.equipped':false}:{})})));await actor.update({'system.skills':Object.fromEntries(Object.keys(SKILLS).map(k=>[k,0])),'system.focuses':[],'system.identity':'','system.role':'','system.affiliation':'','system.formItemId':form.id,'system.hp':form.system.maxhp??6});}catch(error){await actor.updateEmbeddedDocuments('Item',snapshot);await actor.update(previous);throw error;}
 ui.notifications.info('Character reset to Baseline.');
}
