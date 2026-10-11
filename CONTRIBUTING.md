# Testing and updating FUS

Use a backed-up test world for beta builds. Branch from `main`, make the change, and open a pull request. GitHub Actions rebuilds compendiums, runs project checks and automated tests, and provides a ZIP in the workflow's `FUS-test-build` artifact. Install that ZIP in Foundry v14 and record the manual result in the pull request before merging.

## Local checks

Use Node.js 22+ and Python 3:

```
npm ci
npm run build:packs
npm run check
npm test
npm run build
```

The installable build is `dist/FUS-X.Y.Z.zip`; `dist/system.json` is its release manifest. The ZIP keeps the `FUS/` directory and excludes build tools, test files and editable compendium sources.

## Versions

All releases below 1.0.0 are beta and published as GitHub prereleases. Store the complete `X.Y.Z` number in both `system.json` and `package.json`; tag releases `vX.Y.Z`.

| Increment | Meaning | Example |
| --- | --- | --- |
| X | Major system update | 1.0.0 → 2.0.0 |
| Y | Major feature change, feature tweak or refactor | 0.0.1 → 0.1.0 |
| Z | Minor change or fix | 0.0.1 → 0.0.2 |

Reset lower components when incrementing a higher component. Before release, update both version fields, the versioned download URL in `system.json`, and `CHANGELOG.md`. Main-branch version changes publish a tested release automatically; unchanged version numbers do not replace an existing release. The release workflow can also be run manually on `main`.

Use ordinary feature branches and PRs for future changes. The initial import commits organize one supplied snapshot; they do not claim to reproduce its original development timeline.
