/**
 * Claude Custom Think — Background Service Worker
 *
 * Handles:
 * - First-install setup (default preferences)
 * - Storage and messaging bridge
 */

// ---------------------------------------------------------------------------
// Install handler
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    // Set default preferences on first install
    chrome.storage.sync.set({
      selectedCategory: "cats",
      enabled: true,
    });

    console.log("[Claude Custom Think] Installed — defaults set.");
  }

  if (details.reason === "update") {
    console.log(
      "[Claude Custom Think] Updated to",
      chrome.runtime.getManifest().version
    );
  }
});

// ---------------------------------------------------------------------------
// Message relay (popup <-> content script if needed)
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Currently the popup talks directly to content scripts via chrome.tabs.
  // This handler is a future hook for cross-tab broadcasting or background
  // processing if needed.

  if (msg.type === "getPreferences") {
    chrome.storage.sync.get(["selectedCategory", "enabled"], (result) => {
      sendResponse(result);
    });
    return true; // async
  }
});
