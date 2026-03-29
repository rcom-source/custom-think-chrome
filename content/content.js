/**
 * Claude Custom Think — Content Script
 *
 * Injected into claude.ai pages. Detects when Claude is "thinking" by
 * observing the pulsing logo animation, then displays themed words
 * either inline (Option A, default) or as a floating pill (Option C).
 *
 * Claude.ai does NOT have a text-based "Thinking..." indicator — it shows
 * a pulsing/animated logo. This script adds text alongside or above it.
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
  let displayMode = "inline"; // "inline" (Option A) or "floating" (Option C)
  let injectedEl = null;

  const CYCLE_MS = 1500;
  const FADE_MS = 300;

  // ---------------------------------------------------------------------------
  // Storage helpers
  // ---------------------------------------------------------------------------

  function loadPreferences() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(
        ["selectedCategory", "enabled", "displayMode"],
        (result) => {
          enabled = result.enabled !== false;
          displayMode = result.displayMode || "inline";
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
   * Detects if Claude is currently "thinking" by looking for the animated
   * response indicator. Claude shows a pulsing logo/animation when
   * generating a response. We detect this via multiple strategies,
   * working on both claude.ai and claude.com.
   */
  function isClaudeThinking() {
    // Strategy 1: Stop button (exact aria-label from claude.com source).
    // The StopButton component renders with aria-label="Stop response".
    const stopBtn = document.querySelector('button[aria-label="Stop response"]');
    if (stopBtn && stopBtn.offsetParent !== null) return stopBtn;

    // Strategy 2: Spinning animation on the stop button ring.
    // Claude adds animate-spin class to a circular progress indicator.
    const spinner = document.querySelector('.animate-spin');
    if (spinner && spinner.offsetParent !== null) return spinner;

    // Strategy 3: ThinkingCell — renders "Thinking" or "Thinking..." text.
    // No data-testid, so match by text content within recent message area.
    const thinkingEls = document.querySelectorAll('div, span');
    for (const el of thinkingEls) {
      if (
        el.children.length === 0 &&
        el.textContent.trim().match(/^Thinking\.{0,3}$/) &&
        el.offsetParent !== null
      ) {
        return el;
      }
    }

    // Strategy 4: Fallback — any stop-like button
    const fallbackStop =
      document.querySelector('button[aria-label*="Stop"]') ||
      document.querySelector('button[aria-label*="stop"]');
    if (fallbackStop && fallbackStop.offsetParent !== null) return fallbackStop;

    return null;
  }

  // ---------------------------------------------------------------------------
  // Word display
  // ---------------------------------------------------------------------------

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function createInlineIndicator(anchorEl) {
    const el = document.createElement("span");
    el.className = "cct-inline-indicator";
    el.style.cssText =
      "font-size:14px;color:#d4a574;font-style:italic;font-weight:500;" +
      "margin-left:10px;transition:opacity 0.3s ease;vertical-align:middle;" +
      "display:inline-flex;align-items:center;gap:4px;";

    // Try to insert next to the thinking element
    if (anchorEl && anchorEl.parentElement) {
      anchorEl.parentElement.insertBefore(el, anchorEl.nextSibling);
    } else {
      // Fallback: append to the last message area
      const msgArea = document.querySelector('[class*="message"], [class*="response"], main');
      if (msgArea) msgArea.appendChild(el);
    }

    return el;
  }

  function createFloatingPill() {
    const el = document.createElement("div");
    el.className = "cct-floating-pill";
    el.style.cssText =
      "position:fixed;bottom:90px;left:50%;transform:translateX(-50%);" +
      "background:linear-gradient(135deg,#f26525,#e04a0a);color:white;" +
      "padding:8px 20px;border-radius:24px;font-size:14px;font-weight:600;" +
      "font-style:italic;display:flex;align-items:center;gap:8px;" +
      "box-shadow:0 4px 16px rgba(242,101,37,0.3);z-index:99999;" +
      "transition:opacity 0.3s ease;font-family:-apple-system,BlinkMacSystemFont,sans-serif;";
    document.body.appendChild(el);
    return el;
  }

  function startCycling(anchorEl) {
    if (!enabled || !currentCategory || !currentCategory.words.length) return;
    if (cycleInterval) stopCycling();

    isThinking = true;

    // Create the display element based on mode
    if (displayMode === "floating") {
      injectedEl = createFloatingPill();
    } else {
      injectedEl = createInlineIndicator(anchorEl);
    }

    // Set initial word
    setWord(pickRandom(currentCategory.words));

    // Start cycling
    cycleInterval = setInterval(() => {
      if (injectedEl) {
        injectedEl.style.opacity = "0";
        setTimeout(() => {
          setWord(pickRandom(currentCategory.words));
          if (injectedEl) injectedEl.style.opacity = "1";
        }, FADE_MS);
      }
    }, CYCLE_MS);
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
  // MutationObserver
  // ---------------------------------------------------------------------------

  function setupObserver() {
    const observer = new MutationObserver(() => {
      const thinkingEl = isClaudeThinking();

      if (thinkingEl && !isThinking) {
        startCycling(thinkingEl);
      } else if (!thinkingEl && isThinking) {
        stopCycling();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
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
      // Restart cycling if currently thinking
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
      // Restart with new mode if currently thinking
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

      // Check if thinking is already happening
      const existing = isClaudeThinking();
      if (existing) startCycling(existing);

      console.debug("[Claude Custom Think] Initialized", {
        category: currentCategory?.name,
        displayMode,
        enabled,
      });
    } catch (err) {
      console.error("[Claude Custom Think] Init failed:", err);
    }
  }

  init();
})();
