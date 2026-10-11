# Testing FUS

Use Node 22 or 24 and Python 3. Install the locked dependencies and browsers:

```sh
npm ci
npx playwright install --with-deps chromium firefox webkit
npm run test:ci
```

For a quick rules check, run `npm test`. Individual gates are `test:unit`, `check`, `test:contracts`, `build`, `validate:package`, and `test:browser`.

## Automated gates

| Gate | What it verifies |
| --- | --- |
| Unit tests, Node 22 and 24 | Rules, targeting, hit probability, cover geometry, resources, forms, damage, conditions, encounters, migrations and version increments |
| Coverage | Every production module is included, even when untouched: at least 80% lines/statements, 75% branches and 70% functions |
| Project contracts | Version and manifest consistency, local imports/assets, template compilation, document IDs, folders, action references and icons |
| Compendium round-trip | Checked-in LevelDB packs equal their JSON sources; a clean compile/extract preserves every document |
| Release integrity | ZIP paths, CRC, manifest, complete runtime payload, byte-for-byte source equality and SHA-256 checksum |
| Browser regressions | Chromium, Firefox and WebKit at three viewport sizes: sheet navigation, pin controls, initiative portrait groups, combat lifecycle, drag cover previews, targeting odds, closed cover masks, free area placement, selected-token combat controls and damage undo |

Browser tests load production FUS modules, Handlebars templates and styles. The public harness supplies explicit Foundry host fixtures; it does not ship or run the licensed Foundry runtime. These tests detect application and layout regressions but cannot certify Foundry's renderer, permissions or document persistence.

CI runs only within the beta release workflow, after a completed collection of changes requests publication. Ordinary pushes, pull requests and schedules do not run CI. Independent jobs run in parallel. Failed browser tests retain traces, screenshots and videos; successful tests also attach screenshots. HTML coverage/browser reports, JUnit results and validated packages remain available as Actions artifacts for seven days. Open traces with `npx playwright show-trace <trace.zip>` and reports with `npx playwright show-report reports/browser`.

The reusable quality workflow ends with **CI gate**, which fails if any job fails, is cancelled or is skipped. Publication requires this gate to pass.

Beta publication calls the same quality workflow before incrementing the version. It verifies that the tested revision is still main, validates the resulting release ZIP, and publishes a checksum alongside the package. Every completed collection is automatically released as minor (patch) or feature when appropriate. Major releases require user approval and a manual dispatch; automatic major requests are rejected.

## Foundry v14 smoke checks

Before a beta is promoted, test in a licensed Foundry world as GM and player:

- Select among two owned actors; confirm targeting, range/reach, LOS, all wall cover levels and Shift bypass.
- Move and drag tokens through cover; verify previews, hit chance breakdown and cleanup.
- Apply/remove pins rapidly, check marker alignment and prototype suppression toggle.
- Apply damage to zero HP, verify the dead status, then undo and check restoration.
- Toggle ammo tracking, fire example weapons and reload with compatible/incompatible supplies.
- Open every sheet tab, link a compendium action to a form and drag an action to the macro bar.
- Add selected tokens to combat, start/draw/end, verify Ready → Acting → Finished rows and that no popup opens.

Keep new rule regressions in `tests/*.test.mjs`, cross-file integrity checks in `tests/contracts/`, and user interactions in `tests/browser/`. Change coverage thresholds only with an explained review; do not exclude difficult production modules to make CI pass.

Tactical examples include editable Grenade and Molotov shared area actions. Their sample damage values are presets, not additional mandatory rules. Defensive Reaction is supplied by Baseline and ends when its encounter advances to the next round or ends.

Cover bonuses now use one nearest Soft/Hard Cover wall within 5 ft of the target point; remote crossed cover does not stack. Total Cover and native sight blockers still block the attack path. Geometry is cached in map coordinates and reprojected during pan/zoom. Melee uses edge-to-edge reach, ignores physical wall cover bonuses and retains defensive dodge. Base Attack DC remains 14.

The configurable Range falloff rule defaults on: beyond optimal, add `ceil(6 × (distance − optimal)/(maximum − optimal))` DC, capped at +6. Turning it off restores the rulebook's fixed +2 beyond optimal. Beyond maximum remains a 0% attempt.

Items can consume one parent quantity when used and optionally remove themselves at zero. Ammunition supplies and action-consumed parents are removed when exhausted after successful chat creation and automation; failed chat creation restores resources. Consumed-parent damage cards keep a damage snapshot. Existing weapon stacks with ammo or charges migrate into independent copies; further quantity increases create separate weapons.
