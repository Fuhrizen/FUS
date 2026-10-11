import {SKILLS} from './config.mjs';
import {mountActionDamage} from './action-damage.mjs';
import {validateComponent} from './damage.mjs';
const {HandlebarsApplicationMixin}=foundry.applications.api;
export class FUSActionSheet extends HandlebarsApplicationMixin(foundry.applications.sheets.ItemSheetV2){
 static DEFAULT_OPTIONS={classes:['fus-action-window'],tag:'form',position:{width:640,height:720},window:{resizable:true},form:{submitOnChange:false,closeOnSubmit:false},actions:{saveDefinition:async function(){try{await this.submit();}catch(e){ui.notifications.error(e.message);}}}};
 static PARTS={body:{template:'systems/FUS/templates/action-sheet.hbs',scrollable:['.fus-definition-editor']}};
 async _prepareContext(options){const a=this.document.system.action;return {...await super._prepareContext(options),item:this.document,action:a,editable:this.isEditable,damageJSON:JSON.stringify(a.damageComponents??[]),skills:Object.entries(SKILLS).map(([value,label])=>({value,label,selected:a.skill===value})),rolled:a.mode==='test',targetRequired:a.targetMode==='required',targetSelf:a.targetMode==='self',reset:a.resourceMode==='reset'};}
 async _onRender(...args){await super._onRender(...args);const root=this.element.querySelector('.fus-definition-editor');mountActionDamage(root);const refresh=()=>{const mode=root.querySelector('[name="system.action.mode"]').value,adjust=root.querySelector('[name="system.action.adjustResource"]').checked;for(const el of root.querySelectorAll('[data-roll-only]'))el.hidden=mode!=='test';for(const el of root.querySelectorAll('[data-resource-only]'))el.hidden=!adjust;root.querySelector('[data-resource-amount]').hidden=!adjust||root.querySelector('[name="system.action.resourceMode"]').value==='reset';};root.addEventListener('change',refresh);refresh();}
 _processFormData(event,form,data){const rows=JSON.parse(data.object.damageJSON||'[]');rows.forEach(validateComponent);delete data.object.damageJSON;data.object['system.action.damageComponents']=rows;return super._processFormData(event,form,data);}
}
