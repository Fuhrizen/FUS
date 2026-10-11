export const SKILLS = {
  athletics: "Athletics", meleeCombat: "Melee Combat", mobility: "Acrobatics",
  rangedCombat: "Ranged Combat", ride: "Ride", stealth: "Stealth",
  awareness: "Awareness", knowledge: "Knowledge", medicine: "Medicine",
  survival: "Survival", systems: "Systems", craft: "Craft",
  deception: "Deception", influence: "Influence", insight: "Insight"
};

// Presentation groups only; they do not alter skill rules.
export const SKILL_GROUPS = [
  {id: "combat", label: "Combat", keys: ["meleeCombat", "rangedCombat"]},
  {id: "movement", label: "Movement & Stealth", keys: ["athletics", "mobility", "ride", "stealth"]},
  {id: "exploration", label: "Exploration", keys: ["awareness", "survival"]},
  {id: "practical", label: "Knowledge & Practical", keys: ["knowledge", "medicine", "systems", "craft"]},
  {id: "social", label: "Social", keys: ["influence", "deception", "insight"]}
];
export const DEFAULT_ORDER = SKILL_GROUPS.flatMap(group => group.keys);
export const focusId = (focus, index) => focus.id || `legacy-${index}`;
export const signed = value => value >= 0 ? `+${value}` : String(value);

export const focusLabel = focus => String(focus.name ?? "").trim() || focus.defaultName || "Unnamed focus";
export function nextFocusName(focuses,minimum=0) {
  const numbers=focuses.flatMap(focus=>[focus.name,focus.defaultName].map(value=>/^new focus \((\d+)\)$/i.exec(value??''))).filter(Boolean).map(match=>Number(match[1]));
  return `new focus (${Math.max(minimum,...numbers)+1})`;
}
