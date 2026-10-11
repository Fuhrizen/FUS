import {createActionField,createActionLinks} from './action-model.mjs';
import {migrateFormData} from './forms.mjs';
export class FUSFormData extends foundry.abstract.TypeDataModel {
  static migrateData(source){migrateFormData(source);return super.migrateData(source);}
  static defineSchema(){
    const {StringField,NumberField}=foundry.data.fields;
    const text=()=>new StringField({required:true,blank:true,initial:''});
    const number=(initial=null)=>new NumberField({required:true,nullable:true,initial,min:0});
    return {weaponActions:createActionField(),actionLinks:createActionLinks(),description:text(),maxhp:number(),move:number(15),rules:text()};
  }
}
