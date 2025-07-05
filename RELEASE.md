# Remote File Browser Extension v4.4.0 - Release Notes

## 🎯 Major Connection Management Enhancement

### New Features in v4.4.0

**Enhanced Connection Manager Interface**
- 📋 **Compact View Mode**: Revolutionary space-efficient connection display
  - Single-line connection cards showing essential info (protocol, user, host, port)
  - Perfect for users managing dozens or hundreds of connections
  - One-click connection directly from compact view
- 📄 **Detailed Card View**: Traditional full-detail connection display
- 🔄 **Seamless View Switching**: Toggle between compact and card views instantly

**Advanced Search & Filtering**
- 🔍 **Real-time Search**: Instant filtering as you type
- 🎯 **Multi-field Search**: Search by connection name, hostname, username, or protocol
- 📊 **Smart Result Counter**: Shows "X of Y connections" when filtering
- ⚡ **Live Updates**: Results update instantly without page refresh

**Responsive Design**
- 📱 **Mobile-Optimized**: Touch-friendly interface for all devices
- 🖥️ **Adaptive Grid**: Automatic layout adjustment for different screen sizes
- ✨ **Modern UI**: Smooth hover effects and visual feedback
- 🎨 **VS Code Integration**: Seamless theme compatibility

### Benefits
- **Efficiency**: Find any connection among hundreds in seconds
- **Space-Saving**: Compact view displays 3x more connections per screen
- **User Experience**: Intuitive search with visual feedback
- **Scalability**: Perfect for power users with extensive server lists

---

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
```

**Marketplace URL:** https://marketplace.visualstudio.com/items?itemName=cartpauj.remote-file-browser