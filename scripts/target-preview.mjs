import {targetHitChance,sourceAttackProfile} from './hit-chance.mjs';
import {targetContext,canAttackPoint} from './cover.mjs';
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
  const outer=shape('circle'),inner=shape('circle'),line=shape('line');outer.setAttribute('class','fus-range-max');inner.setAttribute('class','fus-range-optimal');line.setAttribute('class','fus-range-line');
  const distanceLabel=document.createElement('small');distanceLabel.className='fus-target-distance';
  document.body.append(svg,notice,distanceLabel);
  const use=notice.querySelector('[data-target-use]'),status=notice.querySelector('[data-target-status]'),rangeStatus=notice.querySelector('[data-range-status]');
  const profile=rangeProfile(source,action);let frame,closed=false,mouse=null,lastCover=0,lastCoverKey='';
  const originToken=()=>origin??actor.token?.object??globalThis.canvas?.tokens?.controlled?.find(t=>t.actor?.uuid===actor.uuid);
  const finish=value=>{if(closed)return;closed=true;cancelAnimationFrame(frame);document.removeEventListener('pointermove',move);document.removeEventListener('keydown',key);document.removeEventListener('keyup',keyUp);document.removeEventListener('pointerdown',pick,true);Hooks.off('targetToken',targetHook);Hooks.off('canvasTearDown',tearHook);clearCoverPreview();notice.remove();svg.remove();distanceLabel.remove();game.user.updateTokenTargets?.([]);if(cancelActive===cancel)cancelActive=null;resolve(value);};
  const cancel=()=>finish(null);cancelActive=cancel;
  const confirm=()=>{const targets=readTargets();if(targets.some(t=>t.los===false||t.cover?.level===99||t.hitChance?.blocked||profile.maximum>0&&t.distance>profile.maximum)){status.textContent='A selected target is blocked or out of range.';return;}if(targets.length)finish(targets);};
  const refresh=()=>{const targets=readTargets();use.disabled=!targets.length;status.textContent=targets.length?targets.map(t=>`${t.name}${t.hitChance?` · ${t.hitChance.chance}% hit`:''}`).join(', '):'Left-click a token · hold Shift to add/remove';};
  const move=event=>{if(!event.target.closest?.('#board'))return;mouse={x:event.clientX,y:event.clientY};};
  const pick=event=>{
   if(event.button!==0||!event.target.closest?.('#board'))return;
   const c=globalThis.canvas;if(!c?.ready)return;
   const rect=document.querySelector('#board').getBoundingClientRect(),point=c.stage.toLocal({x:event.clientX-rect.left,y:event.clientY-rect.top});
   const token=[...(c.tokens?.placeables??[])].reverse().find(t=>t.visible&&(t.bounds?.contains(point.x,point.y)??(point.x>=t.x&&point.x<=t.x+t.w&&point.y>=t.y&&point.y<=t.y+t.h)));
   if(!token)return;const acting=originToken();if(acting){const context=targetContext(acting,token);if(!context.los||context.cover.level===99||profile.maximum>0&&context.distance>profile.maximum){status.textContent='This target is blocked or out of range.';event.preventDefault();event.stopImmediatePropagation();return;}}event.preventDefault();event.stopImmediatePropagation();
   const complete=targetTokenFromClick(token,event);refresh();if(complete)confirm();
  };
  const keyUp=event=>{if(event.key==='Shift')confirm();};
  const key=event=>{if(event.key==='Escape'){event.preventDefault();cancel();}else if(event.key==='Enter'&&!['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName)){event.preventDefault();confirm();}};
  const targetHook=Hooks.on('targetToken',user=>{if(user.id===game.user.id)refresh();}),tearHook=Hooks.on('canvasTearDown',cancel);
  const draw=()=>{
   if(closed)return;
   const c=globalThis.canvas,token=originToken();
   if(token && c?.ready && mouse){
    const board=document.querySelector('#board'),rect=board?.getBoundingClientRect()??{left:0,top:0},origin=token.center;
    const screen=c.stage.toGlobal(origin),point=c.stage.toLocal({x:mouse.x-rect.left,y:mouse.y-rect.top}),grid=c.grid;
    const coverKey=`${Math.round(point.x)}:${Math.round(point.y)}:${c.stage.worldTransform.a}:${c.stage.worldTransform.tx}:${c.stage.worldTransform.ty}`;if(coverKey!==lastCoverKey&&performance.now()-lastCover>100){showCoverPreview(token,point,{persistent:true});lastCover=performance.now();lastCoverKey=coverKey;}
    const measured=measureTargetRange(origin,point,grid),band=rangeBand(measured.effective,profile);
    const x=screen.x+rect.left,y=screen.y+rect.top,scale=Math.abs(c.stage.worldTransform.a),px=grid.size/(grid.distance*sceneFeetFactor(grid.units))*scale;
    svg.style.display='block';
    for(const [circle,distance] of [[outer,profile.maximum],[inner,profile.optimal]]){circle.setAttribute('cx',x);circle.setAttribute('cy',y);circle.setAttribute('r',distance*px);circle.style.display=distance>0?'':'none';}
    
    line.setAttribute('x1',x);line.setAttribute('y1',y);line.setAttribute('x2',mouse.x);line.setAttribute('y2',mouse.y);const visible=canAttackPoint({...origin,elevation:token.document?.elevation??0},{...point,elevation:token.document?.elevation??0});line.setAttribute('stroke',!visible?'#e46868':band==='Out of range'?'#e46868':band==='Extended'?'#e8b54f':'#62c995');
    distanceLabel.style.display='block';distanceLabel.style.left=`${mouse.x+12}px`;distanceLabel.style.top=`${mouse.y+12}px`;const hovered=[...(c.tokens?.placeables??[])].reverse().find(t=>t.visible&&t.bounds?.contains(point.x,point.y));const context=hovered?targetContext(token,hovered):null;const prediction=context?targetHitChance(actor,source,action,token,hovered,context):null;distanceLabel.textContent=prediction?`${hovered.name} · ${context.distance} ft · ${prediction.chance}% HIT`:`${measured.effective.toFixed(1)} ft${visible?'':' · blocked'}`;distanceLabel.style.setProperty?.('--fus-hit-chance',`${prediction?.chance??0}%`);distanceLabel.title=prediction?[prediction.reason,...prediction.factors,`2d10 + ${prediction.bonus} vs DC ${prediction.dc}`].filter(Boolean).join(' · '):'';
    rangeStatus.textContent=`Direct ${measured.direct.toFixed(1)} ft · Grid ${measured.effective.toFixed(1)} ft · ${band}${profile.maximum?` (${profile.melee?'Reach '+profile.optimal:'Optimal '+profile.optimal+' / Max '+profile.maximum} ft)`:''}${prediction?` · ${prediction.factors.join(' · ')} · 2d10 + ${prediction.bonus}`:''}`;
   }else{svg.style.display='none';distanceLabel.style.display='none';rangeStatus.textContent=token?'Move the pointer onto the map to preview range.':'No actor token on this scene; range preview unavailable.';}
   frame=requestAnimationFrame(draw);
  };
  use.addEventListener('click',confirm);notice.querySelector('[data-target-cancel]').addEventListener('click',cancel);document.addEventListener('pointermove',move,{passive:true});document.addEventListener('keydown',key);document.addEventListener('keyup',keyUp);document.addEventListener('pointerdown',pick,true);refresh();draw();
 });
}
