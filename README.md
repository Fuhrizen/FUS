# FUS for Foundry VTT

FUS is a flexible tabletop system for Foundry VTT, built around configurable actions, character Forms, and equipment. It provides a shared sheet for Players and NPCs, inventory tools, chat rolls, and encounter tracking.

The system is in beta. Features and interfaces are still being developed; every version before 1.0.0 is considered beta.

## Installation

1. Use Foundry VTT version 14.
2. Download the installable FUS ZIP from the repository’s [Releases](https://github.com/Fuhrizen/FUS/releases) page. Use the uploaded system ZIP rather than GitHub’s source archive.
3. Extract it so `FUS/system.json` sits in your Foundry user-data `systems/FUS` directory.
4. Restart Foundry and select FUS when creating a world.

To update, back up your world, replace the FUS system folder with the new release, then restart Foundry and reload connected clients. For automatic beta updates, install using https://github.com/Fuhrizen/FUS/releases/download/beta/system.json.

### Publishing a beta

Open Actions → Publish beta release → Run workflow on `main`. Choose `major` (X+1.0.0), `feature` (X.Y+1.0), or `minor` (X.Y.Z+1). The workflow tests and packages the release, saves matching versions and download URLs to main, publishes a versioned prerelease, and updates the beta channel manifest. Each completed collection automatically requests a minor (patch), or feature when appropriate, beta by updating `tools/beta-release-request.json`. CI runs only during release. Major releases require user approval and manual dispatch; automatic major requests are rejected.

### Walls, pins and reloads

Wall configuration includes Cover beside sight: No cover (default), Soft Cover, Hard Cover, or Total Cover. Region cover flags from the earlier beta are ignored. An attack crossing Total Cover is blocked even when sight passes through it; Total Cover is omitted from cover previews. Soft and Hard Cover previews show the protected area beyond visible walls, clipped to line of sight from the pointer while targeting or the token while moving. Attack bonuses use only the nearest cover wall within 5 ft of the target point; crossed distant walls do not stack. Cached map geometry is reprojected during zoom and pan. Targeting lines change colour without labels.

Shift-click Use/Roll on a source with range or reach to skip targeting. Melee targeting displays its reach circle. The encounter HUD is fixed near the top right, beside the sidebar.

Right-click a token and use its Pins +/− controls. Pins show a token-sized animated suppression overlay. Disable suppression animation in the token or prototype-token configuration to keep counters without animation.

In a shared Action definition, expand Required item / reload. Enter an inventory name, ID, or source compendium UUID, the required quantity, and whether to consume it. Combine this with Source resource → Reset to maximum for a reload. Missing items prevent the action; consumed quantities and ammo are restored if chat creation fails.

### Optional ammo and hit chance

In Configure Settings → FUS, Optional rule: ammunition tracking is enabled by default to preserve existing counters. Turn it off for unlimited ranged ammunition: attacks ignore ammo shortages and reloads do not consume compatible ammo or change counters. Charges and unrelated required-item abilities remain active.

Universal Equipment & Ammunition contains tools and supplies for any setting, plus compatible projectiles and charges for every ranged starter weapon. Ammunition quantities count rounds or charges. Weapon profiles specify their compatible ammo type. Reload refills from matching stacks and consumes only missing rounds; incompatible types are not consumed. Existing starter magazines are converted to round quantities when their ammo type is first assigned. Rations now represent one day per inventory unit.

Targeting previews show the exact chance for 2d10 + Skill + chosen Focus + modifiers to meet the rulebook Attack DC 14. Soft Cover adds 2 DC and Hard Cover adds 4 for ranged attacks. Melee ignores physical cover bonuses and uses edge-to-edge reach; defensive dodge still adds 2 DC. Range falloff defaults on, increasing ranged DC from +0 at optimal to +6 at maximum. Disable Range falloff to restore the rulebook’s fixed +2 extended-range penalty. Total Cover, blocked LOS, and out-of-range targets cannot be attacked normally. Hindered/suppressed attackers take −2 once; Exposed targets reduce DC by 2. Pins subtract 1 per pin by default, configurable using Attack penalty per pin (0 disables that penalty). These previews do not automatically assume Assault, repeated attacks, reactions or unrecorded visibility circumstances; use Action modifiers/conditions for additional adjustments. Chat displays the percentage, DC factors and actual HIT/MISS. Damage is offered only for targets hit by that roll.

Moving previews follow drag clones and token animation updates; visible cover faces are highlighted even when the cover wall also blocks sight. The sidebar has a popout button, and right-clicking its combat tab opens the same docked tracker. Its position follows both sidebar panels and the tab rail. Pin controls stop pointerdown as well as click events; counts sit centered above tokens.

## Development checks

See [Testing FUS](docs/TESTING.md) for the unit, coverage, compendium, package and browser gates, local commands, and Foundry smoke checks.

Items can consume one parent unit when an action is used and optionally remove themselves at zero quantity. Exhausted ammo and consumed parents are removed after successful use; damage cards retain a snapshot for consumed sources. Ammo/charge-bearing weapons cannot stack: legacy stacks split into separate copies, and the inventory + button adds another independent weapon.

### Character readiness and setup

The selected Form defines usable hands (default 2; zero and extra hands are supported). Inventory carry controls support stowed, worn, one-hand and two-hand states. Weapon actions enforce grip, free/occupied hands and any required equipped item. When a Form loses hands, excess held items are stowed. Copies and split stacks begin stowed.

Character setup is a tabbed wizard: Setup → Skills → Focuses → Review. Back and forward navigation retain the draft. Live counters show the 4 skill points (maximum starting rank 3) and 7 Focus points (maximum starting rank 2). Overspending blocks progress. No changes are saved before applying the final review. Reset asks for confirmation and preserves items, notes and memories.

Shared Action compendiums are organized by category, calibre and weapon training, such as Weapons / 5.56 / Rifles. Brace replaces Defensive Reaction. Suppress is a trained ranged action requiring a Focus; forcing use cannot bypass that training. Action lists and chat cards show the number of ammo or charges spent. The generated martial actions and their links are removed; user-created actions are preserved.

Pins belong to the character and apply across copies of its token, including unlinked copies. The off-token suppression effect is blurred, grey and transparent, and may still be disabled per token prototype. Existing token-local pin counts migrate using the highest count, avoiding duplicate accumulation.

There is one current encounter. Additional legacy encounters remain in stopped archived data. Cover previews use native sight polygons, cached geometry and spatial cover candidates. CI checks use host fixtures; a live Foundry v14 world still needs verification.
