import {areaProfile,areaTargets} from './area-targeting.mjs';
import {targetHitChance,sourceAttackProfile} from './hit-chance.mjs';
import {targetPath} from './target-path.mjs';
import {targetContext,canAttackPoint,elevatedPoint,canvasToClient,clientToCanvas,sceneWalls} from './cover.mjs';
import {showCoverPreview,clearCoverPreview} from './cover-preview.mjs';
import {escapeHTML} from './rolls.mjs';
export function rangeProfile(source,action={}){const p=sourceAttackProfile(source,action);return {melee:p.combatMode==='melee',optimal:p.optimal,maximum:p.maximum};}
export function rangeBand(distance,profile){return !profile.maximum?'No range configured':distance<=profile.optimal?(profile.melee?'Within reach':'Optimal'):distance<=profile.maximum?'Extended':'Out of range';}
export function sceneFeetFactor(units){return /^(m|meter|meters|metre|metres)$/i.test(String(units).trim())?3.280839895:1;}
export function measureTargetRange(origin,point,grid){const factor=sceneFeetFactor(grid.units);return {direct:Math.hypot(point.x-origin.x,point.y-origin.y)/grid.size*grid.distance*factor,effective:grid.measurePath([origin,point]).distance*factor};}
export function targetTokenFromClick(token,event){const selected=game.user.targets?.has(token)??token.isTargeted??false;token.setTarget(event.shiftKey?!selected:true,{user:game.user,releaseOthers:!event.shiftKey});return !event.shiftKey;}
let cancelActive=null;
export function promptTargetSelection(actor,action,source,readTargets,{origin=null}={}){
 cancelActive?.();
 game.user.updateTokenTargets?.([]);
 return new Promise(resolve=>{
  const notice=document.createElement('div');notice.className='fus-target-notice';notice.setAttribute('role','status');
  notice.innerHTML=`<strong>${escapeHTML(action.name)}</strong><span data-target-status>Left-click a token · hold Shift to add/remove</span><small data-range-status></small><button type="button" data-target-use>Use targets</button><button type="button" data-target-cancel aria-label="Cancel targeting">×</button>`;
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('fus-target-preview');svg.setAttribute('aria-hidden','true');
  const shape=tag=>{const node=document.createElementNS(svg.namespaceURI,tag);svg.append(node);return node;};
  const areaCircle=shape('circle'),areaPolygon=shape('polygon');for(const node of [areaCircle,areaPolygon]){node.setAttribute('class','fus-area-preview');node.style.display='none';}
  const outer=shape('circle'),inner=shape('circle'),line=shape('g');outer.setAttribute('class','fus-range-max');inner.setAttribute('class','fus-range-optimal');line.setAttribute('class','fus-range-path');
  const distanceLabel=document.createElement('small');distanceLabel.className='fus-target-distance';
  document.body.append(svg,notice,distanceLabel);
  const use=notice.querySelector('[data-target-use]'),status=notice.querySelector('[data-target-status]'),rangeStatus=notice.querySelector('[data-range-status]');
  const profile=rangeProfile(source,action);let area=null;const isArea=action.targetMode==='area';let frame,closed=false,mouse=null,lastCover=0,lastCoverKey='';
  const originToken=()=>origin??actor.token?.object??globalThis.canvas?.tokens?.controlled?.find(t=>t.actor?.uuid===actor.uuid);
  const finish=value=>{if(closed)return;closed=true;cancelAnimationFrame(frame);document.removeEventListener('pointermove',move);document.removeEventListener('keydown',key);document.removeEventListener('keyup',keyUp);document.removeEventListener('pointerdown',pick,true);document.removeEventListener('contextmenu',rightClick,true);Hooks.off('targetToken',targetHook);Hooks.off('canvasTearDown',tearHook);clearCoverPreview();notice.remove();svg.remove();distanceLabel.remove();game.user.updateTokenTargets?.([]);if(cancelActive===cancel)cancelActive=null;resolve(value);};
  const cancel=()=>finish(null);cancelActive=cancel;
  const confirm=()=>{if(isArea&&area){const targets=areaTargets(area,canvas.tokens.placeables);targets.area=area;finish(targets);return;}const targets=readTargets();if(targets.some(t=>t.los===false||t.cover?.level===99)){status.textContent='A selected target has no line of attack.';return;}if(targets.length)finish(targets);};
  const refresh=()=>{const targets=readTargets();use.disabled=isArea?!area:!targets.length;status.textContent=targets.length?targets.map(t=>`${t.name}${t.hitChance?` · ${t.hitChance.chance}% hit`:''}`).join(', '):'Left-click a token · hold Shift to add/remove';};
  const move=event=>{if(!event.target.closest?.('#board'))return;mouse={x:event.clientX,y:event.clientY};};
  const pick=event=>{
   if(!event.target.closest?.('#board'))return;if(event.button===2){event.preventDefault();event.stopImmediatePropagation();cancel();const swallow=e=>{e.preventDefault();e.stopImmediatePropagation();};document.addEventListener('contextmenu',swallow,{capture:true,once:true});setTimeout(()=>document.removeEventListener('contextmenu',swallow,true),500);return;}if(event.button!==0)return;
   const c=globalThis.canvas;if(!c?.ready)return;
   const point=clientToCanvas({x:event.clientX,y:event.clientY});
   if(isArea){const acting=originToken();const center=acting?.center??point;if(acting&&!canAttackPoint(elevatedPoint(center,acting.document?.elevation??0),elevatedPoint(point,acting.document?.elevation??0))){status.textContent='This area has no line of attack.';event.preventDefault();event.stopImmediatePropagation();return;}area=areaProfile(action,point,Math.atan2(point.y-center.y,point.x-center.x)*180/Math.PI);event.preventDefault();event.stopImmediatePropagation();confirm();return;}
   const token=[...(c.tokens?.placeables??[])].reverse().find(t=>t.visible&&(t.bounds?.contains(point.x,point.y)??(point.x>=t.x&&point.x<=t.x+t.w&&point.y>=t.y&&point.y<=t.y+t.h)));
   if(!token)return;const acting=originToken();if(acting){const context=targetContext(acting,token);if(!context.los||context.cover.level===99){status.textContent='This target has no line of attack.';event.preventDefault();event.stopImmediatePropagation();return;}}event.preventDefault();event.stopImmediatePropagation();
   const complete=targetTokenFromClick(token,event);refresh();if(complete)confirm();
  };
  const rightClick=event=>{if(event.target.closest?.('#board')){event.preventDefault();event.stopImmediatePropagation();cancel();}};
  const keyUp=event=>{if(event.key==='Shift')confirm();};
  const key=event=>{if(event.key==='Escape'){event.preventDefault();cancel();}else if(event.key==='Enter'&&!['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName)){event.preventDefault();confirm();}};
  const targetHook=Hooks.on('targetToken',user=>{if(user.id===game.user.id)refresh();}),tearHook=Hooks.on('canvasTearDown',cancel);
  const draw=()=>{
   if(closed)return;
   const c=globalThis.canvas,token=originToken();
   if(token && c?.ready && mouse){
    const origin=token.center;
    const screen=canvasToClient(origin),point=clientToCanvas(mouse),grid=c.grid;
    const coverKey=`${Math.round(point.x)}:${Math.round(point.y)}:${c.stage.worldTransform.a}:${c.stage.worldTransform.tx}:${c.stage.worldTransform.ty}`;if(coverKey!==lastCoverKey&&performance.now()-lastCover>100){showCoverPreview(token,point,{persistent:true});lastCover=performance.now();lastCoverKey=coverKey;}
    if(isArea){area=areaProfile(action,point,Math.atan2(point.y-origin.y,point.x-origin.x)*180/Math.PI);const screenPoint=canvasToClient,at=(angle,r)=>({x:area.x+Math.cos(angle)*r,y:area.y+Math.sin(angle)*r}),direction=area.direction*Math.PI/180;areaCircle.style.display=area.shape==='circle'?'':'none';areaPolygon.style.display=area.shape==='circle'?'none':'';const center=screenPoint(area);areaCircle.setAttribute('cx',center.x);areaCircle.setAttribute('cy',center.y);areaCircle.setAttribute('r',area.radius*Math.abs(c.stage.worldTransform.a));let points;if(area.shape==='cone'){points=[area,...Array.from({length:33},(_,i)=>at(direction+(i/32-.5)*area.angle*Math.PI/180,area.radius))];}else{const tip=at(direction,area.radius),offset={x:-Math.sin(direction)*area.width/2,y:Math.cos(direction)*area.width/2};points=[{x:area.x+offset.x,y:area.y+offset.y},{x:tip.x+offset.x,y:tip.y+offset.y},{x:tip.x-offset.x,y:tip.y-offset.y},{x:area.x-offset.x,y:area.y-offset.y}];}areaPolygon.setAttribute('points',(points??[]).map(screenPoint).map(p=>`${p.x},${p.y}`).join(' '));use.disabled=false;status.textContent='Click anywhere to place the area · right-click cancels';}
    const measured=measureTargetRange(origin,point,grid),band=rangeBand(measured.effective,profile);
    const x=screen.x,y=screen.y,scale=Math.abs(c.stage.worldTransform.a),px=grid.size/(grid.distance*sceneFeetFactor(grid.units))*scale;
    svg.style.display='block';
    for(const [circle,distance] of [[outer,profile.maximum],[inner,profile.optimal]]){circle.setAttribute('cx',x);circle.setAttribute('cy',y);circle.setAttribute('r',distance*px);circle.style.display=distance>0?'':'none';}
    
    const a=elevatedPoint(origin,token.document?.elevation??0),b=elevatedPoint(point,token.document?.elevation??0),visible=canAttackPoint(a,b),path=targetPath(a,b,sceneWalls(),{distance:measured.effective,...profile});
    line.replaceChildren();for(const segment of path.segments){const from=canvasToClient(segment.from),to=canvasToClient(segment.to),node=document.createElementNS(svg.namespaceURI,'line');for(const [key,value]of Object.entries({x1:from.x,y1:from.y,x2:to.x,y2:to.y,stroke:segment.colour,'stroke-dasharray':segment.dashed?'5 5':'none','data-factor':segment.factor,class:'fus-range-line'}))node.setAttribute(key,value);const title=document.createElementNS(svg.namespaceURI,'title');title.textContent=segment.factors.join(' · ');node.append(title);line.append(node);}
    for(const boundary of path.boundaries){const point=canvasToClient(boundary.point),mark=document.createElementNS(svg.namespaceURI,'circle'),label=document.createElementNS(svg.namespaceURI,'text');for(const [key,value]of Object.entries({cx:point.x,cy:point.y,r:4,class:'fus-target-boundary'}))mark.setAttribute(key,value);label.setAttribute('x',point.x+7);label.setAttribute('y',point.y-8);label.setAttribute('class','fus-target-factor');label.textContent=boundary.label;line.append(mark,label);}

    distanceLabel.style.display='block';distanceLabel.style.left=`${mouse.x+12}px`;distanceLabel.style.top=`${mouse.y+12}px`;const hovered=[...(c.tokens?.placeables??[])].reverse().find(t=>t.visible&&t.bounds?.contains(point.x,point.y));const context=hovered?targetContext(token,hovered):null;const prediction=context?targetHitChance(actor,source,action,token,hovered,context):null;distanceLabel.textContent=prediction?`${hovered.name} · ${context.distance} ft · ${prediction.chance}% HIT`:`${measured.effective.toFixed(1)} ft${visible?'':' · blocked'}`;distanceLabel.style.setProperty?.('--fus-hit-chance',`${prediction?.chance??0}%`);distanceLabel.title=prediction?[prediction.reason,...prediction.factors,`2d10 + ${prediction.bonus} vs DC ${prediction.dc}`].filter(Boolean).join(' · '):'';
    rangeStatus.textContent=`Direct ${measured.direct.toFixed(1)} ft · Grid ${measured.effective.toFixed(1)} ft · ${band}${profile.maximum?` (${profile.melee?'Reach '+profile.optimal:'Optimal '+profile.optimal+' / Max '+profile.maximum} ft)`:''}${prediction?` · ${prediction.factors.join(' · ')} · 2d10 + ${prediction.bonus}`:''}${path.boundaries.length?` · ${[...new Set(path.boundaries.map(b=>b.label))].join(' · ')}`:''}`;
   }else{svg.style.display='none';distanceLabel.style.display='none';rangeStatus.textContent=token?'Move the pointer onto the map to preview range.':'No actor token on this scene; range preview unavailable.';}
   frame=requestAnimationFrame(draw);
  };
  use.addEventListener('click',confirm);notice.querySelector('[data-target-cancel]').addEventListener('click',cancel);document.addEventListener('pointermove',move,{passive:true});document.addEventListener('keydown',key);document.addEventListener('keyup',keyUp);document.addEventListener('pointerdown',pick,true);document.addEventListener('contextmenu',rightClick,true);refresh();draw();
 });
}
