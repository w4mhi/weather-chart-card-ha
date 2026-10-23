# Release Checklist

1. Branch from `master`, make the change, and add an entry to `CHANGELOG.md`.
2. Bump `version` in `package.json` (the card shows it in its bottom-right corner).
3. `npm run build` (regenerates the icon module, lints, and bundles into `dist/`).
4. `npm test` and `npm run test:rtl`.
5. Commit the rebuilt `dist/` with the source: CI fails when they differ.
6. Merge the PR, then tag the merge commit and push the tag:
   ```bash
   git tag v1.10.0 && git push origin v1.10.0
   ```
   The Release workflow builds again and attaches `weather-chart-card-ha.js`
   and a zip with the icon folders to the GitHub release. HACS picks it up
   from there.
