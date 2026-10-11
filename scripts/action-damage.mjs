import {loadSourceActions} from './action-library.mjs';
import {DAMAGE_TYPES,DAMAGE_STYLES,validateComponent,rollDamage} from './damage.mjs';
import {escapeHTML} from './rolls.mjs';
import {sourceActions} from './attacks.mjs';
export const costPips=cost=>Array.from({length:Math.min(20,Math.max(0,Math.floor(Number(cost)||0)))},()=>true);
export async function rollActionDamage(actor,source,actionId,{targets=null}={}){
 if(!actor?.isOwner || source?.parent?.uuid!==actor.uuid)throw new Error('Use an action owned by this character.');
 await loadSourceActions(source);
 const action=sourceActions(source).find(a=>a.id===actionId);if(!action)throw new Error('This action no longer exists.');
 if(targets?.some(t=>t.hit===false)){targets=targets.filter(t=>t.hit!==false);if(!targets.length)throw new Error('No targets were hit by this attack.');}
 return rollDamage(action.damageComponents??[],{actor,label:`${source.name}: ${action.name}`,targets});
}
export async function chooseActionDamage(actor,source){
 const actions=sourceActions(source).filter(a=>a.damageComponents?.length);
 if(!actions.length)throw new Error('Configure damage on a source action first.');
 const id=actions.length===1?actions[0].id:await foundry.applications.api.DialogV2.wait({window:{title:'Choose damage action'},content:'<p>Which action damage?</p>',buttons:[...actions.map(a=>({action:a.id,label:a.name,callback:()=>a.id})),{action:'cancel',label:'Cancel'}],rejectClose:false});
 if(actions.some(a=>a.id===id))return rollActionDamage(actor,source,id);
}
export function mountActionDamage(root){
 if(root.dataset.damageMounted)return;root.dataset.damageMounted='true';
 const hidden=root.querySelector('[name="damageJSON"]'),list=root.querySelector('[data-action-damage]');if(!hidden||!list)return;
 let rows=JSON.parse(hidden.value||'[]');
 const sync=()=>{hidden.value=JSON.stringify(rows);};
 const draw=()=>{
  list.replaceChildren();rows.forEach((row,index)=>{
   const div=document.createElement('div');div.className='fus-action-damage-row';
   div.innerHTML=`<span class="fus-damage-badge" title="${DAMAGE_TYPES[row.type]}"></span><select aria-label="Damage type">${Object.entries(DAMAGE_TYPES).map(([key,label])=>`<option value="${key}" ${row.type===key?'selected':''}>${label}</option>`).join('')}</select><input value="${escapeHTML(row.formula)}" aria-label="Damage formula" placeholder="1d6 or 2"><button type="button" title="Move up">↑</button><button type="button" title="Move down">↓</button><button type="button" title="Remove damage">×</button>`;
   const colour=()=>{const style=DAMAGE_STYLES[row.type],badge=div.querySelector('.fus-damage-badge');badge.style.setProperty('--damage-colour',style.colour);badge.innerHTML=`<i class="fa-solid fa-${style.icon}" aria-hidden="true"></i>`;badge.title=DAMAGE_TYPES[row.type];div.style.borderLeft=`3px solid ${style.colour}`;};colour();
   div.querySelector('select').addEventListener('change',e=>{row.type=e.target.value;colour();sync();});div.querySelector('input').addEventListener('input',e=>{row.formula=e.target.value;sync();});
   const buttons=div.querySelectorAll('button');buttons[0].addEventListener('click',()=>{if(index>0){[rows[index-1],rows[index]]=[rows[index],rows[index-1]];sync();draw();}});buttons[1].addEventListener('click',()=>{if(index<rows.length-1){[rows[index+1],rows[index]]=[rows[index],rows[index+1]];sync();draw();}});buttons[2].addEventListener('click',()=>{rows.splice(index,1);sync();draw();});list.append(div);
  });
 };
 root.querySelector('[data-add-action-damage]')?.addEventListener('click',()=>{rows.push({type:'bludgeoning',formula:'0'});sync();draw();list.lastElementChild?.querySelector('input')?.focus({preventScroll:true});});draw();
}
