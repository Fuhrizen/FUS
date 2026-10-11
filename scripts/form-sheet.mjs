import {loadSourceActions} from './action-library.mjs';
import {resourceCostLabel,sourceActions} from './attacks.mjs';
import {costPips} from './action-damage.mjs';
import {FUSItemSheet} from './item-sheet.mjs';
const {HandlebarsApplicationMixin}=foundry.applications.api;
export class FUSFormSheet extends HandlebarsApplicationMixin(foundry.applications.sheets.ItemSheetV2){
  static DEFAULT_OPTIONS={classes:['fus-form-window'],tag:'form',position:{width:560,height:670},window:{resizable:true},form:{submitOnChange:true,closeOnSubmit:false},actions:{editWeaponAction:FUSItemSheet.editWeaponAction,removeWeaponAction:FUSItemSheet.removeWeaponAction,moveEntry:FUSItemSheet.moveEntry,useWeaponActions:FUSItemSheet.useWeaponActions}};
  static PARTS={body:{template:'systems/FUS/templates/form-sheet.hbs',scrollable:['.fus-form-sheet']}};
  async _prepareContext(options){await loadSourceActions(this.document);return {...await super._prepareContext(options),item:this.document,system:this.document.system,editable:this.isEditable,owned:!!this.document.parent,weaponActions:sourceActions(this.document).map((a,index)=>({...a,index,resourceCost:resourceCostLabel(this.document,a),costPips:costPips(a.cost),test:a.mode==='test'}))};}
  async _onRender(...args){await super._onRender(...args);FUSItemSheet.mountActionDrop.call(this);}
  _processFormData(event,form,data){
    for(const key of ['maxhp','move']){
      const path=`system.${key}`;
      if(data.object[path]==='')data.object[path]=key==='maxhp' && this.document?.parent ? this.document.system.maxhp : null;
    }
    return super._processFormData(event,form,data);
  }
}
