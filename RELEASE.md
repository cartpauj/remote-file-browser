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

## Troubleshooting

- **"Git working directory not clean"**: Commit changes first
- **"Tag already exists"**: Check if version was already bumped
- **"Authentication failed"**: Login with `vsce login cartpauj`

## Setup (One-time)

```bash
npm install -g vsce
vsce login cartpauj
```

**Marketplace URL:** https://marketplace.visualstudio.com/items?itemName=cartpauj.remote-file-browser