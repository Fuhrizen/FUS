export function newEncounter(id,name='Encounter'){return {id,name,round:0,participants:[],pool:[],active:[],drawn:[]};}
export function normalizeEncounter(source){
 const e={...newEncounter(source.id,source.name),round:source.round??0,participants:(source.participants??[]).map(p=>({id:p.id,name:p.name,img:p.img,actorUuid:p.actorUuid,tokenUuid:p.tokenUuid,hidden:p.hidden,incapacitated:!!p.incapacitated,ignored:p.ignored??p.defeated??false})),pool:(source.pool??[]).flat(),active:(source.active??[]).slice(0,1),drawn:source.drawn??(source.history??[]).flat()};
 const valid=new Set(e.participants.map(p=>p.id));e.pool=e.pool.filter(id=>valid.has(id) && !e.participants.find(p=>p.id===id).ignored && !e.participants.find(p=>p.id===id).incapacitated);e.active=e.active.filter(id=>valid.has(id)&&!e.participants.find(p=>p.id===id).incapacitated);return e;
}
export const buildEncounterPool=participants=>participants.filter(p=>!p.ignored&&!p.incapacitated).map(p=>p.id);
export function transitionEncounter(source,operation,{id=null,random=Math.random}={}){
 const e=normalizeEncounter(source),p=e.participants.find(p=>p.id===id);
 const begin=()=>{e.round++;e.pool=buildEncounterPool(e.participants);e.active=[];e.drawn=[];};
 if(operation==='start'){e.round=0;begin();}
 if(operation==='next'||operation==='start'){
  if(!e.round)begin();e.pool=e.pool.filter(id=>e.participants.some(p=>p.id===id&&!p.ignored&&!p.incapacitated));if(!e.pool.length)begin();if(!e.pool.length)throw new Error('Add a token or turn off Skip for a participant.');
  const index=Math.min(e.pool.length-1,Math.floor(random()*e.pool.length));const selected=e.pool.splice(index,1)[0];e.active=[selected];e.drawn.push(selected);
 }else if(operation==='stop'){e.round=0;e.pool=[];e.active=[];e.drawn=[];
 }else if(operation==='setTurn'){
  if(!p)throw new Error('Token not found.');if(p.incapacitated)throw new Error('A token at 0 HP cannot take a turn.');p.ignored=false;if(!e.round)begin();e.active=[id];e.pool=e.pool.filter(x=>x!==id);if(!e.drawn.includes(id))e.drawn.push(id);
 }else if(operation==='ignore'){
  if(!p)throw new Error('Token not found.');p.ignored=!p.ignored;e.pool=e.pool.filter(x=>x!==id);if(p.ignored)e.active=e.active.filter(x=>x!==id);else if(!e.drawn.includes(id)&&e.round&&!p.incapacitated)e.pool.push(id);
 }else if(operation==='remove'){
  e.participants=e.participants.filter(p=>p.id!==id);e.pool=e.pool.filter(x=>x!==id);e.active=e.active.filter(x=>x!==id);e.drawn=e.drawn.filter(x=>x!==id);
 }else throw new Error('Unknown encounter operation.');return e;
}
