#!/bin/bash

echo "🚀 Installing Remote File Browser Extension with Debug Features"
echo "================================================================"

# Build the extension
echo "📦 Building extension..."
npm run compile

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful!"

# Install the extension in VSCode
echo "🔌 Installing extension in VSCode..."
code --install-extension . --force

if [ $? -ne 0 ]; then
    echo "❌ Installation failed!"
    exit 1
fi

echo "✅ Extension installed successfully!"

echo ""
echo "📋 Next Steps:"
echo "1. Open VSCode (if not already open)"
echo "2. Press Ctrl+Shift+I to open Developer Console"
echo "3. Go to Console tab and clear any logs"
echo "4. Open Remote File Browser panel in sidebar"
echo "5. Click on the 'DOS' connection to test"
echo "6. Watch the console for detailed debug output"
echo ""
echo "🔍 Look for:"
echo "- ✅ ALL CREDENTIALS MATCH WORKING TEST (good!)"
echo "- ⚠️ CREDENTIAL DIFFERENCES DETECTED (need to fix)"
echo "- 🎉 SFTP CONNECTION SUCCESSFUL (working!)"
echo "- ❌ errors (troubleshoot needed)"
echo ""
echo "📖 See TEST_INSTRUCTIONS.md for detailed guidance"