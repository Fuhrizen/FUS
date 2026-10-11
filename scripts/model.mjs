import {characterStats} from './health.mjs';
import {formMaximum} from './forms.mjs';
import {SKILLS} from "./config.mjs";
export class FUSCharacterData extends foundry.abstract.TypeDataModel {
  prepareBaseData() {
    super.prepareBaseData();

  }
  prepareDerivedData(){
    super.prepareDerivedData();
    const maximum=formMaximum(this.parent);
    if(maximum!==null)this.maxhp=maximum;
    this.maxhp=characterStats(this.parent).maximum;
    this.hp=Math.min(this.hp,this.maxhp);
  }
  static defineSchema() {
    const {StringField, NumberField, SchemaField, ArrayField} = foundry.data.fields;
    const text = () => new StringField({required: true, blank: true, initial: ""});
    // Ranks remain unrestricted; current HP is capped by Max HP.
    const number = (initial = 0) => new NumberField({required: true, nullable: false, initial});
    return {
      notes: text(),identity: text(),role: text(),affiliation: text(),appearance: text(),
      formItemId: text(),
      focusCounter: number(),
      memories: new ArrayField(new SchemaField({id: text(), title: text(), content: text(), tags: text()})),
      tagColours: new ArrayField(new SchemaField({tag: text(), colour: text()})),
      skills: new SchemaField(Object.fromEntries(Object.keys(SKILLS).map(key => [key, number()]))),
      focuses: new ArrayField(new SchemaField({
        id: text(),
        name: text(),
        defaultName: text(),
        skill: new StringField({required: true, blank: false, initial: "athletics", choices: Object.keys(SKILLS)}),
        rank: number()
      })),
      hp: number(),
      baseSpeed:number(15),
      maxhp: number()
    };
  }
}
