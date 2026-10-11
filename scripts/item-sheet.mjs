import {costPips,chooseActionDamage} from './action-damage.mjs';
import {SKILLS,focusId,focusLabel} from './config.mjs';
import {escapeHTML} from './rolls.mjs';
import {DEFAULT_ATTACK,openSourceActions} from './attacks.mjs';
import {DAMAGE_TYPES,DAMAGE_STYLES,validateComponent} from './damage.mjs';
const {HandlebarsApplicationMixin}=foundry.applications.api;
export class FUSItemSheet extends HandlebarsApplicationMixin(foundry.applications.sheets.ItemSheetV2){
  static DEFAULT_OPTIONS={classes:['fus-item-window'],tag:'form',position:{width:620,height:700},window:{resizable:true},form:{submitOnChange:true,closeOnSubmit:false},actions:{moveEntry:FUSItemSheet.moveEntry,addWeaponAction:FUSItemSheet.editWeaponAction,editWeaponAction:FUSItemSheet.editWeaponAction,removeWeaponAction:FUSItemSheet.removeWeaponAction,useWeaponActions:FUSItemSheet.useWeaponActions,chooseIcon:FUSItemSheet.chooseIcon,addComponent:FUSItemSheet.editComponent,removeComponent:FUSItemSheet.editComponent,rollDamage:FUSItemSheet.rollDamage}};
  static PARTS={body:{template:'systems/FUS/templates/item-sheet.hbs',scrollable:['.fus-item-sheet']}};
  async _prepareContext(options){
    const weapon=this.document.type==='weapon',armour=this.document.type==='armour';
    const rows=(armour?this.document.system.adjustments:[])??[];
    return {...await super._prepareContext(options),item:this.document,system:this.document.system,editable:this.isEditable,weapon,armour,misc:this.document.type==='item',melee:this.document.system.combatMode==='melee',weaponActions:Array.from(this.document.system.weaponActions??[]).map(a=>({...a,costPips:costPips(a.cost),index:Array.from(this.document.system.weaponActions??[]).indexOf(a),test:a.mode==='test'})),owned:!!this.document.parent,components:rows.map((row,index)=>({...row,index,damageLabel:DAMAGE_TYPES[row.type],damageStyle:DAMAGE_STYLES[row.type],types:Object.entries(DAMAGE_TYPES).map(([value,label])=>({value,label,selected:row.type===value})),resistance:row.kind==='resistance',weakness:row.kind==='weakness'}))};
  }
  _scrollPosition = 0;
  _componentBusy = false;
  async _onRender(context,options){
    await super._onRender(context,options);
    const scroller=this.element.querySelector('.fus-item-sheet');
    if(scroller){
      scroller.scrollTop=this._scrollPosition;
      scroller.addEventListener('scroll',()=>{this._scrollPosition=scroller.scrollTop;},{passive:true});
    }
    if(this._focusComponent!==undefined){
      const input=this.element.querySelector(`[data-component-index="${this._focusComponent}"] input`);
      input?.focus({preventScroll:true});input?.select();this._focusComponent=undefined;
    }
  }
  _processFormData(event,form,data){
    const result=super._processFormData(event,form,data);
    if(this.document.type==='weapon' && result.system){
      if((result.system.combatMode??this.document.system.combatMode)==='melee')result.system.maximum=Number(result.system.optimal??this.document.system.optimal);
      const current=Number(result.system.resourceCurrent??this.document.system.resourceCurrent),max=Number(result.system.resourceMax??this.document.system.resourceMax);
      if(![current,max].every(n=>Number.isSafeInteger(n)&&n>=0))throw new Error('Charges/Ammo must be non-negative whole numbers.');
      if(result.system.resourceCurrent!==undefined || result.system.resourceMax!==undefined)result.system.resourceCurrent=Math.min(current,max);
    }
    const key=this.document.type==='weapon'?'damage':this.document.type==='armour'?'adjustments':null;
    if(key){const raw=result.system?.[key];if(raw){const rows=Array.isArray(raw)?raw:Object.values(raw);rows.forEach(validateComponent);result.system[key]=rows;}}
    return result;
  }
  static async editComponent(event,target){
    if(!this.isEditable || this.document.type!=='armour' || this._componentBusy)return;
    this._componentBusy=true;
    const position=this.element.querySelector('.fus-item-sheet')?.scrollTop??this._scrollPosition;
    try{
      await this.submit();
      const key='adjustments';
      const rows=Array.from(this.document.system[key]??[],r=>({...r}));
      if(target.dataset.action==='removeComponent')rows.splice(Number(target.dataset.index),1);
      else {rows.push({type:'bludgeoning',formula:'0',...(key==='adjustments'?{kind:'resistance'}:{})});this._focusComponent=rows.length-1;}
      this._scrollPosition=position;
      await this.document.update({[`system.${key}`]:rows},{render:false});
      await this.render({force:true});
    }catch(error){ui.notifications.error(error.message);}finally{this._componentBusy=false;}
  }
  static async moveEntry(event,target){
    if(!this.isEditable)return;await this.submit();
    const key=target.dataset.list,index=Number(target.dataset.index),next=index+Number(target.dataset.direction);
    if(!['weaponActions','adjustments'].includes(key))return;
    const rows=Array.from(this.document.system[key]??[],r=>({...r}));if(next<0 || next>=rows.length)return;
    [rows[index],rows[next]]=[rows[next],rows[index]];
    await this.document.update({[`system.${key}`]:rows},{render:false});await this.render({force:true});
  }
  static async useWeaponActions(){if(!this.isEditable || !this.document.parent)return;try{await this.submit();await openSourceActions(this.document.parent,this.document);}catch(e){ui.notifications.error(e.message);}}
  static async removeWeaponAction(event,target){
    if(!this.isEditable)return;await this.submit();
    const actions=Array.from(this.document.system.weaponActions??[],a=>({...a}));
    const action=actions.find(a=>a.id===target.dataset.actionId);if(!action)return;
    if(!await foundry.applications.api.DialogV2.confirm({window:{title:'Remove action'},content:`<p>Remove ${escapeHTML(action.name)}?</p>`,rejectClose:false}))return;
    await this.document.update({'system.weaponActions':actions.filter(a=>a.id!==action.id)});
  }
  static async editWeaponAction(event,target){
    if(!this.isEditable)return;await this.submit();
    const actions=Array.from(this.document.system.weaponActions??[],a=>({...a}));
    const existing=actions.find(a=>a.id===target.dataset.actionId);
    const action=existing??{...DEFAULT_ATTACK,skill:this.document.type!=='weapon'?'athletics':'',mode:this.document.type==='weapon'?'test':'none',damage:this.document.type==='weapon',id:foundry.utils.randomID()};
    const skillOptions=Object.entries(SKILLS).map(([key,label])=>`<option value="${key}" ${action.skill===key?'selected':''}>${escapeHTML(label)}</option>`).join('');
    const actor=this.document.parent;
    if(actor?.system.focuses?.some(f=>!f.id))await actor.update({'system.focuses':actor.system.focuses.map((f,i)=>({...f,id:focusId(f,i)}))});
    const focuses=(actor?.system.focuses??[]).map((f,i)=>({...f,id:focusId(f,i)}));
    const currentFocus=focuses.find(f=>f.id===action.focusId)??focuses.find(f=>f.name===action.focusName && (!action.skill || f.skill===action.skill));
    const focusOptions=focuses.map(f=>`<option data-skill="${f.skill}" value="${escapeHTML(f.id)}" ${f.id===currentFocus?.id?'selected':''}>${escapeHTML(focusLabel(f))} · ${escapeHTML(SKILLS[f.skill])} (${f.rank})</option>`).join('');
    const focusControl=actor?`<label>Focus <select name="focus"><option value="">Parent skill only</option>${action.focusId&&!currentFocus?`<option value="${escapeHTML(action.focusId)}" selected>Unavailable: ${escapeHTML(action.focusName||'Deleted Focus')}</option>`:''}${focusOptions}</select></label>`:`<label>Focus name (resolved on import) <input name="focusName" value="${escapeHTML(action.focusName??'')}" placeholder="Optional exact Focus name"></label>`;
    const values=await foundry.applications.api.DialogV2.wait({window:{title:existing?'Edit action':'Add action'},position:{width:460},content:`<div class="fus-editor-form fus-action-editor" data-source-type="${this.document.type}" data-has-resource="${(this.document.system.resourceCurrent??0)>0 || (this.document.system.resourceMax??0)>0}"><label>Name <input name="name" value="${escapeHTML(action.name)}" required></label><label>Action cost <input type="number" name="cost" min="1" step="1" value="${action.cost}" required></label><label>Resolution <select name="mode"><option value="test" ${action.mode==='test'?'selected':''}>Roll</option><option value="none" ${action.mode==='none'?'selected':''}>No roll / post to chat</option></select></label><label>Target <select name="targetMode"><option value="none" ${(!action.targetMode || action.targetMode==='none')?'selected':''}>No target</option><option value="required" ${action.targetMode==='required'?'selected':''}>Requires target</option><option value="self" ${action.targetMode==='self'?'selected':''}>Target self</option></select></label><label>Parent skill <select name="skill" data-default-skill="${this.document.type!=='weapon'?'athletics':this.document.system.combatMode==='melee'?'meleeCombat':'rangedCombat'}"><option value="">Source default</option>${skillOptions}</select></label>${focusControl}<label><input type="checkbox" name="requiresFocus" ${action.requiresFocus?'checked':''}> Must have a Focus</label><label><input type="checkbox" name="adjustResource" ${action.adjustResource?'checked':''}> Adjust ${this.document.system.combatMode==='melee'?'Charges':'Ammo'} when used</label><label>Resource change <select name="resourceMode"><option value="adjust" ${action.resourceMode!=='reset'?'selected':''}>Adjust by signed amount</option><option value="reset" ${action.resourceMode==='reset'?'selected':''}>Reset to maximum</option></select></label><label>Amount (+ adds, − spends) <input name="resourceAmount" type="number" step="1" value="${action.resourceAmount??-1}"></label><label>Roll modifier <input name="modifier" type="number" value="${action.modifier}" required></label><label><input type="checkbox" name="damage" ${action.damage?'checked':''}> Offer action damage</label><input type="hidden" name="damageJSON" value="${escapeHTML(JSON.stringify(action.damageComponents??[]))}"><details open><summary>Action damage</summary><div data-action-damage></div><button type="button" data-add-action-damage>Add damage component</button></details><label>Rules <textarea name="description" rows="4">${escapeHTML(action.description)}</textarea></label></div>`,buttons:[{action:'save',label:'Save',default:true,callback:(_e,b)=>{const f=b.form.elements;return {id:action.id,name:f.name.value.trim(),cost:Number(f.cost.value),mode:f.mode.value,targetMode:f.targetMode.value,skill:f.skill.value,focusActorUuid:actor?.uuid??'',focusId:f.focus?.value??'',focusName:f.focus?focuses.find(entry=>entry.id===f.focus.value)?.name??(f.focus.value?action.focusName:''):f.focusName.value,adjustResource:this.document.type!=='form' && ((this.document.system.resourceCurrent??0)>0 || (this.document.system.resourceMax??0)>0) && f.adjustResource.checked,resourceMode:f.resourceMode.value,resourceAmount:Number(f.resourceAmount.value),requiresFocus:f.requiresFocus.checked,modifier:Number(f.modifier.value),damage:f.damage.checked,damageComponents:JSON.parse(f.damageJSON.value||'[]'),description:f.description.value};}},{action:'cancel',label:'Cancel'}],rejectClose:false});
    if(!values || typeof values!=='object')return;
    try{values.damageComponents.forEach(validateComponent);}catch(e){ui.notifications.error(e.message);return;}
    if(!Number.isSafeInteger(values.resourceAmount) || !values.name || !Number.isInteger(values.cost) || values.cost<1 || ![values.modifier].every(Number.isFinite)){ui.notifications.error('Enter a name, positive action cost, valid modifier.');return;}
    const linked=focuses.find(f=>f.id===values.focusId);if(linked)values.skill=linked.skill;
    const current=Array.from(this.document.system.weaponActions??[],a=>({...a}));
    const index=current.findIndex(a=>a.id===values.id);if(index>=0)current[index]=values;else current.push(values);
    await this.document.update({'system.weaponActions':current});
  }
  static async rollDamage(){if(!this.isEditable)return;try{await this.submit();await chooseActionDamage(this.document.parent,this.document);}catch(e){ui.notifications.error(e.message);}}
  static async chooseIcon(){if(!this.isEditable)return;await new foundry.applications.apps.FilePicker.implementation({type:'image',current:this.document.img,callback:path=>this.document.update({img:path})}).browse();}
}
