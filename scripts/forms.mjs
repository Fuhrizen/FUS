export function appliedForm(actor){return [...(actor.items??[])].find(item=>item.type==='form' && item.id===actor.system.formItemId);}
export function formMaximum(actor){const value=appliedForm(actor)?.system.maxhp;return typeof value==='number' && Number.isFinite(value)?value:null;}
export function migrateFormData(data){
  const s=data.system??data;
  if(s.move===undefined)s.move=s.defaults?.move??15;
  if(s.maxhp===undefined)s.maxhp=null;
  if(s.rules===undefined)s.rules=[s.physiology,s.structure,s.interactions,s.defaults?.equipLimit!=null?`Equip Limit: ${s.defaults.equipLimit}`:'',s.source].filter(Boolean).join('\n\n');
  return data;
}
