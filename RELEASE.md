# Remote File Browser Extension - Release Guide

## Automated Release Process

1. **Compile and test builds**
   ```bash
   npm run compile && npm run package
   ```

2. **Package extension locally**
   ```bash
   vsce package
   ```

3. **Update CHANGELOG.md** (add new version entry at top)

4. **Commit any pending changes**
   ```bash
   git add . && git commit -m "Prepare for release"
   ```
   *Note: Keep commit messages simple and descriptive. Don't mention AI assistance.*

5. **Execute release** (choose one):

   > **Always bump with `npm version` — never edit the version by hand.**
   > It updates `package.json` *and* `package-lock.json` together and creates the
   > git tag. Hand-editing only touches `package.json`, and the lockfile silently
   > falls behind (this drifted for four releases, v3.3.0 through v4.0.0).

   ```bash
   # Patch release (bug fixes)
   npm version patch && git push --tags && vsce publish
   
   # Minor release (new features)  
   npm version minor && git push --tags && vsce publish
   
   # Major release (breaking changes)
   npm version major && git push --tags && vsce publish
   ```

6. **Verify release**
   ```bash
   git log --oneline -3 && git tag --sort=-version:refname | head -3
   ```

## Version Consistency

`package.json` and `package-lock.json` must always report the same version.

A check runs automatically before every production build (the `prepackage`
hook), so `npm run package` fails loudly if they ever disagree:

```bash
npm run check-version   # verify the two match
npm run sync-version    # repair the lockfile if they don't
```

## Troubleshooting

- **"Git working directory not clean"**: Commit changes first
- **"Tag already exists"**: Check if version was already bumped
- **"Authentication failed"**: Login with `vsce login cartpauj`
- **"Version mismatch" during build**: Run `npm run sync-version`, then commit
  the updated `package-lock.json`

## Setup (One-time)

```bash
npm install -g vsce
vsce login cartpauj
```

**Marketplace URL:** https://marketplace.visualstudio.com/items?itemName=cartpauj.remote-file-browser