import {COVER_LEVELS,wallIntersection,wallCoverLevel,hasLineOfSight,coverFor} from './cover.mjs';
// Split at physical crossings and range boundaries, retaining every active factor.
export function targetPath(origin,target,walls,{distance=0,optimal=0,maximum=0,melee=false}={}){
 const at=t=>({x:origin.x+(target.x-origin.x)*t,y:origin.y+(target.y-origin.y)*t,elevation:(origin.elevation??0)+((target.elevation??0)-(origin.elevation??0))*t});
 const events=[];
 const selectedCover=coverFor(origin,target,walls);if(!melee&&[2,4].includes(selectedCover.level)){const dx=target.x-origin.x,dy=target.y-origin.y,len=dx*dx+dy*dy,t=len?Math.max(0,Math.min(.98,((selectedCover.point.x-origin.x)*dx+(selectedCover.point.y-origin.y)*dy)/len)):0;events.push({t,level:selectedCover.level,label:COVER_LEVELS[selectedCover.level]});}
 for(const wall of walls){if(wallCoverLevel(wall)!==99)continue;const t=wallIntersection(origin,target,wall);if(t===null)continue;const bounds=(wall.document??wall).elevation,elevation=at(t).elevation;if(bounds&&(bounds.bottom!=null&&elevation<bounds.bottom||bounds.top!=null&&elevation>bounds.top))continue;events.push({t,level:99,label:'Total Cover'});}

 if(!hasLineOfSight(origin,target)){let lo=0,hi=1;for(let i=0;i<18;i++){const mid=(lo+hi)/2;if(hasLineOfSight(origin,at(mid)))lo=mid;else hi=mid;}events.push({t:(lo+hi)/2,blocked:true,label:'LOS blocked'});}
 for(const [value,label]of [[optimal,'Extended range'],[maximum,'Out of range']])if(value>0&&value<distance)events.push({t:value/distance,range:label,label});
 events.sort((a,b)=>a.t-b.t);
 const segments=[],boundaries=[];let start=0,cover=0,blocked=false,range='';
 const append=end=>{if(end-start<.00001)return;const factor=blocked?'los-blocked':cover===99?'total-cover':cover===4?'hard-cover':cover===2?'soft-cover':range==='Out of range'?'out-of-range':range?'extended-range':'clear';const factors=[cover?COVER_LEVELS[cover]:'Clear',blocked?'LOS blocked':'',range].filter(Boolean);segments.push({from:at(start),to:at(end),factor,factors,colour:blocked||cover===99||range==='Out of range'?'#e46868':cover===4||range?'#e8b54f':cover===2?'#62c995':'#74caff',dashed:blocked||cover===99});};
 const seen=new Set();for(const event of events){if(seen.has(event.label))continue;seen.add(event.label);append(event.t);start=event.t;cover=Math.max(cover,event.level??0);blocked||=!!event.blocked;range=event.range??range;boundaries.push({point:at(event.t),label:event.label});}
 append(1);return {segments,boundaries};
}
