import {isFUSActor} from './actor-types.mjs';
import {renderChatCard} from './chat-card.mjs';
import {SKILLS, focusId, focusLabel} from "./config.mjs";
export const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"}[c]));

export async function rollActor(actor, reference) {
  if (!actor || !isFUSActor(actor) || !actor.isOwner) throw new Error("You cannot roll for this character.");
  const {kind, key} = reference;
  let label, formula, data, detail;
  if (kind === "skill" && Object.hasOwn(SKILLS, key)) {
    label = SKILLS[key]; formula = "2d10 + @skill"; data = {skill: actor.system.skills[key]}; detail = `Skill ${data.skill}`;
  } else if (kind === "focus") {
    const focus = actor.system.focuses.find((f,i) => focusId(f,i) === reference.focusId);
    if (!focus || !Object.hasOwn(SKILLS, focus.skill)) throw new Error("This focus no longer exists on the character.");
    label = focusLabel(focus);
    formula = "2d10 + @skill + @focus";
    data = {skill: actor.system.skills[focus.skill], focus: focus.rank};
    detail = `${SKILLS[focus.skill]} ${data.skill} + focus ${data.focus}`;
  } else throw new Error("Invalid FUS roll.");
  const roll = new foundry.dice.Roll(formula, data);
  await roll.evaluate();
  return roll.toMessage({speaker: foundry.documents.ChatMessage.getSpeaker({actor}),
    flavor: await renderChatCard({title:label,subtitle:detail})});
}
export async function rollMacro(reference) {
  try {
    const actor = await fromUuid(reference.actorUuid);
    // Every execution resolves the current Actor and bonuses, even with its sheet closed.
    return await rollActor(actor, reference);
  } catch (error) { ui.notifications.error(error.message); }
}
export async function createRollMacro(data, slot) {
  if (data.type !== "FUSRoll") return;
  const actor = await fromUuid(data.actorUuid);
  if (!actor?.isOwner || !isFUSActor(actor)) throw new Error("You cannot create a roll macro for this character.");
  let label;
  if (data.kind === "skill" && Object.hasOwn(SKILLS, data.key)) label = SKILLS[data.key];
  else if (data.kind === "focus") {
    const focus = actor.system.focuses.find((f,i) => focusId(f,i) === data.focusId);
    if (!focus) throw new Error("This focus no longer exists on the character.");
    label = focusLabel(focus);
    // Persist legacy IDs before creating a macro so later removals cannot retarget it.
    if (actor.system.focuses.some(f => !f.id)) {
      await actor.update({"system.focuses": actor.system.focuses.map((f,i) => ({...f, id: focusId(f,i)}))});
    }
  } else throw new Error("Invalid FUS roll macro.");
  const reference = {actorUuid: actor.uuid, kind: data.kind,
    ...(data.kind === "skill" ? {key: data.key} : {focusId: data.focusId})};
  const command = `await game.FUS.rollMacro(${JSON.stringify(reference)});`;
  let macro = game.macros.find(m => m.type === "script" && m.command === command && m.isOwner);
  macro ??= await foundry.documents.Macro.create({name: `${actor.name}: ${label}`, type: "script", img: actor.img, command});
  await game.user.assignHotbarMacro(macro, slot);
  return macro;
}
export function onHotbarDrop(hotbar, data, slot) {
  if(data.type==='FUSAction'){createActionMacro(data,slot).catch(error=>ui.notifications.error(error.message));return false;}
  if (data.type !== "FUSRoll") return;
  // Hooks are synchronous; return false immediately rather than from an async callback.
  createRollMacro(data, slot).catch(error => ui.notifications.error(error.message));
  return false;
}

export async function actionMacro(reference){try{const actor=await fromUuid(reference.actorUuid),source=actor?.items?.get(reference.sourceId);if(!source)throw new Error('The source item is no longer available.');return await game.FUS.executeWeaponAction(actor,source,reference.actionId);}catch(error){ui.notifications.error(error.message);}}
export async function createActionMacro(data,slot){const actor=await fromUuid(data.actorUuid),source=actor?.items?.get(data.sourceId);if(!actor?.isOwner || !source)throw new Error('You cannot use this Action source.');const {loadSourceActions}=await import('./action-library.mjs');await loadSourceActions(source);const {sourceActions}=await import('./attacks.mjs');const action=sourceActions(source).find(a=>a.id===data.actionId);if(!action||action.missing)throw new Error('Action is unavailable.');const reference={actorUuid:actor.uuid,sourceId:source.id,actionId:action.id};const command=`await game.FUS.actionMacro(${JSON.stringify(reference)});`;let macro=game.macros.find(m=>m.type==='script'&&m.command===command&&m.isOwner);macro??=await foundry.documents.Macro.create({name:`${source.name}: ${action.name}`,type:'script',img:source.img,command});await game.user.assignHotbarMacro(macro,slot);return macro;}
