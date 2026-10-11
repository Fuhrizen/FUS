import {reactionCover} from './reactions.mjs';
export const COVER_LEVELS={0:'No cover',2:'Soft Cover',4:'Hard Cover',99:'Total Cover'};
export const COVER_HELP={0:'No cover bonus. Normal line of sight is still required.',2:'Soft Cover: +2 defence DC when this is the closest cover within 5 ft of the target.',4:'Hard Cover: +4 defence DC when this is the closest cover within 5 ft of the target.',99:'Total Cover: blocks attacks crossing this wall, even when sight is allowed.'};
export const elevatedPoint=(point,elevation=point.elevation??0)=>({x:point.x,y:point.y,elevation});
export function canvasToClient(point){if(canvas.clientCoordinatesFromCanvas)return canvas.clientCoordinatesFromCanvas(point);const rect=document.querySelector('#board')?.getBoundingClientRect()??{left:0,top:0},p=canvas.stage.toGlobal(point);return {x:p.x+rect.left,y:p.y+rect.top};}
export function clientToCanvas(point){if(canvas.canvasCoordinatesFromClient)return canvas.canvasCoordinatesFromClient(point);const rect=document.querySelector('#board')?.getBoundingClientRect()??{left:0,top:0};return canvas.stage.toLocal({x:point.x-rect.left,y:point.y-rect.top});}
export const sceneWalls=()=>Array.from(canvas.scene?.walls??[]);
const ftFactor=units=>/^(m|meters?|metres?)$/i.test(units??'')?3.280839895:1;
export const pixelsPerFoot=()=>canvas.grid.size/(canvas.grid.distance*ftFactor(canvas.scene?.grid?.units??canvas.grid.units));
export function wallEndpoints(wall){const c=wall.c??wall.document?.c;return c?.length===4?[{x:c[0],y:c[1]},{x:c[2],y:c[3]}]:null;}
export function wallIntersection(a,b,wall){const ends=wallEndpoints(wall);if(!ends)return null;const [c,d]=ends,dx=b.x-a.x,dy=b.y-a.y,ex=d.x-c.x,ey=d.y-c.y,den=dx*ey-dy*ex;if(Math.abs(den)<1e-9)return null;const t=((c.x-a.x)*ey-(c.y-a.y)*ex)/den,u=((c.x-a.x)*dy-(c.y-a.y)*dx)/den;if(t<=1e-6||t>=1||u<0||u>1)return null;return t;}
export function wallCoverLevel(wall){const doc=wall.document??wall;if(doc.door&&doc.ds===1)return 0;return Object.hasOwn(COVER_LEVELS,Number(doc.flags?.FUS?.cover??0))?Number(doc.flags?.FUS?.cover??0):0;}
export function nearestWallPoint(point,wall){const ends=wallEndpoints(wall);if(!ends)return null;const [a,b]=ends,dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy,t=len?Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/len)):0;return {x:a.x+dx*t,y:a.y+dy*t};}
export function coverFor(origin,target,walls){let best={level:0,label:'No cover',name:''},nearest=Infinity;const reach=globalThis.canvas?.grid?.size&&canvas.grid.distance?pixelsPerFoot()*5:Infinity;for(const wall of walls){const level=wallCoverLevel(wall);if(!level)continue;const crossing=wallIntersection(origin,target,wall),point=nearestWallPoint(target,wall);if(!point)continue;const doc=wall.document??wall,bounds=doc.elevation,elevation=level===99?(origin.elevation??0)+((target.elevation??0)-(origin.elevation??0))*(crossing??0):(target.elevation??0);if(bounds&&((bounds.bottom!=null&&elevation<bounds.bottom)||(bounds.top!=null&&elevation>bounds.top)))continue;
 if(level===99){if(crossing!==null)return {level,label:COVER_LEVELS[level],name:'',wallId:doc.id,wall,point};continue;}
 const distance=Math.hypot(target.x-point.x,target.y-point.y);if(distance>reach||distance>nearest||distance===nearest&&level<=best.level)continue;nearest=distance;best={level,label:COVER_LEVELS[level],name:'',wallId:doc.id,wall,point,distance};}return best;}

export function hasLineOfSight(origin,target){const backend=globalThis.CONFIG?.Canvas?.polygonBackends?.sight;if(!backend)return true;return !backend.testCollision(origin,target,{type:'sight',mode:'any',level:canvas.level});}
export function canAttackPoint(origin,target){return hasLineOfSight(origin,target)&&coverFor(origin,target,sceneCoverCandidates(origin,target)).level!==99;}
export function targetContext(origin,token){const a=elevatedPoint(origin.center,origin.document?.elevation??0),b=elevatedPoint(token.center,token.document?.elevation??0);const distance=canvas.grid.measurePath([a,b]).distance*ftFactor(canvas.scene?.grid?.units??canvas.grid.units);const {wall,point,...baseCover}=coverFor(a,b,sceneCoverCandidates(a,b));const cover=reactionCover(baseCover,token.actor?.statuses);const dx=Math.max(0,Math.abs(a.x-b.x)-((origin.w??0)+(token.w??0))/2),dy=Math.max(0,Math.abs(a.y-b.y)-((origin.h??0)+(token.h??0))/2),reachDistance=origin.w&&token.w?Math.hypot(dx,dy)/pixelsPerFoot():distance;return {distance:Math.round(distance*10)/10,reachDistance,los:hasLineOfSight(a,b)&&cover.level!==99,cover};}
export async function resolveOriginToken(actor){
 const tokens=globalThis.canvas?.tokens;if(!tokens||!globalThis.canvas?.ready)return null;
 const controlled=(tokens.controlled??[]).filter(t=>t.actor?.isOwner);const same=t=>t.actor?.uuid===actor.uuid||(actor.id&&t.document?.actorId===actor.id);
 const matching=controlled.filter(same);if(matching.length===1)return matching[0];
 if(controlled.length&&matching.length===0)throw new Error(`Select a token for ${actor.name} before using this action.`);
 const candidates=matching.length?matching:(tokens.placeables??[]).filter(t=>same(t)&&t.actor?.isOwner);
 if(candidates.length===1)return candidates[0];if(!candidates.length)throw new Error(`Place a token for ${actor.name} on the current scene.`);
 const id=await foundry.applications.api.DialogV2.wait({window:{title:'Choose acting token'},content:'<p>Which token is using this action?</p>',buttons:[...candidates.map(t=>({action:t.id,label:t.name,callback:()=>t.id})),{action:'cancel',label:'Cancel'}],rejectClose:false});return candidates.find(t=>t.id===id)??null;
}
export function mountCoverConfig(app){const root=app.element;if(app.document?.documentName!=='Wall'||!game.user.isGM||root.querySelector('[name="flags.FUS.cover"]'))return;const group=document.createElement('div');group.className='form-group';group.innerHTML='<label>Cover</label><div class="form-fields"><select name="flags.FUS.cover"></select></div>';const select=group.querySelector('select');for(const [value,label] of Object.entries(COVER_LEVELS)){const option=document.createElement('option');option.value=value;option.textContent=label;option.title=COVER_HELP[value];option.dataset.tooltip=COVER_HELP[value];option.dataset.tooltipDirection="UP";select.append(option);}select.value=String(wallCoverLevel(app.document));const tooltip=()=>{select.title=COVER_HELP[select.value];select.dataset.tooltip=COVER_HELP[select.value];select.dataset.tooltipDirection='UP';};tooltip();select.addEventListener('change',tooltip);const sight=root.querySelector('[name="sight"]')?.closest('.form-group');if(sight)sight.after(group);else (root.querySelector('form')??root.querySelector('.window-content'))?.append(group);}

let coverIndex;
export function invalidateCoverIndex(){coverIndex=null;}
export function sceneCoverCandidates(origin,target){
 const scene=canvas.scene,walls=scene?.walls,cell=Math.max(1,canvas.grid?.size??100);
 if(!coverIndex||coverIndex.scene!==scene||coverIndex.walls!==walls||coverIndex.cell!==cell){
  const buckets=new Map(),long=[],total=[];
  for(const wall of walls??[]){const level=wallCoverLevel(wall),ends=wallEndpoints(wall);if(!level||!ends)continue;const [a,b]=ends,box={wall,left:Math.min(a.x,b.x),right:Math.max(a.x,b.x),top:Math.min(a.y,b.y),bottom:Math.max(a.y,b.y)};if(level===99){total.push(box);continue;}
   const x0=Math.floor(box.left/cell),x1=Math.floor(box.right/cell),y0=Math.floor(box.top/cell),y1=Math.floor(box.bottom/cell);if((x1-x0+1)*(y1-y0+1)>256){long.push(box);continue;}
   for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){const key=`${x},${y}`;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(wall);}
  }
  coverIndex={scene,walls,cell,buckets,long,total};
 }
 const reach=canvas.grid?.distance?pixelsPerFoot()*5:cell,near={left:target.x-reach,right:target.x+reach,top:target.y-reach,bottom:target.y+reach},ray={left:Math.min(origin.x,target.x),right:Math.max(origin.x,target.x),top:Math.min(origin.y,target.y),bottom:Math.max(origin.y,target.y)},overlaps=(a,b)=>a.left<=b.right&&a.right>=b.left&&a.top<=b.bottom&&a.bottom>=b.top,candidates=new Set();
 for(let x=Math.floor(near.left/cell);x<=Math.floor(near.right/cell);x++)for(let y=Math.floor(near.top/cell);y<=Math.floor(near.bottom/cell);y++)for(const wall of coverIndex.buckets.get(`${x},${y}`)??[])candidates.add(wall);
 for(const box of coverIndex.long)if(overlaps(box,near))candidates.add(box.wall);
 for(const box of coverIndex.total)if(overlaps(box,ray))candidates.add(box.wall);
 return [...candidates];
}
