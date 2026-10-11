export const COVER_LEVELS={0:'None',2:'Cover',4:'Heavy cover',99:'Complete cover'};
const ftFactor=units=>/^(m|meters?|metres?)$/i.test(units??'')?3.280839895:1;
export const pixelsPerFoot=()=>canvas.grid.size/(canvas.grid.distance*ftFactor(canvas.grid.units));
const pointSegment=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l)):0;return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);};
export function regionEdges(region){return Array.from(region.polygons??[]).flatMap(p=>{const points=p.points??p;const edges=[];for(let i=0;i<points.length;i+=2){const j=(i+2)%points.length;edges.push([{x:points[i],y:points[i+1]},{x:points[j],y:points[j+1]}]);}return edges;});}
export function crossesRegion(a,b,region){
 const dx=b.x-a.x,dy=b.y-a.y,ts=[0,1];
 for(const [c,d]of regionEdges(region)){const ex=d.x-c.x,ey=d.y-c.y,den=dx*ey-dy*ex;if(Math.abs(den)<1e-9)continue;const t=((c.x-a.x)*ey-(c.y-a.y)*ex)/den,u=((c.x-a.x)*dy-(c.y-a.y)*dx)/den;if(t>0&&t<1&&u>=0&&u<=1)ts.push(t);}
 ts.sort((x,y)=>x-y);return ts.slice(1).some((end,i)=>{const t=(end+ts[i])/2;return region.testPoint({x:a.x+dx*t,y:a.y+dy*t,elevation:(a.elevation??0)+((b.elevation??0)-(a.elevation??0))*t});});
}
export function coverFor(origin,target,regions,{pxPerFoot=1,radius=0}={}){
 const matches=[];
 for(const region of regions){const c=region.flags?.FUS?.cover;if(!c||!Number(c.level))continue;
  if(region.testPoint(origin))continue;
  const inside=region.testPoint(target),distance=inside?0:Math.min(...regionEdges(region).map(([a,b])=>pointSegment(target,a,b)))-radius;
  if(distance>Math.max(0,Number(c.adjacency??5))*pxPerFoot)continue;
  const attackDistance=Math.hypot(origin.x-target.x,origin.y-target.y)/pxPerFoot;if(c.range>0&&attackDistance>c.range)continue;
  const bearing=(Math.atan2(origin.x-target.x,target.y-origin.y)*180/Math.PI+360)%360,diff=Math.abs(((bearing-Number(c.direction??0)+540)%360)-180);
  if(diff>Number(c.arc??360)/2||!crossesRegion(origin,target,region))continue;
  matches.push({name:region.name,level:Number(c.level),label:COVER_LEVELS[c.level]??'Cover',regionId:region.id});
 }
 return matches.sort((a,b)=>b.level-a.level)[0]??{level:0,label:'No cover',name:''};
}
export function hasLineOfSight(origin,target){const backend=globalThis.CONFIG?.Canvas?.polygonBackends?.sight;if(!backend)return true;return !backend.testCollision(origin,target,{type:'sight',mode:'any',level:canvas.level});}
export function targetContext(origin,token){const a={...origin.center,elevation:origin.document?.elevation??0},b={...token.center,elevation:token.document?.elevation??0};const distance=canvas.grid.measurePath([a,b]).distance*ftFactor(canvas.grid.units);const cover=coverFor(a,b,canvas.scene.regions??[],{pxPerFoot:pixelsPerFoot(),radius:Math.min(token.w,token.h)/2});return {distance:Math.round(distance*10)/10,los:hasLineOfSight(a,b),cover};}
export async function resolveOriginToken(actor){
 const tokens=globalThis.canvas?.tokens;if(!tokens||!globalThis.canvas?.ready)return null;
 const controlled=(tokens.controlled??[]).filter(t=>t.actor?.isOwner);const same=t=>t.actor?.uuid===actor.uuid||(actor.id&&t.document?.actorId===actor.id);
 const matching=controlled.filter(same);if(matching.length===1)return matching[0];
 if(controlled.length&&matching.length===0)throw new Error(`Select a token for ${actor.name} before using this action.`);
 const candidates=matching.length?matching:(tokens.placeables??[]).filter(t=>same(t)&&t.actor?.isOwner);
 if(candidates.length===1)return candidates[0];if(!candidates.length)throw new Error(`Place a token for ${actor.name} on the current scene.`);
 const id=await foundry.applications.api.DialogV2.wait({window:{title:'Choose acting token'},content:'<p>Which token is using this action?</p>',buttons:[...candidates.map(t=>({action:t.id,label:t.name,callback:()=>t.id})),{action:'cancel',label:'Cancel'}],rejectClose:false});return candidates.find(t=>t.id===id)??null;
}
export async function configureCover(region){if(!game.user.isGM)throw new Error('The GM configures cover.');const c=region.flags?.FUS?.cover??{};const values=await foundry.applications.api.DialogV2.wait({window:{title:`Cover: ${region.name}`},content:`<div class="fus-editor-form"><label>Protection<select name="level">${Object.entries(COVER_LEVELS).map(([v,n])=>`<option value="${v}" ${Number(c.level??0)===Number(v)?'selected':''}>${n}</option>`).join('')}</select></label><label>Adjacent distance (ft)<input type="number" name="adjacency" min="0" value="${Number(c.adjacency??5)}"></label><label>Maximum attack distance (ft, 0 = unlimited)<input type="number" name="range" min="0" value="${Number(c.range??0)}"></label><label>Protected direction (degrees; 0 = north)<input type="number" name="direction" value="${Number(c.direction??0)}"></label><label>Protected arc (degrees)<input type="number" name="arc" min="1" max="360" value="${Number(c.arc??360)}"></label><label><input type="checkbox" name="secret" ${c.secret?'checked':''}>Hide preview from players</label></div>`,buttons:[{action:'save',label:'Save',callback:(_e,b)=>Object.fromEntries(['level','adjacency','range','direction','arc'].map(k=>[k,Number(b.form.elements[k].value)]).concat([['secret',b.form.elements.secret.checked]]))},{action:'cancel',label:'Cancel'}],rejectClose:false});if(values&&typeof values==='object'){if(!Object.hasOwn(COVER_LEVELS,values.level)||!['adjacency','range','direction','arc'].every(k=>Number.isFinite(values[k]))||values.adjacency<0||values.range<0||values.arc<1||values.arc>360)throw new Error('Enter valid cover distances and arc.');await region.setFlag('FUS','cover',values);}}
