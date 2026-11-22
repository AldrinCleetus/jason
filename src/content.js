/**
 * GTA Shield - Content Script Coordinator (content.js)
 * Manages MutationObservers, Shadow DOM scanning, SPA navigation,
 * site adapter selection, and communication with the background script.
 */
(function () {
  'use strict';

  // Prevent multiple injections in same frame
  if (window.__gtaShieldInjected) return;
  window.__gtaShieldInjected = true;

  const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
  const defaults = window.GTAShieldDefaults?.DEFAULT_SETTINGS || {};
  const engine = window.GTAShieldEngine;

  let currentSettings = Object.assign({}, defaults);
  let activeAdapter = null;
  let pageHiddenCount = 0;
  let batchQueue = new Set();
  let batchTimer = null;
  let observer = null;
  const observedShadowRoots = new WeakSet();

  /**
   * Identifies the current platform adapter.
   */
  function resolveAdapter() {
    const url = window.location.href;
    if (window.GTAShieldYouTubeAdapter && window.GTAShieldYouTubeAdapter.match(url)) {
      return window.GTAShieldYouTubeAdapter;
    }
    if (window.GTAShieldRedditAdapter && window.GTAShieldRedditAdapter.match(url)) {
      return window.GTAShieldRedditAdapter;
    }
    if (window.GTAShieldInstagramAdapter && window.GTAShieldInstagramAdapter.match(url)) {
      return window.GTAShieldInstagramAdapter;
    }
    return window.GTAShieldGenericAdapter;
  }

  /**
   * Checks if extension is enabled for the current site.
   */
  function isSiteEnabled() {
    if (!currentSettings.enabled) return false;

    const hostname = window.location.hostname.toLowerCase();
    const siteSettings = currentSettings.sites || {};

    if (/youtube\.com/.test(hostname) && siteSettings['youtube.com'] === false) return false;
    if (/reddit\.com/.test(hostname) && siteSettings['reddit.com'] === false) return false;
    if (/instagram\.com/.test(hostname) && siteSettings['instagram.com'] === false) return false;
    if (!/youtube|reddit|instagram/.test(hostname) && siteSettings['generic'] === false) return false;

    return true;
  }

  /**
   * Evaluates a single card element.
   */
  function processCard(card) {
    if (!card || card.nodeType !== Node.ELEMENT_NODE) return;
    if (card.getAttribute('data-gta-shield-scanned') === 'blocked') return;

    // Check if site is enabled
    if (!isSiteEnabled()) {
      card.setAttribute('data-gta-shield-scanned', 'clean');
      return;
    }

    const pageContext = {
      isGTAContext: engine.matchesObfuscatedGTA6(`${window.location.href} ${document.title || ''}`)
    };

    try {
      const signals = activeAdapter.extractSignals(card, pageContext);
      const currentText = (signals.allText || signals.title || signals.ariaLabels || '').trim();

      // If card was already marked clean, only re-evaluate if content has changed/hydrated
      if (card.getAttribute('data-gta-shield-scanned') === 'clean') {
        if (card.__gtaScannedText === currentText) {
          return;
        }
      }

      // Hydration Check:
      // If the card has no title, no aria-labels, and minimal text,
      // it is an unhydrated component shell.
      // Do NOT mark clean yet — retry until hydrated.
      const hasContent = (signals.title && signals.title.trim().length > 0) ||
                         (currentText.length > 5) ||
                         (signals.ariaLabels && signals.ariaLabels.trim().length > 0);

      if (!hasContent) {
        card.__gtaHydrationRetries = (card.__gtaHydrationRetries || 0) + 1;
        if (card.__gtaHydrationRetries <= 10) {
          setTimeout(() => processCard(card), 100 * card.__gtaHydrationRetries);
          return;
        }
      }

      const decision = engine.scoreCard(signals, currentSettings, pageContext);

      if (decision.shouldHide) {
        activeAdapter.hideCard(card, decision, currentSettings);
        pageHiddenCount++;
        sendBadgeUpdate();
      } else if (decision.isPCNews) {
        activeAdapter.showPCNews(card, decision, currentSettings);
      } else {
        card.setAttribute('data-gta-shield-scanned', 'clean');
        card.__gtaScannedText = currentText;
      }
    } catch (err) {
      if (currentSettings.debugMode) {
        console.error('[GTA Shield] Error scanning card:', err, card);
      }
      card.setAttribute('data-gta-shield-scanned', 'clean');
    }
  }

  /**
   * Flushes the batched queue of elements to scan.
   */
  function flushBatchQueue() {
    batchTimer = null;
    if (batchQueue.size === 0) return;

    const nodesToProcess = Array.from(batchQueue);
    batchQueue.clear();

    nodesToProcess.forEach(node => {
      // Find cards starting from this node or inside it
      if (activeAdapter) {
        const cards = activeAdapter.findCards(node);
        cards.forEach(card => processCard(card));
      }

      // Check for nested shadow roots
      engine.walkShadowRoots(node, (el) => {
        if (el.shadowRoot && !observedShadowRoots.has(el.shadowRoot)) {
          observeSubtree(el.shadowRoot);
        }
      });
    });
  }

  /**
   * Queues an element or subtree for batched evaluation.
   */
  function queueForScanning(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
    batchQueue.add(node);

    if (!batchTimer) {
      batchTimer = requestAnimationFrame(flushBatchQueue);
    }
  }

  /**
   * Observes mutations in a DOM root or ShadowRoot.
   */
  function observeSubtree(rootNode) {
    if (!rootNode) return;
    if (rootNode.nodeType === Node.DOCUMENT_FRAGMENT_NODE && observedShadowRoots.has(rootNode)) return;

    if (rootNode.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
      observedShadowRoots.add(rootNode);
    }

    const obs = new MutationObserver(mutations => {
      for (let i = 0; i < mutations.length; i++) {
        const m = mutations[i];
        for (let j = 0; j < m.addedNodes.length; j++) {
          const added = m.addedNodes[j];
          if (added.nodeType === Node.ELEMENT_NODE) {
            queueForScanning(added);

            // Re-check parent card if an element was inserted inside an existing card
            if (activeAdapter && activeAdapter.SELECTORS && activeAdapter.SELECTORS.cards) {
              const selector = activeAdapter.SELECTORS.cards.join(', ');
              const parentCard = added.closest(selector);
              if (parentCard && parentCard.getAttribute('data-gta-shield-scanned') !== 'blocked') {
                queueForScanning(parentCard);
              }
            }
          }
        }
      }
    });

    obs.observe(rootNode, { childList: true, subtree: true });
  }

  /**
   * Full scan of the entire current document and all active shadow roots.
   */
  function fullScan() {
    if (!activeAdapter) return;
    const cards = activeAdapter.findCards(document.documentElement);
    cards.forEach(card => processCard(card));

    // Walk all shadow roots in document
    engine.walkShadowRoots(document.documentElement, (el) => {
      if (el.shadowRoot) {
        if (!observedShadowRoots.has(el.shadowRoot)) {
          observeSubtree(el.shadowRoot);
        }
        const shadowCards = activeAdapter.findCards(el.shadowRoot);
        shadowCards.forEach(card => processCard(card));
      }
    });
  }

  /**
   * Sends updated hidden count to background script for badge display.
   */
  function sendBadgeUpdate() {
    try {
      browserAPI.runtime.sendMessage({
        type: 'GTA_SHIELD_UPDATE_COUNT',
        count: pageHiddenCount,
        url: window.location.href
      });
    } catch (e) {}
  }

  /**
   * Handles SPA navigations (YouTube yt-navigate-finish, pushState, popstate).
   */
  function handleNavigation() {
    pageHiddenCount = 0;
    sendBadgeUpdate();

    // Re-evaluate current page
    setTimeout(() => {
      fullScan();
    }, 150);
  }

  /**
   * Intercepts SPA history mutations.
   */
  function hookHistory() {
    const originalPushState = history.pushState;
    history.pushState = function () {
      originalPushState.apply(this, arguments);
      handleNavigation();
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = function () {
      originalReplaceState.apply(this, arguments);
      handleNavigation();
    };

    window.addEventListener('popstate', handleNavigation);
    window.addEventListener('hashchange', handleNavigation);
    window.addEventListener('yt-navigate-finish', handleNavigation);
  }

  /**
   * Initializes coordinator.
   */
  async function init() {
    // 1. Load settings from storage
    try {
      const stored = await new Promise(resolve => {
        browserAPI.storage.local.get(null, res => resolve(res || {}));
      });
      if (stored && Object.keys(stored).length > 0) {
        currentSettings = Object.assign({}, defaults, stored);
      }
    } catch (e) {
      currentSettings = Object.assign({}, defaults);
    }

    // 2. Select Adapter
    activeAdapter = resolveAdapter();

    // 3. Coordinator facade object passed to adapters
    const coordinatorFacade = {
      engine,
      getSettings: () => currentSettings,
      processCard,
      fullScan
    };

    // 4. Initialize site specific hooks
    if (activeAdapter.initHooks) {
      activeAdapter.initHooks(coordinatorFacade);
    }

    // 5. Setup SPA history hooks
    hookHistory();

    // 6. Setup MutationObserver on document
    observeSubtree(document.documentElement);

    // 7. Initial full scan when DOM is interactive
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fullScan);
    } else {
      fullScan();
    }

    // 8. Listen for settings updates from popup or options
    browserAPI.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') {
        for (const key in changes) {
          currentSettings[key] = changes[key].newValue;
        }
        // Re-scan page on settings change
        fullScan();
      }
    });

    if (currentSettings.debugMode) {
      console.log(`[GTA Shield] Initialized with adapter: ${activeAdapter.name}`, currentSettings);
    }
  }

  init();
})();
