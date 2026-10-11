export const carried=item=>item.system?.carryState??(item.system?.equipped?'worn':'stowed');
export const held=item=>carried(item)==='held'?Number(item.system.handsHeld??1):0;
export function handCapacity(actor){const form=[...(actor.items??[])].find(i=>i.type==='form'&&i.id===actor.system?.formItemId);const n=Number(form?.system.hands??2);return Number.isSafeInteger(n)&&n>=0?n:2;}
export function handUsage(actor){const capacity=handCapacity(actor);const used=[...(actor.items??[])].reduce((n,i)=>n+held(i),0);return {used,free:Math.max(0,capacity-used),capacity};}
export function checkHands(actor,source,action){
 const usage=handUsage(actor);
 if(source.type==='weapon'&&source.system.carryState!==undefined&&!action.allowStowed){const required=Number(action.sourceHands||source.system.handsRequired||1);if(held(source)<required)throw new Error(`Hold ${source.name} in ${required} hand${required===1?'':'s'} to use this action.`);}
 else if(action.sourceHands>0&&held(source)<action.sourceHands)throw new Error(`This action requires ${action.sourceHands} hands holding its source.`);
 if(usage.used>usage.capacity)throw new Error('Too many hands occupied. Stow an item first.');
 if(usage.free<Number(action.freeHands??0))throw new Error(`Requires ${action.freeHands} free hand(s).`);
 if(usage.used<Number(action.usedHands??0))throw new Error(`Requires ${action.usedHands} occupied hand(s).`);
}
export function checkRequiredCarry(item,action){if(action.requiredItemState==='equipped'&&carried(item)==='stowed')throw new Error(`Equip ${item.name} first.`);if((action.requiredItemState==='held'||action.requiredItemHands>0)&&held(item)<Math.max(1,Number(action.requiredItemHands??0)))throw new Error(`Hold ${item.name} in ${Math.max(1,Number(action.requiredItemHands??0))} hand(s).`);}
export function validCarry(item,changes){if(!item.parent||!['weapon','armour','item'].includes(item.type))return true;const system={...item.system,...changes.system};for(const [key,value]of Object.entries(changes))if(key.startsWith('system.'))system[key.slice(7)]=value;const next={...item,system};const count=held(next);if(!Number.isInteger(count)||count<0||count>2||carried(next)==='held'&&count<1)return false;const other=[...(item.parent.items??[])].filter(i=>i.id!==item.id).reduce((n,i)=>n+held(i),0);return count+other<=handCapacity(item.parent)||count<held(item);}
const queues=new WeakMap();
export function equipItem(actor,item,state,hands=0){const previous=queues.get(actor)??Promise.resolve();const task=previous.catch(()=>{}).then(async()=>{if(!actor.isOwner||item.parent?.uuid!==actor.uuid)throw new Error('Equip an item owned by this character.');if(!['stowed','worn','held'].includes(state))throw new Error('Choose a valid carry state.');const changes={'system.carryState':state,'system.handsHeld':state==='held'?hands:0};if(item.type==='armour')changes['system.equipped']=state!=='stowed';if(!validCarry(item,changes))throw new Error('The selected Form has insufficient free hands. Stow another item first.');await item.update(changes);});queues.set(actor,task);return task;}
export function stowedCopy(data){if(['weapon','armour','item'].includes(data.type)){data.system.carryState='stowed';data.system.handsHeld=0;if(data.type==='armour')data.system.equipped=false;}return data;}

export async function reconcileHands(actor){if(!actor?.isOwner)return;let usage=handUsage(actor);for(const item of [...(actor.items??[])].reverse()){if(usage.used<=usage.capacity)break;if(!held(item))continue;await equipItem(actor,item,'stowed');usage=handUsage(actor);}}
