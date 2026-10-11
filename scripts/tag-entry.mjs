import {parseTags,serializeTags,normalize,tagStyle} from './memory.mjs';
export function setupTagEntry(root,overrides=[],{fieldName='tags',onCommit=()=>{}}={}) {
  const control=root.querySelector('.fus-tag-entry');if(!control)return;
  const hidden=control.querySelector(`[name="${fieldName}"]`),input=control.querySelector('[data-tag-entry]'),boxes=control.querySelector('.fus-tag-boxes');
  let tags=parseTags(hidden.value);
  const sync=()=>{hidden.value=serializeTags(parseTags(serializeTags(tags)+(input.value?', '+input.value:'')));};
  const draw=()=>{
    boxes.replaceChildren();
    for(const tag of tags){const chip=root.ownerDocument.createElement('span');chip.className='fus-tag';chip.style.cssText=tagStyle(tag,overrides);chip.append(root.ownerDocument.createTextNode(tag));
      const remove=root.ownerDocument.createElement('button');remove.type='button';remove.textContent='×';remove.title=`Remove tag ${tag}`;remove.setAttribute('aria-label',remove.title);
      remove.addEventListener('click',()=>{tags=tags.filter(value=>normalize(value)!==normalize(tag));draw();sync();input.focus();onCommit(hidden.value);});chip.append(remove);boxes.append(chip);
    }
  };
  const commit=()=>{tags=parseTags(serializeTags(tags)+', '+input.value);input.value='';draw();sync();onCommit(hidden.value);};
  input.addEventListener('input',()=>{const raw=input.value;const quotes=(raw.match(/"/g)??[]).length;if(/[\s,]$/.test(raw)&&quotes%2===0)commit();else sync();});
  input.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===','){if((input.value.match(/"/g)??[]).length%2===0){event.preventDefault();commit();}}else if(event.key==='Backspace'&&!input.value&&tags.length){input.value=tags.pop();draw();sync();}});
  input.addEventListener('blur',()=>{if(input.value.trim())commit();});
  control.addEventListener('click',event=>{if(event.target===control||event.target===boxes)input.focus();});
  draw();sync();
}
