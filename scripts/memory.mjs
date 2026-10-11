// Plain text notebook helpers. No external search service or animation.
export const normalize = value => String(value ?? '').normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase();
export function parseTags(csv) {
  const tags=[];let value='',quoted=false;
  const input=String(csv ?? '');
  for(let i=0;i<input.length;i++) {
    const c=input[i];
    if(c==='"') {if(quoted && input[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}
    else if((c===',' || /\s/.test(c)) && !quoted){tags.push(value.trim());value='';}
    else value+=c;
  }
  tags.push(value.trim());const seen=new Set();
  return tags.filter(tag=>{const key=normalize(tag);if(!key || seen.has(key))return false;seen.add(key);return true;});
}
export function tagColour(tag, overrides=[]) {
  const key=normalize(tag);const override=overrides.find(entry=>normalize(entry.tag)===key);
  if(override && /^#[0-9a-f]{6}$/i.test(override.colour)) return override.colour;
  let hash=0;for(const c of key)hash=(Math.imul(hash,31)+c.codePointAt(0))>>>0;
  const h=(hash%360)/60,s=.48,l=.74,c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs(h%2-1)),m=l-c/2;
  const rgb=h<1?[c,x,0]:h<2?[x,c,0]:h<3?[0,c,x]:h<4?[0,x,c]:h<5?[x,0,c]:[c,0,x];
  return '#'+rgb.map(v=>Math.round((v+m)*255).toString(16).padStart(2,'0')).join('');
}
export function tagStyle(tag, overrides) {
  const colour=tagColour(tag,overrides);const [r,g,b]=colour.slice(1).match(/../g).map(v=>parseInt(v,16));
  return `background-color:${colour};color:${(.299*r+.587*g+.114*b)>150?'#111111':'#ffffff'};`;
}
export function memoryScore(memory, query) {
  const title=normalize(memory.title),body=normalize(memory.content),tags=parseTags(memory.tags).map(normalize);
  const terms=String(query??'').match(/tag:"[^"]*"|"[^"]*"|\S+/g)??[];
  if(!terms.length) return 1;
  let score=0,hits=0;
  for(const raw of terms) {
    const tagOnly=raw.toLowerCase().startsWith('tag:');
    const term=normalize((tagOnly?raw.slice(4):raw).replace(/^"|"$/g,''));
    if(!term)continue;
    const variants=term.endsWith('s') && term.length>3?[term,term.slice(0,-1)]:[term];
    const includes=value=>variants.some(v=>value.includes(v));
    const tagHit=tags.some(includes);
    const points=tagOnly?(tagHit?16:0):(includes(title)?12:0)+(tagHit?10:0)+(includes(body)?3:0);
    if(tagOnly && !tagHit)return 0;
    if(points){score+=points;hits++;}
  }
  return hits?score+(hits===terms.length?40:0):0;
}
export function memoryRows(memories=[], query='', overrides=[], open=new Set()) {
  return memories.map((memory,index)=>({...memory,index,open:open.has(memory.id),score:memoryScore(memory,query),
    tagRows:parseTags(memory.tags).map(tag=>({label:tag,style:tagStyle(tag,overrides)}))
  })).sort((a,b)=>(query.trim()?b.score-a.score:0)||a.title.localeCompare(b.title,undefined,{sensitivity:'base',numeric:true})||a.index-b.index);
}
export const serializeTags = tags => tags.map(tag=>/[\s,"]/.test(tag)?`"${tag.replaceAll('"','""')}"`:tag).join(', ');
export async function enrichMemory(content, actor) {
  const {escapeHTML}=await import('./rolls.mjs');
  const safe=escapeHTML(content).replace(/\r?\n/g,'<br>');
  const editor=globalThis.foundry?.applications?.ux?.TextEditor;
  return editor?editor.enrichHTML(safe,{documents:true,links:true,rolls:false,embeds:false,custom:true,secrets:false,relativeTo:actor}):safe;
}
