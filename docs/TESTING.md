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
| Browser regressions | Chromium, Firefox and WebKit at three viewport sizes: sheet navigation, pin controls, tracker docking, combat lifecycle, drag cover previews, targeting odds and damage undo |

Browser tests load production FUS modules, Handlebars templates and styles. The public harness supplies explicit Foundry host fixtures; it does not ship or run the licensed Foundry runtime. These tests detect application and layout regressions but cannot certify Foundry's renderer, permissions or document persistence.

CI runs on main pushes, pull requests, manual dispatch and weekly. Independent jobs run in parallel. Failed browser tests retain traces, screenshots and videos; successful tests also attach screenshots. HTML coverage/browser reports, JUnit results and validated packages remain available as Actions artifacts for seven days. Open traces with `npx playwright show-trace <trace.zip>` and reports with `npx playwright show-report reports/browser`.

The reusable quality workflow ends with **CI gate**, which fails if any job fails, is cancelled or is skipped. Make this check required in repository branch protection to enforce it on merges. That administrative setting is separate from these committed workflows.

Beta publication calls the same quality workflow before incrementing the version. It verifies that the tested revision is still main, validates the resulting release ZIP, and publishes a checksum alongside the package. Normal CI pushes do not request a release.

## Foundry v14 smoke checks

Before a beta is promoted, test in a licensed Foundry world as GM and player:

- Select among two owned actors; confirm targeting, range/reach, LOS, all wall cover levels and Shift bypass.
- Move and drag tokens through cover; verify previews, hit chance breakdown and cleanup.
- Apply/remove pins rapidly, check marker alignment and prototype suppression toggle.
- Apply damage to zero HP, verify the dead status, then undo and check restoration.
- Toggle ammo tracking, fire example weapons and reload with compatible/incompatible supplies.
- Open every sheet tab, link a compendium action to a form and drag an action to the macro bar.
- Add selected tokens to combat, start/draw/end, collapse the sidebar and resize while the tracker is open.

Keep new rule regressions in `tests/*.test.mjs`, cross-file integrity checks in `tests/contracts/`, and user interactions in `tests/browser/`. Change coverage thresholds only with an explained review; do not exclude difficult production modules to make CI pass.
