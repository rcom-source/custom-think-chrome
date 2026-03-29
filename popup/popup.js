/**
 * Claude Custom Think — Popup Script
 *
 * Renders the category list, handles selection, and communicates
 * changes to the content script via chrome.runtime messaging.
 */

(function () {
  "use strict";

  const categoryListEl = document.getElementById("categoryList");
  const currentNameEl = document.getElementById("currentCategoryName");
  const enabledToggle = document.getElementById("enabledToggle");
  const persistToggle = document.getElementById("persistToggle");
  const displayModeToggle = document.getElementById("displayModeToggle");

  let categories = {};
  let selectedCategory = null;
  let persistAcrossSessions = true;

  // ---------------------------------------------------------------------------
  // Load data
  // ---------------------------------------------------------------------------

  async function init() {
    // Load bundled categories
    const url = chrome.runtime.getURL("data/categories.json");
    const resp = await fetch(url);
    categories = await resp.json();

    // Load saved preferences
    const prefs = await new Promise((resolve) =>
      chrome.storage.sync.get(["selectedCategory", "enabled", "persist", "displayMode"], resolve)
    );

    // Check session storage for non-persistent preferences
    const sessionPrefs = await new Promise((resolve) =>
      chrome.storage.session.get(["selectedCategory", "enabled"], resolve)
    );

    persistAcrossSessions = prefs.persist !== false;
    persistToggle.checked = persistAcrossSessions;
    displayModeToggle.checked = prefs.displayMode === "floating";

    // Use session prefs if not persisting, otherwise use sync prefs
    const effectivePrefs = persistAcrossSessions ? prefs : { ...prefs, ...sessionPrefs };
    selectedCategory = effectivePrefs.selectedCategory || Object.keys(categories)[0];
    enabledToggle.checked = effectivePrefs.enabled !== false;

    render();
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  function createCategoryCard(key, cat) {
    const card = document.createElement("div");
    card.className = "category-card" + (key === selectedCategory ? " selected" : "");
    card.dataset.key = key;

    const iconSpan = document.createElement("span");
    iconSpan.className = "category-icon";
    iconSpan.textContent = cat.icon || "?";

    const infoDiv = document.createElement("div");
    infoDiv.className = "category-info";

    const nameDiv = document.createElement("div");
    nameDiv.className = "category-name";
    nameDiv.textContent = cat.name;

    const previewDiv = document.createElement("div");
    previewDiv.className = "category-preview";
    previewDiv.textContent = cat.words.slice(0, 3).join(", ");

    infoDiv.appendChild(nameDiv);
    infoDiv.appendChild(previewDiv);
    card.appendChild(iconSpan);
    card.appendChild(infoDiv);

    card.addEventListener("click", () => selectCategory(key));
    return card;
  }

  function render() {
    categoryListEl.replaceChildren();

    for (const [key, cat] of Object.entries(categories)) {
      categoryListEl.appendChild(createCategoryCard(key, cat));
    }

    // Update header
    if (categories[selectedCategory]) {
      currentNameEl.textContent = categories[selectedCategory].name;
    } else {
      currentNameEl.textContent = "None";
    }
  }

  // ---------------------------------------------------------------------------
  // Selection
  // ---------------------------------------------------------------------------

  /** Return the appropriate storage area based on persist preference. */
  function getStorage() {
    return persistAcrossSessions ? chrome.storage.sync : chrome.storage.session;
  }

  function selectCategory(key) {
    selectedCategory = key;
    getStorage().set({ selectedCategory: key });

    // Notify content script(s) — only if on claude.ai
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id && tabs[0].url?.match(/claude\.(ai|com)/)) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: "categoryChanged",
          category: key,
        }).catch(() => {}); // Content script may not be ready
      }
    });

    render();
  }

  // ---------------------------------------------------------------------------
  // Enabled toggle
  // ---------------------------------------------------------------------------

  enabledToggle.addEventListener("change", () => {
    const val = enabledToggle.checked;
    getStorage().set({ enabled: val });

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id && tabs[0].url?.match(/claude\.(ai|com)/)) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: "enabledChanged",
          enabled: val,
        }).catch(() => {});
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Persist toggle — session vs permanent storage
  // ---------------------------------------------------------------------------

  persistToggle.addEventListener("change", () => {
    persistAcrossSessions = persistToggle.checked;
    // The persist preference itself is always stored in sync so it survives restarts
    chrome.storage.sync.set({ persist: persistAcrossSessions });

    // Migrate current preferences to the chosen storage area
    const data = { selectedCategory, enabled: enabledToggle.checked };
    getStorage().set(data);
  });

  // ---------------------------------------------------------------------------
  // Display mode toggle — inline vs floating pill
  // ---------------------------------------------------------------------------

  displayModeToggle.addEventListener("change", () => {
    const mode = displayModeToggle.checked ? "floating" : "inline";
    chrome.storage.sync.set({ displayMode: mode });

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id && tabs[0].url?.match(/claude\.(ai|com)/)) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: "displayModeChanged",
          displayMode: mode,
        }).catch(() => {});
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------

  init();
})();
