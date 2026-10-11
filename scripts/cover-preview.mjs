import {closedCoverLoops,coverAngles,visibleRay} from './cover-geometry.mjs';
import {wallIntersection,wallEndpoints,wallCoverLevel,hasLineOfSight} from './cover.mjs';
let overlay,timer,scheduled,pending,drag,maskId=0;
export function clearCoverPreview(){clearTimeout(timer);overlay?.remove();overlay=null;}
export function showCoverPreview(token,point=token.center,{persistent=false}={}){clearCoverPreview();if(!canvas.ready||!token||token.visible===false)return;const walls=Array.from(canvas.scene.walls??[]),soft=walls.filter(w=>[2,4].includes(wallCoverLevel(w)));if(!soft.length)return;
 const center={...point,elevation:token.document?.elevation??0},length=Math.hypot(canvas.dimensions.width,canvas.dimensions.height),board=document.querySelector('#board')?.getBoundingClientRect()??{left:0,top:0};const screen=p=>{const s=canvas.stage.toGlobal(p);return {x:s.x+board.left,y:s.y+board.top};};
 overlay=document.createElementNS('http://www.w3.org/2000/svg','svg');overlay.classList.add('fus-cover-preview');overlay.setAttribute('aria-hidden','true');
 const loops=closedCoverLoops(walls),loopWalls=new Set(loops.flatMap(loop=>loop.walls)),angles=coverAngles(center,walls),rays=angles.map(angle=>visibleRay(center,angle,length,walls));rays.push(rays[0]);
 const colour=level=>level===4?'#e8b54f':'#62c995',points=values=>values.map(screen).map(p=>`${p.x},${p.y}`).join(' '),polygon=(values,level,className)=>{const p=document.createElementNS(overlay.namespaceURI,'polygon');p.setAttribute('points',points(values));p.setAttribute('fill',colour(level));p.setAttribute('fill-opacity','.16');p.setAttribute('class',className);p.setAttribute('data-cover-level',level);overlay.append(p);return p;};
 // A visibility clip masks closed interiors against sight and Total Cover.
 const clip=document.createElementNS(overlay.namespaceURI,'clipPath'),visibility=document.createElementNS(overlay.namespaceURI,'polygon'),clipId=`fus-cover-mask-${++maskId}`;clip.setAttribute('id',clipId);clip.setAttribute('clipPathUnits','userSpaceOnUse');visibility.setAttribute('points',points(rays.slice(0,-1).map(r=>r.far)));clip.append(visibility);overlay.append(clip);
 for(const loop of loops){const p=polygon(loop.points,loop.level,'fus-cover-interior');p.setAttribute('clip-path',`url(#${clipId})`);}
 for(const wall of [...soft].sort((a,b)=>wallCoverLevel(a)-wallCoverLevel(b))){if(loopWalls.has(wall))continue;for(let i=0;i<angles.length;i++){const a=rays[i],b=rays[i+1],ta=wallIntersection(center,a.end,wall),tb=wallIntersection(center,b.end,wall);if(ta===null||tb===null||ta>=a.limit||tb>=b.limit)continue;polygon([a.at(ta),a.far,b.far,b.at(tb)],wallCoverLevel(wall),'fus-cover-shadow');}}

 // Visible cover faces remain discoverable when the wall also blocks sight.
 for(const wall of soft){const ends=wallEndpoints(wall);if(!ends)continue;const [a,b]=ends;for(let i=0;i<12;i++){const at=t=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,elevation:center.elevation});const mid=at((i+.5)/12),dx=mid.x-center.x,dy=mid.y-center.y,length=Math.hypot(dx,dy);if(!length)continue;const near={x:mid.x-dx/length*.5,y:mid.y-dy/length*.5,elevation:center.elevation};if(!hasLineOfSight(center,near)||walls.some(w=>wallCoverLevel(w)===99&&wallIntersection(center,near,w)!==null))continue;const start=screen(at(i/12)),end=screen(at((i+1)/12)),line=document.createElementNS(overlay.namespaceURI,'line');for(const [k,v] of Object.entries({x1:start.x,y1:start.y,x2:end.x,y2:end.y,stroke:wallCoverLevel(wall)===4?'#e8b54f':'#62c995','stroke-width':3,'stroke-opacity':'.65'}))line.setAttribute(k,v);line.setAttribute('data-cover-level',wallCoverLevel(wall));overlay.append(line);}}

 document.body.append(overlay);if(!persistent)timer=setTimeout(clearCoverPreview,1800);
}
export function requestCoverPreview(token,point=token.center){pending={token,point};if(scheduled)return;scheduled=setTimeout(()=>{scheduled=null;const next=pending;pending=null;if(next&&globalThis.canvas?.ready)showCoverPreview(next.token,next.point);},80);}
export function registerCoverPreview(){
 const positions=new WeakMap();
 Hooks.on('refreshToken',token=>{const previous=positions.get(token),point=token.center;positions.set(token,{...point});if(token.visible!==false&&(token.controlled||token.isDragged||token.isPreview&&token.previewType==='dragging'||previous&&(previous.x!==point.x||previous.y!==point.y)))requestCoverPreview(drag?.token??token,drag?.point??point);});
 Hooks.on('updateToken',(doc,changes)=>{if(!['x','y'].some(key=>Object.hasOwn(changes,key)))return;const token=doc.object;if(token?.visible!==false&&token?.center)requestCoverPreview(token);});
 Hooks.on('controlToken',(token,controlled)=>{if(controlled)requestCoverPreview(token);else if(!drag)clearCoverPreview();});
 Hooks.on('canvasPan',()=>{if(drag)requestCoverPreview(drag.token,drag.point);});
 Hooks.on('canvasTearDown',()=>{clearTimeout(scheduled);scheduled=pending=drag=null;clearCoverPreview();});
 document.addEventListener('pointerdown',event=>{if(event.button!==0||!event.target.closest?.('#board')||!canvas.ready)return;const rect=document.querySelector('#board').getBoundingClientRect(),p=canvas.stage.toLocal({x:event.clientX-rect.left,y:event.clientY-rect.top}),token=canvas.tokens.controlled.find(t=>t.visible!==false&&t.bounds?.contains(p.x,p.y));if(token)drag={token,offset:{x:token.center.x-p.x,y:token.center.y-p.y},start:p,point:token.center};});
 document.addEventListener('pointermove',event=>{if(!drag||!(event.buttons&1)||!canvas.ready)return;const rect=document.querySelector('#board').getBoundingClientRect(),p=canvas.stage.toLocal({x:event.clientX-rect.left,y:event.clientY-rect.top});if(Math.hypot(p.x-drag.start.x,p.y-drag.start.y)<3)return;drag.point={x:p.x+drag.offset.x,y:p.y+drag.offset.y};requestCoverPreview(drag.token,drag.point);},{passive:true});
 const finish=()=>{if(drag)requestCoverPreview(drag.token,drag.point);drag=null;if(overlay){clearTimeout(timer);timer=setTimeout(clearCoverPreview,1500);}};document.addEventListener('pointerup',finish,{passive:true});document.addEventListener('pointercancel',finish,{passive:true});
}
