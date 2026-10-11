export const isFUSActor=actor=>['character','npc'].includes(actor?.type);
export function actorCreationDefaults(actor,data){if(!isFUSActor(actor))return;const changes={'prototypeToken.actorLink':actor.type==='character'};if(data.system?.maxhp===undefined)changes['system.maxhp']=6;if(data.system?.hp===undefined)changes['system.hp']=Number(data.system?.maxhp??6);actor.updateSource(changes);}

export function sceneCreationDefaults(scene,data){scene.updateSource({'grid.distance':data.grid?.distance??5,'grid.units':data.grid?.units??'ft'});}
