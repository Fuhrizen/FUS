# FUS — v0.0.1 Beta

Foundry VTT v14 character sheets, Forms, inventory, weapon actions and typed damage.

This GitHub beta series starts at 0.0.1, imported from the supplied workspace build 0.0.19. All releases before 1.0.0 are beta. See [CONTRIBUTING.md](CONTRIBUTING.md) for versioning, automated builds and the testing workflow, and [CHANGELOG.md](CHANGELOG.md) for release changes.

## Installation

Download the installable `FUS-X.Y.Z.zip` from [Releases](https://github.com/Fuhrizen/FUS/releases). Extract the ZIP so `FUS/system.json` sits in your Foundry user-data `systems/FUS` directory. Replace the entire old FUS folder, restart Foundry, then reload connected clients. Back up your world before upgrading.

While the repository is private, sign in to GitHub to download builds and install manually. Foundry cannot authenticate to private manifest/release URLs. The manifest URLs are ready for public hosting if the repository becomes public; GitHub’s automatically generated source archives are not the installable release ZIP.

## Character sheet

Main, Actions, Skills, Inventory, Memory and Notes are separate tabs. Skill and Focus rolls use current saved values. Focus controls allow creation, editing and confirmed removal. Roll labels can be dragged to the hotbar; macros resolve the current actor data when used.

Current HP cannot exceed calculated maximum HP. The sidebar and derived `system.maxhp` display the total; stored base health remains separate for calculations. Without a selected Form, maximum HP is editable. A Form supplies base maximum HP; equipped armour adds health modifiers. When calculated maximum HP increases from a Form or equipped armour, current HP increases by the positive capacity difference. Decreases cap current HP; unchanged capacity does not heal. Main shows calculated Health and Speed with source tooltips, rather than Form description/rules. Without a Form, base speed is editable on Main.

## Forms

Drag a Form from the Forms compendium or Items directory onto the sidebar Form area. Click its name to edit the character's owned copy. Drop another Form to replace it; the previous selected owned copy is removed after the replacement is applied.

The red square bin beside the name removes the owned Form after confirmation. Current and maximum HP are retained, and maximum HP becomes editable. Cancelling preserves the Form. Changes to owned Forms do not alter the source compendium.

## Inventory

Items, weapons and armour have separate sections. Manage quantities in inventory; quantities do not appear on the item cards. Drag entries between owned characters to move all or part of a stack.

- Edit icon: open the item card.
- Red bin: confirmed removal.
- Armour shield: toggle equipped; the active state is green.
- Weapon dice: choose an action and roll that action’s configured damage.
- Weapon crosshairs: choose a weapon action.

## Weapon actions

Weapon cards define Combat type (Ranged or Melee), range `[optimal/max]` in feet, structured actions and description. Melee Reach has one distance field, such as `5`.

**Add action** opens an editor for name, action cost, test/no-roll resolution, optional parent skill override, owner Focus selection, optional matching-Focus requirement, roll modifier, targeting mode, damage button and rule text. Edit, delete or reorder saved actions using their row buttons. Damage components are added, edited and reordered inside each action editor. Armour adjustments retain their own reorder controls. Item damage/protection rows use a single compact line with icon, type, value and controls. Item cards group profile, actions/protection and description into collapsible sections. A weapon without configured actions provides a default Attack.

Examples:

| Action | Resolution | Suggested configuration |
| --- | --- | --- |
| Single fire | Skill test | Weapon default skill; offer damage |
| Suppress | Skill test | Ranged Combat; include special procedure in Rules |
| Reload | No roll | Cost and rule text; no damage |
| Melee strike | Skill test | Melee weapon default; offer damage |

The character **Actions tab** lists available actions grouped by their source weapon, with cost and skill; expand an action to read its rules. Click **Roll** or **Use** to use that specific action directly. Edit the source from its group header to customise the available actions. Weapons with zero quantity are excluded. **Use action** on a weapon card, or the inventory crosshairs, opens the action chooser. No-roll actions post cost and rules directly to chat. Test actions immediately roll using their saved Focus and configured roll modifier; there is no extra use-configuration dialog. Automatic token measurement and action-point spending are not implemented.

The action editor hides test-only fields for no-roll actions, resource fields when adjustment is disabled, and signed amount when Reset is selected.

Costs use small diamonds in source rows and chat cards: ◆ is one Action, ◆◆ is two, and ◆◆◆ is three.

Tests roll `2d10 + parent skill + one Focus + action modifier`. Results show the breakdown and total. Each action owns its damage components. A test, or using a no-roll action, offers **Roll damage** when configured. The button resolves the current action’s damage rather than a shared weapon formula. Resource changes are optional per action; action costs are displayed but not automatically spent.

## Focus lookup and requirements

Weapon categories and Focus matching tags have been removed. Edit an owned weapon action and choose directly from its owner's current Focus list. The Focus dropdown filters to the selected parent skill, updating when that skill changes. Selecting a Focus also selects its parent skill. A linked Focus's current name, rank and parent skill are read whenever the action is used.

Enable **Must have a Focus** to lock the action when its linked Focus is unavailable or untrained. Without that checkbox, a missing Focus falls back to the parent skill. Renaming preserves the ID link; deleting a linked Focus does not silently bind another Focus on the same owner. Edit the action to clear or replace its selection.

Unowned source weapons can specify a Focus name. On import or transfer, the action resolves that exact name under its configured parent skill against the new owner's current Focus list. The owned action editor lets you replace that lookup with a direct selection. Duplicate name matches require choosing one. Legacy tagged requirements are converted to required-Focus actions and need a Focus selected before normal use.

The Actions tab shows unavailable actions as **Locked** with the reason. The toolbar lock hides/shows them. **Shift-click** bypasses Focus requirements and records Forced use in chat. It never bypasses ownership or permits negative counters.

## Charges and Ammo

Melee weapons show **Reach** and **Charges [current/max]**. Ranged weapons show **Range** and **Ammo [current/max]**. Inventory and action-source headers show Charges/Ammo whenever current or maximum is above zero. Item cards retain editable counter fields so zero-capacity weapons can be configured. Reach has one field. Ranged Range retains the optimal/maximum pair.

Each action optionally enables **Adjust Charges/Ammo when used**. Choose a signed adjustment (e.g. `-1` spends one, `+2` adds two) or **Reset to maximum**. Weapons at Ammo/Charges 0/0 have no resource requirement, even if an older action has an adjustment saved. The adjustment controls are hidden until a counter is configured. The counter changes once on use, including tests and no-roll actions. Cancelling does not change it. Additions stop at maximum; insufficient resources lock the action and cannot be forced below zero. If chat creation fails, the resource change is rolled back. Uses through the same loaded weapon document are serialized to avoid double spending.

## Tags and memories

Memory tags use deterministic colours, readable contrasting text, the sheet's fonts and compact chip layout. Type space/comma/Enter to commit; quote multiword tags. Remove chips with ×; Backspace on an empty entry edits the last tag.

Memories support title, content, tags, search, document links, enriched damage links and posting to chat. Manual tag colours are set from character tag settings.

## Damage and armour

Types: Bludgeoning, Cutting, Piercing, Heat, Cold, Electrical, Toxic, Radiation, Sonic, Disruption, Psychic.

Weapon and Form actions can have multiple typed damage components, so individual fire modes can differ. Existing weapon damage migrates into damaging test actions; custom action damage is preserved, and no-roll Reload actions are not given legacy weapon damage. Armour has an Equipped checkbox, signed health/speed modifiers, and multiple typed resistances/weaknesses. Only equipped, non-zero-quantity armour contributes to calculated stats. Modifiers stack; totals floor at zero. Losing health capacity caps current HP and re-equipping grants the positive capacity increase. Values accept fixed numbers or dice, such as `2` or `1d6 + 2`.

Damage messages and enriched damage links show coloured type icons; the action damage editor uses the same colours. Messages show clean formulas and totals. Damage rolled from an action chat card retains that action’s targets. Other damage rolls use current Foundry targets. Target-equipped, non-zero-quantity armour is resolved automatically in the damage card. Click **Apply Damage** to subtract final damage from HP; click the same button again to undo the HP lost. The message author or GM must own the message and have permission to update every affected actor. Matching resistances and weaknesses are summed; each component is `max(0, damage - resistance + weakness)`. Application rereads current armour and rerolls dice adjustments, so dice preview totals may change when applied. Undo adds back only actual HP lost, preserves subsequent HP changes, and caps healing at current maximum HP. Reapplying resolves armour again. Application state persists with the message.

Enriched links: `@Damage[1d6[heat]]{Heat damage}` and `@Damage[1d6[heat]; 2[cutting]]{Mixed damage}`. Internal type IDs are lowercase. Native Rolls retain type tags, and damage flags retain component formulas and totals.

## Shared chat template and APIs

`templates/chat-card.hbs` provides a neutral layout inheriting Foundry's theme: title, subtitle, tags, enriched body, result rows and actions. Action messages preserve Foundry’s native expandable dice results. Skill headers, memory posts, attacks, no-roll actions, damage and resolved damage reuse it.

- `await game.FUS.renderChatCard({title, subtitle, tags, bodyHTML, rows, actions, cost})`
- `await game.FUS.openWeaponActions(actor, weapon, optionalActionId, {force:false})`
- `await game.FUS.executeWeaponAction(actor, weapon, actionId, {focus, force:false})`
- `await game.FUS.rollDamage([{type:"heat", formula:"1d6"}], {actor, label:"Heat"})`
- `await game.FUS.resolveDamage(actor, [{type:"heat", total:5}])`
- `await game.FUS.rollActionDamage(actor, source, actionId)`
- `await game.FUS.openEncounters()`
- `game.FUS.damageTypes`

Card rows use `{label, icon, colour, detail, value}`; actions use `{action, label}`. Text is escaped. Pass only sanitized/enriched content to `bodyHTML`. Custom actions need their own event handlers.

Attack message flags store current actor/weapon UUIDs, action ID, parent skill, Focus ID, configured modifier, total and target name/UUID snapshots. The direct action API requires a choice when more than one Focus matches; `focus:""` explicitly selects parent skill alone.

## Validation

Run `node --test tests/*.test.mjs`. Automated checks cover sheet behaviour, inventory transfers, Forms, tags, chat cards, damage and action resolution. Live Foundry v14 layout and end-to-end interactions still require verification.

## Form actions

Forms support the same action editor as weapons, including skill tests, no-roll abilities, Focus selection and costs. The applied Form contributes its actions to the character Actions tab as a separate source group. Replacing or removing it updates available actions. Form actions can have their own damage components. They do not spend weapon resources.

## FUS Encounters

The right sidebar's FUS Encounters tab replaces the native Foundry encounter interface. **Start combat** draws the first token and automatically opens the compact tracker for connected users, even when they are viewing another sidebar tab. Joining an ongoing encounter also opens it. Each client can disable this with the **Show encounter tracker when combat starts** setting. Closing it manually keeps it dismissed until another encounter starts; the header button reopens it. **End combat** in the gear menu clears turn/pool state, keeps the roster and closes the tracker. Its header opens a condensed pop-up beside the chat/sidebar, near the bottom right. You can move the pop-up. Encounters are not a character sheet tab. Native token combat icons and native Combat creation/update controls are disabled; existing native Combat documents are preserved.

Select canvas tokens and click **Add tokens**; this creates an encounter if needed. **Draw next** chooses one eligible token at random without replacement. When the pool is empty, the next draw starts a fresh round. Tokens are tracked individually, including multiple tokens representing the same actor.

Each row has **Set turn**, **Skip** and **Remove** controls. Set turn makes that token active immediately. Skip excludes it from future draws until toggled back on. Removing a token also removes it from the current pool. The active row is highlighted, and status text distinguishes skipped and already-drawn tokens. No groups, Actions or Reactions are tracked.

The header's gear menu contains New encounter, Restart pool and confirmed Delete. A selector switches between saved encounters. The GM controls state; players see the tracker and can open characters they own. Hidden canvas tokens are omitted from player views. State persists in a world setting and updates connected views. Live Foundry sidebar, pop-up positioning and HUD interactions still require verification.

## Action targeting

Every weapon or Form action has **Target**: No target (the legacy default), Requires target, or Target self. A required action opens a compact notification strip and clears previous targets. Left-click a token to target it and immediately use the action. Hold Shift while clicking to add several targets; release Shift to use the group, or choose **Use targets**. The temporary targets clear after selection or cancellation; the action's chat message retains their names and UUIDs. Cancelling posts nothing and spends no ammo/charges. Multiple targeted tokens are named; the action still makes a single roll, so its rules determine whether multiple targets are appropriate. Self uses the actor even without a placed token and ignores other selected targets. Target names and UUIDs are saved with the chat message. Neither targeting nor Shift-click performs a DC/hit check or applies damage on the attack roll. Damage application is a separate chat-card toggle.

## Setting compendiums

Three prebuilt Item compendiums are included, each with Weapons, Armour and Items folders. **Sci-Fi** also includes a Forms folder. They are content packs with no setting-dependent system logic. Drag entries into characters and customise the owned copies. Existing world items are not overwritten by a system update.

| Setting | Weapons | Armour | Items | Forms |
| --- | ---: | ---: | ---: | ---: |
| Medieval | 22 | 9 | 16 | 0 |
| Modern | 21 | 10 | 18 | 0 |
| Sci-Fi | 20 | 12 | 18 | 4 |

The **150 entries** use a 6-HP campaign baseline: ordinary damage is 1–2, heavy damage is usually 3, and most armour resists 1 with specialised protection at 2. Cyborg and Kharan Forms have 7 HP as a durability variation; Synthetic and Veyari have 6. Form movement varies from 10 to 20 ft. These starter values adapt the Core Rulebook equipment examples (pages 11–14) to the requested HP campaign. Named firearm ranges/capacities are game profiles, not real-world specifications. Specialist aimed/burst actions are editable starter variants; no automatic DC handling is introduced.

Use one body-armour profile at a time; the sheet stacks equipped armour, so layers are managed manually. Weapon handling, spare magazines/cells, healing, item supplies and conditions are described in the profiles and resolved manually. **SETTING-CATALOGUE.md** lists every entry and its general stats. Sources are in `pack-sources/`; `tools/generate-setting-packs.py` rebuilds their JSON and `tools/build-packs.mjs` compiles the LevelDB packs using the official Foundry CLI. The installed system uses the supplied compiled packs and needs no build tools.

## Targeting preview and item defaults

While choosing targets, a screen overlay draws a line from the acting token to the pointer. It displays direct distance and the scene-grid measurement in feet, converting metre scenes to feet. Green marks melee Reach or optimal range; amber marks ranged maximum; the line turns red outside range. It is a planar guide and does not check walls, cover, elevation or hit outcomes. Form actions without a weapon range show no range boundary. When the actor has no token on the scene, targeting remains available without a preview. A tiny distance readout follows the pointer. Left-click uses one target; Shift-click adds targets and releasing Shift confirms the group. Confirm/Enter also uses current token targets; Cancel/Escape or changing scenes removes the notice and overlay without spending resources.

Misc item descriptions start expanded. The action editor calls roll resolution **Roll** and action rows omit the Test label. The Baseline compendium Form includes **Unarmed Strike** (1 Action, Melee Combat, optional Unarmed Focus, Bludgeoning 1, target required). Update or replace an existing owned Baseline copy to receive its new action; source updates do not overwrite owned copies.

## Player and NPC actors

The creation selector offers **Player** and **NPC**. Existing `character` actors are labelled Player so existing sheets, items and macros keep working. Both types share exactly the same data, sheet and rule calculations. New Player prototype tokens have Actor linking enabled; new NPC prototype tokens have it disabled so placed NPCs can maintain independent health, equipment and other data. Existing tokens and prototype overrides are not retroactively relinked. New actors default to 6 current/maximum HP unless explicit health values are supplied.

New scenes default to **5 ft per grid unit**; explicit scene scales and existing scenes are preserved. At 0 HP, an HP update applies Foundry's Dead status/overlay and removes that actor's tokens from the current encounter pool and active turn. Dead participants remain visible in the roster, cannot be drawn or manually assigned a turn, and recover eligibility when HP is restored. Manual Skip remains independent. A restored participant already drawn this round becomes eligible next round. The active GM synchronizes encounter state; draw operations also check current token HP.
