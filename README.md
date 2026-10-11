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

Open Actions → Publish beta release → Run workflow on `main`. Choose `major` (X+1.0.0), `feature` (X.Y+1.0), or `minor` (X.Y.Z+1). The workflow tests and packages the release, saves matching versions and download URLs to main, publishes a versioned prerelease, and updates the beta channel manifest. Normal source pushes do not publish. An explicit change to `tools/beta-release-request.json` is also a release request.

### Walls, pins and reloads

Wall configuration includes Cover beside sight: No cover (default), Soft Cover, Hard Cover, or Total Cover. Region cover flags from the earlier beta are ignored. An attack crossing Total Cover is blocked even when sight passes through it; Total Cover is omitted from cover previews. Soft and Hard Cover previews show the protected area beyond visible walls, clipped to line of sight from the pointer while targeting or the token while moving.

Shift-click Use/Roll on a source with range or reach to skip targeting. Melee targeting displays its reach circle. The encounter HUD is fixed near the top right, beside the sidebar.

Right-click a token and use its Pins +/− controls. Pins show a token-sized animated suppression overlay. Disable suppression animation in the token or prototype-token configuration to keep counters without animation.

In a shared Action definition, expand Required item / reload. Enter an inventory name, ID, or source compendium UUID, the required quantity, and whether to consume it. Combine this with Source resource → Reset to maximum for a reload. Missing items prevent the action; consumed quantities and ammo are restored if chat creation fails.

### Optional ammo and hit chance

In Configure Settings → FUS, Optional rule: ammunition tracking is enabled by default to preserve existing counters. Turn it off for unlimited ranged ammunition: attacks ignore ammo shortages and reloads do not consume compatible ammo or change counters. Charges and unrelated required-item abilities remain active.

Universal Equipment & Ammunition contains tools and supplies for any setting, plus compatible projectiles and charges for every ranged starter weapon. Ammunition quantities count rounds or charges. Weapon profiles specify their compatible ammo type. Reload refills from matching stacks and consumes only missing rounds; incompatible types are not consumed. Existing starter magazines are converted to round quantities when their ammo type is first assigned. Rations now represent one day per inventory unit.

Targeting previews show the exact chance for 2d10 + Skill + chosen Focus + modifiers to meet the rulebook Attack DC 14. Soft Cover adds 2 DC, Hard Cover adds 4, and extended range adds 2. Total Cover, blocked LOS, and out-of-range targets cannot be attacked normally. Hindered/suppressed attackers take −2 once; Exposed targets reduce DC by 2. Pins subtract 1 per pin by default, configurable using Attack penalty per pin (0 disables that penalty). These previews do not automatically assume Assault, repeated attacks, reactions or unrecorded visibility circumstances; use Action modifiers/conditions for additional adjustments. Chat displays the percentage, DC factors and actual HIT/MISS. Damage is offered only for targets hit by that roll.

Moving previews follow drag clones and token animation updates; visible cover faces are highlighted even when the cover wall also blocks sight. The sidebar has a popout button, and right-clicking its combat tab opens the same docked tracker. Its position follows both sidebar panels and the tab rail. Pin controls stop pointerdown as well as click events; counts sit centered above tokens.
