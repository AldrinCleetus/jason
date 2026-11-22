/**
 * GTA Shield - Background Script (background.js)
 * Manages badge counters, tab state, default settings initialization,
 * and lifetime statistics.
 */
(function () {
  'use strict';

  const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

  // In-memory tab counters: tabId -> count
  const tabCounts = new Map();

  /**
   * Initializes default settings on installation.
   */
  browserAPI.runtime.onInstalled.addListener(async (details) => {
    try {
      const stored = await new Promise(resolve => browserAPI.storage.local.get(null, resolve));
      if (!stored || Object.keys(stored).length === 0) {
        if (typeof GTAShieldDefaults !== 'undefined') {
          await browserAPI.storage.local.set(GTAShieldDefaults.DEFAULT_SETTINGS);
        }
      }
    } catch (e) {
      console.error('[GTA Shield Background] Error initializing defaults:', e);
    }
  });

  /**
   * Updates toolbar action badge for a tab.
   */
  function updateBadge(tabId, count) {
    if (!tabId || tabId < 0) return;

    const text = count > 0 ? String(count) : '';
    browserAPI.action.setBadgeText({ tabId, text });
    browserAPI.action.setBadgeBackgroundColor({
      tabId,
      color: '#e63946'
    });
  }

  /**
   * Message Listener for runtime events.
   */
  browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.type) return;

    if (message.type === 'GTA_SHIELD_UPDATE_COUNT') {
      const tabId = sender.tab ? sender.tab.id : null;
      if (tabId) {
        const count = message.count || 0;
        tabCounts.set(tabId, count);
        updateBadge(tabId, count);

        // Update lifetime statistics in storage
        browserAPI.storage.local.get(['stats'], (res) => {
          const stats = res.stats || { totalHidden: 0, pcNewsBypassed: 0 };
          stats.totalHidden = (stats.totalHidden || 0) + 1;
          browserAPI.storage.local.set({ stats });
        });
      }
      sendResponse({ status: 'ok' });
      return true;
    }

    if (message.type === 'GTA_SHIELD_GET_TAB_COUNT') {
      const tabId = message.tabId;
      const count = tabCounts.get(tabId) || 0;
      sendResponse({ count });
      return true;
    }
  });

  /**
   * Clean up memory when tab is closed.
   */
  browserAPI.tabs.onRemoved.addListener((tabId) => {
    tabCounts.delete(tabId);
  });

  /**
   * Restore badge when tab is switched.
   */
  browserAPI.tabs.onActivated.addListener((activeInfo) => {
    const count = tabCounts.get(activeInfo.tabId) || 0;
    updateBadge(activeInfo.tabId, count);
  });
})();
