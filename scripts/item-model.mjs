import {createActionField,createActionLinks} from './action-model.mjs';
import {DAMAGE_TYPES} from './damage.mjs';
const text=()=>new foundry.data.fields.StringField({required:true,blank:true,initial:''});
const number=()=>new foundry.data.fields.NumberField({required:true,nullable:false,initial:0,min:0});
function componentFields(){const {StringField}=foundry.data.fields;return {type:new StringField({required:true,initial:'bludgeoning',choices:Object.keys(DAMAGE_TYPES)}),formula:new StringField({required:true,blank:false,initial:'0'})};}
export class FUSItemData extends foundry.abstract.TypeDataModel {
  static defineSchema(){return {weaponActions:createActionField(),actionLinks:createActionLinks(),quantity:new foundry.data.fields.NumberField({required:true,nullable:false,initial:1,min:0,integer:true}),description:text(),ammoType:text()};}
}
export class FUSWeaponData extends FUSItemData {
  static migrateData(source){
    if(source.reach>0 && !(source.optimal>0) && !(source.maximum>0)){source.optimal=source.reach;source.maximum=source.reach;}
    for(const action of source.weaponActions??[])if(action.requiredTags){action.requiresFocus=true;delete action.requiredTags;}
    if(source.damage?.length){
      if(!source.weaponActions?.length)source.weaponActions=[{id:'attack',name:'Attack',cost:1,mode:'test',damage:true}];
      for(const action of source.weaponActions)if(action.damage!==false && action.mode!=='none' && !action.damageComponents?.length)action.damageComponents=source.damage.map(row=>({...row}));
    }
    delete source.damage;
    delete source.focusKeys;
    delete source.reach;
    return super.migrateData(source);
  }
  static defineSchema(){return {...super.defineSchema(),resourceCurrent:new foundry.data.fields.NumberField({required:true,initial:0,min:0,integer:true}),resourceMax:new foundry.data.fields.NumberField({required:true,initial:0,min:0,integer:true}),combatMode:new foundry.data.fields.StringField({required:true,initial:'ranged',choices:['ranged','melee']}),optimal:number(),maximum:number()};}
}
export class FUSArmourData extends FUSItemData {
  static defineSchema(){const {ArrayField,SchemaField,StringField,BooleanField}=foundry.data.fields;return {...super.defineSchema(),healthBonus:new foundry.data.fields.NumberField({required:true,initial:0}),speedBonus:new foundry.data.fields.NumberField({required:true,initial:0}),equipped:new BooleanField({initial:false}),adjustments:new ArrayField(new SchemaField({...componentFields(),kind:new StringField({required:true,initial:'resistance',choices:['resistance','weakness']})}))};}
}
