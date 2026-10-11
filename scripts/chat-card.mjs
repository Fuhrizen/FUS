import {costPips} from './action-damage.mjs';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Shared neutral structure: title, subtitle, tags, body, result rows and actions.
// bodyHTML is reserved for already enriched/sanitized system content.
export async function renderChatCard({title='',subtitle='',tags=[],bodyHTML='',rows=[],actions=[],cost=0,img=''}={}){
  const context={cost,costPips:costPips(cost),title,subtitle,tags,bodyHTML,rows,actions,img};
  const render=globalThis.foundry?.applications?.handlebars?.renderTemplate;
  if(render)return render('systems/FUS/templates/chat-card.hbs',context);
  return `<article class="fus-chat-card"><header>${img?`<img class="fus-chat-icon" src="${escape(img)}" alt="">`:""}<strong>${escape(title)}</strong>${cost?`<span class="fus-cost-pips" aria-label="${cost} actions" title="${cost} actions">${costPips(cost).map(()=>'◆').join('')}</span>`:''}${subtitle?`<p>${escape(subtitle)}</p>`:''}</header>${tags.length?`<p>${tags.map(t=>`<span>${escape(t)}</span>`).join(' · ')}</p>`:''}${bodyHTML?`<details class="fus-chat-description"><summary>Description</summary><div class="fus-chat-body">${bodyHTML}</div></details>`:''}${rows.length?`<table><tbody>${rows.map(r=>`<tr><th scope="row"><span ${r.colour?`class="fus-damage-badge" style="--damage-colour:${escape(r.colour)}"`:""}>${r.icon?`<i class="fa-solid fa-${escape(r.icon)}" aria-hidden="true"></i> `:''}${escape(r.label)}</span></th><td>${escape(r.detail)}</td><td><strong>${escape(r.value)}</strong></td></tr>`).join('')}</tbody></table>`:''}${actions.length?`<footer>${actions.map(a=>`<button type="button" data-fus-chat-action="${escape(a.action)}" ${a.disabled?'disabled':''} ${a.title?`title="${escape(a.title)}" aria-label="${escape(a.title)}"`:''}>${a.icon?`<i class="fa-solid fa-${escape(a.icon)}" aria-hidden="true"></i> `:''}${escape(a.label)}</button>`).join('')}</footer>`:''}</article>`;
}

export function restoreActionChatCard(container,content){
  if(!container || !content?.includes('fus-chat-card'))return;
  const dice=Array.from(container.querySelectorAll('.dice-roll'));
  container.innerHTML=content;
  const card=container.querySelector('.fus-chat-card'),footer=card?.querySelector('footer');
  for(const roll of dice)if(card)card.insertBefore(roll,footer??null);
}
