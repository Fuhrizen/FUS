import test from 'node:test';
import assert from 'node:assert/strict';
let count=0;
globalThis.foundry={dice:{Roll:class{static validate(f){return !!f && !f.includes('++');}constructor(formula){this.formula=formula;}async evaluate(){this.total=this.formula.includes('d')?++count:Number(this.formula.replace(/\[.*\]/,''));}}},documents:{ChatMessage:{getSpeaker:()=>({}),create:async data=>data}}};
const {DAMAGE_TYPES,rollDamage,resolveDamage,validateComponent,registerDamageLinks}=await import('../scripts/damage.mjs');
test('all eleven types are registered and invalid types/formulas fail',()=>{assert.equal(Object.keys(DAMAGE_TYPES).length,11);assert.throws(()=>validateComponent({type:'fire',formula:'1'}));assert.throws(()=>validateComponent({type:'heat',formula:'<script>'}));});
test('typed multi-component rolls retain totals and machine-readable damage flags',async()=>{const message=await rollDamage([{type:'heat',formula:'2'},{type:'cutting',formula:'3'}]);assert.equal(message.flags.FUS.kind,'damage');assert.deepEqual(message.flags.FUS.components.map(c=>c.total),[2,3]);assert.equal(message.rolls[0].formula,'2[heat]');});
test('only matching equipped armour applies and dice reroll each application',async()=>{count=0;const actor={isOwner:true,items:[{type:'armour',name:'Plate',system:{equipped:true,adjustments:[{type:'heat',kind:'resistance',formula:'1d6'},{type:'heat',kind:'weakness',formula:'2'}]}},{type:'armour',system:{equipped:false,adjustments:[{type:'heat',kind:'resistance',formula:'100'}]}}]};const components=[{type:'heat',total:5},{type:'cold',total:3}];assert.deepEqual((await resolveDamage(actor,components)).map(r=>r.final),[6,3]);assert.deepEqual((await resolveDamage(actor,components)).map(r=>r.final),[5,3]);await assert.rejects(()=>resolveDamage({isOwner:false},components));});
test('damage links accept nested typed dice and multiple components',async()=>{globalThis.CONFIG={TextEditor:{enrichers:[]}};globalThis.document={addEventListener(){},createElement(){return {dataset:{}};}};registerDamageLinks();const enricher=CONFIG.TextEditor.enrichers[0];const match=[...'@Damage[1d6[heat]; 2[cutting]]{Burn}'.matchAll(enricher.pattern)][0];assert.ok(match);const link=await enricher.enricher(match);assert.ok(link.innerHTML.includes('Burn'));assert.ok(link.innerHTML.includes('fus-damage-badge'));assert.equal(JSON.parse(link.dataset.components).length,2);});
test('every type has a coloured icon badge and visible formulas omit type tags',async()=>{
 const {DAMAGE_STYLES,damageBadge,displayDamageFormula}=await import('../scripts/damage.mjs');
 for(const type of Object.keys(DAMAGE_TYPES)){assert.match(DAMAGE_STYLES[type].colour,/^#[0-9a-f]{6}$/);assert.ok(damageBadge(type).includes(DAMAGE_TYPES[type]));assert.ok(damageBadge(type).includes('fa-solid'));}
 assert.equal(displayDamageFormula('1d6[heat] + 2[cutting]'),'1d6 + 2');
});
test('legacy reach populates both ranges without overwriting existing range profiles',async()=>{
 globalThis.foundry.abstract={TypeDataModel:class{static migrateData(source){return source;}}};
 const {FUSWeaponData}=await import('../scripts/item-model.mjs');
 const melee=FUSWeaponData.migrateData({reach:5,optimal:0,maximum:0});assert.equal(melee.optimal,5);assert.equal(melee.maximum,5);assert.equal(melee.reach,undefined);
 const ranged=FUSWeaponData.migrateData({reach:5,optimal:30,maximum:90});assert.equal(ranged.optimal,30);assert.equal(ranged.maximum,90);
});
test('legacy weapon damage migrates independently into damaging actions and preserves custom fire modes',async()=>{
 const {FUSWeaponData}=await import('../scripts/item-model.mjs');const source={damage:[{type:'heat',formula:'1d6'}],weaponActions:[{id:'a',mode:'test',damage:true},{id:'b',mode:'test',damage:true,damageComponents:[{type:'cold',formula:'3'}]},{id:'reload',mode:'none',damage:true}]};FUSWeaponData.migrateData(source);assert.equal(source.damage,undefined);assert.equal(source.weaponActions[0].damageComponents[0].formula,'1d6');assert.equal(source.weaponActions[1].damageComponents[0].formula,'3');assert.equal(source.weaponActions[2].damageComponents,undefined);source.weaponActions[0].damageComponents[0].formula='2';assert.equal(source.weaponActions[1].damageComponents[0].formula,'3');
});
