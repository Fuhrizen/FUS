import {attachAction,loadSourceActions,loadAction,migrateSourceActions} from './action-library.mjs';
import {sourceActions} from './attacks.mjs';
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
    await loadSourceActions(this.document);
    const weapon=this.document.type==='weapon',armour=this.document.type==='armour';
    const rows=(armour?this.document.system.adjustments:[])??[];
    return {...await super._prepareContext(options),item:this.document,system:this.document.system,editable:this.isEditable,weapon,armour,misc:this.document.type==='item',melee:this.document.system.combatMode==='melee',weaponActions:sourceActions(this.document).map((a,index)=>({...a,index,costPips:costPips(a.cost),test:a.mode==='test'})),owned:!!this.document.parent,components:rows.map((row,index)=>({...row,index,damageLabel:DAMAGE_TYPES[row.type],damageStyle:DAMAGE_STYLES[row.type],types:Object.entries(DAMAGE_TYPES).map(([value,label])=>({value,label,selected:row.type===value})),resistance:row.kind==='resistance',weakness:row.kind==='weakness'}))};
  }
  _scrollPosition = 0;
  _componentBusy = false;
  async _onRender(context,options){
    await super._onRender(context,options);
    FUSItemSheet.mountActionDrop.call(this);
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
    const key=target.dataset.list==='weaponActions'&&this.document.system.actionLinks?.length?'actionLinks':target.dataset.list,index=Number(target.dataset.index),next=index+Number(target.dataset.direction);
    if(!['weaponActions','actionLinks','adjustments'].includes(key))return;
    const rows=Array.from(this.document.system[key]??[],r=>({...r}));if(next<0 || next>=rows.length)return;
    [rows[index],rows[next]]=[rows[next],rows[index]];
    await this.document.update({[`system.${key}`]:rows},{render:false});await this.render({force:true});
  }
  static async useWeaponActions(){if(!this.isEditable || !this.document.parent)return;try{await this.submit();await openSourceActions(this.document.parent,this.document);}catch(e){ui.notifications.error(e.message);}}
  static mountActionDrop(){const root=this.element.querySelector('[data-action-drop]');if(!root||!this.isEditable)return;root.addEventListener('dragover',e=>e.preventDefault());root.addEventListener('drop',async e=>{e.preventDefault();e.stopPropagation();try{await this.submit();const item=await foundry.documents.Item.fromDropData(foundry.applications.ux.TextEditor.getDragEventData(e));await attachAction(this.document,item);}catch(error){ui.notifications.error(error.message);}});}
  static async removeWeaponAction(event,target){
    if(!this.isEditable)return;await this.submit();await this.document.update({'system.actionLinks':Array.from(this.document.system.actionLinks??[]).filter(a=>a.id!==target.dataset.actionId)});
  }
  static async editWeaponAction(event,target){
    if(!this.isEditable)return;await this.submit();
    if(this.document.system.weaponActions?.length && game.user.isGM)await migrateSourceActions(this.document);
    if(target.dataset.actionId){const link=this.document.system.actionLinks?.find(l=>l.id===target.dataset.actionId);const definition=link?await loadAction(link.uuid):null;if(!definition)throw new Error('Action definition is unavailable.');await definition.sheet.render({force:true});return;}
    const definitions=game.items.filter(i=>i.type==='action').sort((a,b)=>a.name.localeCompare(b.name));
    const selected=await foundry.applications.api.DialogV2.wait({window:{title:'Link an Action'},content:`<label>Shared Action<select name="uuid">${definitions.map(i=>`<option value="${escapeHTML(i.uuid)}">${escapeHTML(i.name)}</option>`).join('')}</select></label><p>You can also drag an Action from a compendium onto this section.</p>`,buttons:[{action:'link',label:'Link',callback:(_e,b)=>b.form.elements.uuid.value},{action:'new',label:'Create Action',callback:()=> 'new'},{action:'cancel',label:'Cancel'}],rejectClose:false});
    if(!selected||selected==='cancel')return;
    const item=selected==='new'?await foundry.documents.Item.create({name:'New Action',type:'action',system:{action:{...DEFAULT_ATTACK,skill:'',focusId:'',focusActorUuid:''}}}):await loadAction(selected);
    await attachAction(this.document,item);if(selected==='new')await item.sheet.render({force:true});
  }
  static async rollDamage(){if(!this.isEditable)return;try{await this.submit();await chooseActionDamage(this.document.parent,this.document);}catch(e){ui.notifications.error(e.message);}}
  static async chooseIcon(){if(!this.isEditable)return;await new foundry.applications.apps.FilePicker.implementation({type:'image',current:this.document.img,callback:path=>this.document.update({img:path})}).browse();}
}
