# Publishing a new version

Steps to ship a fix/feature in `@tarviks/lexical-rich-editor` from a local change to a live npm release.

## 1. Sync with `main`

```bash
git status              # make sure there's nothing uncommitted you'd lose
git checkout main
git pull origin main
```

## 2. Bump the version and changelog

- Edit `package.json` → bump `"version"` (semver: patch for fixes, minor for backwards-compatible features).
- Add a new entry at the top of `CHANGELOG.md` under `## [x.y.z] — YYYY-MM-DD`, with `### Added` / `### Changed` / `### Fixed` sections as needed. Follow the existing entries' tone — describe the bug/behavior, not just the code change.

## 3. Build and verify

```bash
npx tsc --noEmit -p .   # type-check
npx tsup                # build dist/
```

> **Known quirk:** `yarn build` / `npm run build` invoke `prepublishOnly` → `yarn build`, which fails with
> `This project's package.json defines "packageManager": "yarn@4.12.0"` if Corepack isn't enabled on the
> machine (`corepack enable` requires admin rights and may itself fail with `EPERM` on some Windows setups).
> Building with `npx tsup` directly sidesteps this — it's the same build tsup would run either way.

Spot-check the built `dist/index.css` / `dist/index.js` contain your change (e.g. `grep` for a class name or
symbol you added) before publishing.

## 4. Commit and push to a branch (not `main` directly)

`main` is protected — direct pushes are rejected (`GH013: Changes must be made through a pull request`) and a
"Build & Type-check" status check is required.

```bash
git add <files>
git commit -m "fix: <what/why>"
git checkout -b fix/<short-name>
git push -u origin fix/<short-name>
```

## 5. Open and merge the PR

```bash
gh pr create --title "..." --body "..."
```

(`gh` isn't installed everywhere — if it's missing, use the URL git prints after the push, e.g.
`https://github.com/<org>/lexical-rich-editor/pull/new/fix/<short-name>`.)

Get it reviewed/merged into `main` through GitHub.

## 6. Pull the merged commit and rebuild

```bash
git checkout main
git pull origin main     # should fast-forward cleanly
npx tsup                  # dist/ is gitignored — rebuild from the merged source
```

## 7. Publish to npm

```bash
npm whoami                        # confirm you're authenticated as the right npm user
npm publish --ignore-scripts      # --ignore-scripts skips the broken prepublishOnly (see step 3);
                                   # dist/ is already freshly built from step 6
```

## 8. Verify it's live

```bash
npm view @tarviks/lexical-rich-editor@<version> version
```

(`npm view @tarviks/lexical-rich-editor version` with no version pin can lag behind by a moment/cache — pin
the version you just published to check it directly.)

## 9. Update the consuming app

In the host app (e.g. `@actingoffice/app`), bump the dependency:

```bash
yarn add @tarviks/lexical-rich-editor@<version>
```
