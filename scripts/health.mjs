import {appliedForm} from './forms.mjs';
export function characterStats(actor,{baseHP=null}={}){
 const form=appliedForm(actor),base=Number(baseHP??form?.system.maxhp??actor._source?.system.maxhp??actor.system.maxhp??0),speed=Number(form?.system.move??actor.system.baseSpeed??15);
 const armour=[...(actor.items??[])].filter(i=>i.type==='armour' && i.system.equipped && (i.system.quantity??1)>0);
 const hpSources=[{name:form?.name??'Base health',value:base}],speedSources=[{name:form?.name??'Base speed',value:speed}];
 for(const item of armour){if(item.system.healthBonus)hpSources.push({name:item.name,value:Number(item.system.healthBonus)});if(item.system.speedBonus)speedSources.push({name:item.name,value:Number(item.system.speedBonus)});}
 const maximum=Math.max(0,hpSources.reduce((n,s)=>n+s.value,0)),move=Math.max(0,speedSources.reduce((n,s)=>n+s.value,0));
 const describe=sources=>sources.map(s=>`${s.name}: ${s.value>=0?'+':''}${s.value}`).join('\n');
 return {maximum,move,baseHP:base,hpTooltip:describe(hpSources),speedTooltip:describe(speedSources),hpSources,speedSources,modified:hpSources.length>1};
}

export function healthAfterCapacityChange(current,before,after){return Math.max(0,Math.min(after,current+Math.max(0,after-before)));}
