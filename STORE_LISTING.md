# Chrome Web Store Listing

## Extension Name

Claude Custom Think

## Short Description (132 chars max)

Replace Claude's "Thinking" indicator with fun themed words. Cats, coffee, space, and more!

## Detailed Description

Claude Custom Think replaces the standard "Thinking" indicator on claude.ai with rotating themed words from fun categories.

Instead of watching "Thinking..." while Claude processes your request, you will see words like "Purring", "Orbiting", or "Brewing" cycle through with a smooth fade animation.

Features:
- Multiple word categories (Cats, Coffee Shop, Space, and more)
- Smooth fade transitions between words
- Enable/disable with one click
- Preferences sync across devices via Chrome sync
- Zero external network requests — all data bundled locally
- Lightweight, minimal permissions

How it works:
1. Click the extension icon to open the popup
2. Select a word category
3. Visit claude.ai and start a conversation
4. When Claude thinks, the indicator shows your themed words

## Category

Productivity

## Screenshots Needed

1. **Popup open** — Show the popup with category list, one selected
2. **Thinking replacement** — claude.ai mid-conversation with a custom word visible in place of "Thinking"
3. **Category selection** — Popup showing the moment of clicking a different category
4. **Before/after** — Side-by-side of default "Thinking" vs. a custom word

## Privacy Policy

This extension:
- Only runs on claude.ai
- Does not collect, transmit, or store any user data
- Does not make any external network requests
- Uses chrome.storage.sync solely for user preferences (selected category, enabled state)
- Contains no analytics, tracking, or telemetry

A hosted privacy policy page is required by Chrome Web Store if the extension requests any permissions. A minimal page stating the above is sufficient.

## Publishing Steps

1. **Create a developer account** at https://chrome.google.com/webstore/devconsole
   - One-time $5 registration fee
2. **Prepare assets**
   - Replace placeholder icons with final designs (see `icons/ICON_NEEDED.md`)
   - Take screenshots at 1280x800 or 640x400
   - Create a 440x280 promotional tile (optional but recommended)
3. **Package the extension**
   ```bash
   cd chrome-extension
   zip -r claude-custom-think.zip . -x ".*" "STORE_LISTING.md" "icons/ICON_NEEDED.md"
   ```
4. **Upload to Developer Dashboard**
   - Go to https://chrome.google.com/webstore/devconsole
   - Click "New Item" and upload the zip
   - Fill in listing details from this document
   - Upload screenshots and icons
5. **Submit for review**
   - Review typically takes 1-3 business days
   - Extensions with minimal permissions (like this one) are usually approved quickly
6. **Post-publish**
   - Monitor reviews and crash reports in the dashboard
   - Update by incrementing version in manifest.json and re-uploading
