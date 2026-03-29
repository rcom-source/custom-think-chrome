/**
 * Claude Custom Think — Content Script
 *
 * Injected into claude.ai and claude.com pages. Detects when Claude is
 * "thinking" by watching for the stop button, then displays themed words
 * as a floating pill above the input area.
 */

(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  let currentCategory = null; // { name, icon, words }
  let categories = {};
  let cycleInterval = null;
  let isThinking = false;
  let enabled = true;
  let displayMode = "floating"; // "floating" (default) or "inline"
  let injectedEl = null;
  let debounceTimer = null;

  const CYCLE_MS = 1500;
  const FADE_MS = 300;
  const DEBOUNCE_MS = 100;

  // ---------------------------------------------------------------------------
  // Storage helpers
  // ---------------------------------------------------------------------------

  function loadPreferences() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(
        ["selectedCategory", "enabled", "displayMode"],
        (result) => {
          enabled = result.enabled !== false;
          displayMode = result.displayMode || "floating";
          const catName = result.selectedCategory || "cats";
          resolve(catName);
        }
      );
    });
  }

  function loadCategories() {
    const url = chrome.runtime.getURL("data/categories.json");
    return fetch(url)
      .then((r) => r.json())
      .then((data) => {
        categories = data;
        return data;
      });
  }

  // ---------------------------------------------------------------------------
  // Thinking state detection
  // ---------------------------------------------------------------------------

  /**
   * Detects if Claude is currently thinking/generating by checking for the
   * stop button or spinner. These are the most reliable and cheapest signals.
   */
  function isClaudeThinking() {
    // Strategy 1: Stop button — exact aria-label from claude.com source
    const stopBtn = document.querySelector('button[aria-label="Stop response"]');
    if (stopBtn && stopBtn.offsetParent !== null) return stopBtn;

    // Strategy 2: Any stop-like button (covers aria-label variations)
    const stopAny = document.querySelector(
      'button[aria-label*="Stop" i], button[aria-label*="stop" i]'
    );
    if (stopAny && stopAny.offsetParent !== null) return stopAny;

    // Strategy 3: Spinning animation (progress ring around stop button)
    const spinner = document.querySelector('.animate-spin');
    if (spinner && spinner.offsetParent !== null) return spinner;

    return null;
  }

  // ---------------------------------------------------------------------------
  // Word display
  // ---------------------------------------------------------------------------

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function createFloatingPill() {
    const el = document.createElement("div");
    el.id = "cct-pill";
    el.style.cssText =
      "position:fixed;bottom:90px;left:50%;transform:translateX(-50%);" +
      "background:linear-gradient(135deg,#f26525,#e04a0a);color:white;" +
      "padding:8px 20px;border-radius:24px;font-size:14px;font-weight:600;" +
      "font-style:italic;display:flex;align-items:center;gap:8px;" +
      "box-shadow:0 4px 16px rgba(242,101,37,0.3);z-index:99999;" +
      "transition:opacity 0.3s ease;opacity:1;" +
      "font-family:-apple-system,BlinkMacSystemFont,sans-serif;" +
      "pointer-events:none;";
    document.body.appendChild(el);
    return el;
  }

  function createInlineIndicator(anchorEl) {
    const el = document.createElement("span");
    el.id = "cct-inline";
    el.style.cssText =
      "font-size:14px;color:#d4a574;font-style:italic;font-weight:500;" +
      "margin-left:10px;transition:opacity 0.3s ease;vertical-align:middle;" +
      "display:inline-flex;align-items:center;gap:4px;";

    if (anchorEl && anchorEl.parentElement) {
      anchorEl.parentElement.insertBefore(el, anchorEl.nextSibling);
    } else {
      const msgArea = document.querySelector("main");
      if (msgArea) msgArea.appendChild(el);
    }
    return el;
  }

  function startCycling(anchorEl) {
    if (!enabled || !currentCategory || !currentCategory.words.length) return;
    if (cycleInterval) stopCycling();

    isThinking = true;

    if (displayMode === "inline") {
      injectedEl = createInlineIndicator(anchorEl);
    } else {
      injectedEl = createFloatingPill();
    }

    setWord(pickRandom(currentCategory.words));

    cycleInterval = setInterval(() => {
      if (injectedEl) {
        injectedEl.style.opacity = "0";
        setTimeout(() => {
          setWord(pickRandom(currentCategory.words));
          if (injectedEl) injectedEl.style.opacity = "1";
        }, FADE_MS);
      }
    }, CYCLE_MS);

    console.debug("[CCT] Started cycling:", currentCategory.name);
  }

  function setWord(word) {
    if (!injectedEl || !currentCategory) return;
    const icon = currentCategory.icon || "";
    injectedEl.textContent = icon + " " + word;
  }

  function stopCycling() {
    if (cycleInterval) {
      clearInterval(cycleInterval);
      cycleInterval = null;
    }
    if (injectedEl) {
      injectedEl.remove();
      injectedEl = null;
    }
    isThinking = false;
  }

  // ---------------------------------------------------------------------------
  // MutationObserver (debounced)
  // ---------------------------------------------------------------------------

  function checkThinkingState() {
    const thinkingEl = isClaudeThinking();

    if (thinkingEl && !isThinking) {
      startCycling(thinkingEl);
    } else if (!thinkingEl && isThinking) {
      stopCycling();
    }
  }

  function setupObserver() {
    const observer = new MutationObserver(() => {
      // Debounce — DOM mutations fire rapidly during streaming
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(checkThinkingState, DEBOUNCE_MS);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return observer;
  }

  // ---------------------------------------------------------------------------
  // Message handling (from popup / service worker)
  // ---------------------------------------------------------------------------

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "categoryChanged") {
      const catName = msg.category;
      if (categories[catName]) {
        currentCategory = {
          name: catName,
          icon: categories[catName].icon || "",
          words: categories[catName].words,
        };
      }
      if (isThinking) {
        stopCycling();
        const el = isClaudeThinking();
        if (el) startCycling(el);
      }
      sendResponse({ ok: true });
    }

    if (msg.type === "enabledChanged") {
      enabled = msg.enabled;
      if (!enabled) stopCycling();
      sendResponse({ ok: true });
    }

    if (msg.type === "displayModeChanged") {
      displayMode = msg.displayMode;
      if (isThinking) {
        stopCycling();
        const el = isClaudeThinking();
        if (el) startCycling(el);
      }
      sendResponse({ ok: true });
    }

    return true;
  });

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  async function init() {
    try {
      await loadCategories();
      const catName = await loadPreferences();

      if (categories[catName]) {
        currentCategory = {
          name: catName,
          icon: categories[catName].icon || "",
          words: categories[catName].words,
        };
      } else {
        const first = Object.keys(categories)[0];
        if (first) {
          currentCategory = {
            name: first,
            icon: categories[first].icon || "",
            words: categories[first].words,
          };
        }
      }

      setupObserver();

      // Check if already thinking
      const existing = isClaudeThinking();
      if (existing) startCycling(existing);

      console.log(
        "%c[Claude Custom Think]%c Loaded on " + location.hostname +
        " | Category: " + (currentCategory?.name || "none") +
        " | Mode: " + displayMode +
        " | Enabled: " + enabled,
        "color:#f26525;font-weight:bold", "color:inherit"
      );
    } catch (err) {
      console.error("[Claude Custom Think] Init failed:", err);
    }
  }

  init();
})();
