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
