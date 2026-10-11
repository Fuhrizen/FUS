import {baselineForm} from './forms.mjs';
export const isFUSActor=actor=>['character','npc'].includes(actor?.type);
export function actorCreationDefaults(actor,data){if(!isFUSActor(actor))return;const changes={'prototypeToken.actorLink':actor.type==='character'};if(data.system?.maxhp===undefined)changes['system.maxhp']=6;if(data.system?.hp===undefined)changes['system.hp']=Number(data.system?.maxhp??6);const items=Array.from(data.items??[],i=>structuredClone(i));let form=items.find(i=>i.type==='form'&&i._id===data.system?.formItemId)??items.find(i=>i.type==='form');if(!form){form=baselineForm(data.system?.maxhp??6);items.push(form);}form._id??=globalThis.foundry?.utils?.randomID?.()??'fusDefaultForm01';form.system.maxhp??=data.system?.maxhp??6;changes.items=items;changes['system.formItemId']=form._id;actor.updateSource(changes);}

export function sceneCreationDefaults(scene,data){scene.updateSource({'grid.distance':data.grid?.distance??5,'grid.units':data.grid?.units??'ft'});}
