import test from 'node:test';
import assert from 'node:assert/strict';
import {renderChatCard,restoreActionChatCard} from '../scripts/chat-card.mjs';
test('neutral card shares sections and escapes title, rows and actions',async()=>{
 const html=await renderChatCard({title:'<script>',subtitle:'Roll',tags:['a & b'],bodyHTML:'<p>Enriched body</p>',rows:[{label:'Heat',detail:'1d6',value:4}],actions:[{action:'resolveDamage',label:'Resolve'}]});
 assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('a &amp; b'));assert.ok(html.includes('<table>'));assert.ok(html.includes('<strong>4</strong>'));assert.ok(html.includes('data-fus-chat-action="resolveDamage"'));assert.ok(html.includes('<p>Enriched body</p>'));
});
test('runtime uses the shared Handlebars template',async()=>{
 globalThis.foundry={applications:{handlebars:{renderTemplate:async(path,data)=>{assert.equal(path,'systems/FUS/templates/chat-card.hbs');assert.equal(data.title,'Test');return 'rendered';}}}};
 assert.equal(await renderChatCard({title:'Test'}),'rendered');
});

test('restoring an action card retains native expandable dice before its damage button',()=>{const roll={native:true},footer={button:true},insertions=[];const card={querySelector:()=>footer,insertBefore:(node,before)=>insertions.push([node,before])};let content='native dice';const container={querySelectorAll:()=>[roll],querySelector:()=>card,set innerHTML(value){content=value;}};restoreActionChatCard(container,'<article class="fus-chat-card">Action</article>');assert.ok(content.includes('Action'));assert.deepEqual(insertions,[[roll,footer]]);restoreActionChatCard(null,content);});
