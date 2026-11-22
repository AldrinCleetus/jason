/**
 * GTA Shield - Popup Logic (popup.js)
 */
(function () {
  'use strict';

  const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
  const defaults = window.GTAShieldDefaults?.DEFAULT_SETTINGS || {
    enabled: true,
    level: 'strict',
    pcNewsMode: true,
    paranoidMode: false,
    sites: {
      'youtube.com': true,
      'reddit.com': true,
      'instagram.com': true,
      'generic': true
    }
  };

  let currentSettings = Object.assign({}, defaults);
  let currentDomainKey = 'generic';

  // DOM elements
  const masterToggle = document.getElementById('master-toggle');
  const statusPill = document.getElementById('status-pill');
  const statusText = document.getElementById('status-text');
  const levelButtons = document.querySelectorAll('#level-control .segment');
  const levelHint = document.getElementById('level-hint');
  const pcNewsToggle = document.getElementById('pc-news-toggle');
  const siteToggle = document.getElementById('site-toggle');
  const siteToggleLabel = document.getElementById('site-toggle-label');
  const siteToggleDesc = document.getElementById('site-toggle-desc');
  const paranoidToggle = document.getElementById('paranoid-toggle');
  const pageHiddenCountEl = document.getElementById('page-hidden-count');
  const lifetimeHiddenCountEl = document.getElementById('lifetime-hidden-count');
  const openOptionsBtn = document.getElementById('open-options');

  const LEVEL_HINTS = {
    strict: 'Strict: Hides any Tier 1, any Tier 2 + Tier 3 combo, or blocklisted source. Click-to-reveal disabled.',
    balanced: 'Balanced: Hides Tier 1 or Tier 2 paired with GTA context. Click-to-reveal disabled.',
    light: 'Light: Hides explicit Tier 1 terms only. Click-to-reveal enabled.'
  };

  /**
   * Identifies current active tab and site key.
   */
  async function detectCurrentSite() {
    try {
      const tabs = await new Promise(resolve => browserAPI.tabs.query({ active: true, currentWindow: true }, resolve));
      if (tabs && tabs[0] && tabs[0].url) {
        const url = new URL(tabs[0].url);
        const host = url.hostname.toLowerCase();

        if (host.includes('youtube.com')) {
          currentDomainKey = 'youtube.com';
          siteToggleLabel.textContent = 'Active on YouTube';
        } else if (host.includes('reddit.com')) {
          currentDomainKey = 'reddit.com';
          siteToggleLabel.textContent = 'Active on Reddit';
        } else if (host.includes('instagram.com')) {
          currentDomainKey = 'instagram.com';
          siteToggleLabel.textContent = 'Active on Instagram';
        } else {
          currentDomainKey = 'generic';
          siteToggleLabel.textContent = `Active on Other Sites`;
        }
        siteToggleDesc.textContent = `Protection for ${host || 'current site'}`;

        // Fetch tab's current hidden count from background script
        browserAPI.runtime.sendMessage({
          type: 'GTA_SHIELD_GET_TAB_COUNT',
          tabId: tabs[0].id
        }, (res) => {
          if (res && typeof res.count === 'number') {
            pageHiddenCountEl.textContent = String(res.count);
          }
        });
      }
    } catch (e) {
      siteToggleLabel.textContent = 'Active on this site';
    }
  }

  /**
   * Updates UI states from current settings.
   */
  function renderUI() {
    // Master toggle
    masterToggle.checked = !!currentSettings.enabled;
    if (currentSettings.enabled) {
      statusPill.classList.remove('disabled');
      statusText.textContent = 'ACTIVE';
    } else {
      statusPill.classList.add('disabled');
      statusText.textContent = 'PAUSED';
    }

    // Protection Level
    levelButtons.forEach(btn => {
      const lvl = btn.getAttribute('data-level');
      if (lvl === currentSettings.level) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    levelHint.textContent = LEVEL_HINTS[currentSettings.level] || LEVEL_HINTS.strict;

    // Feature toggles
    pcNewsToggle.checked = !!currentSettings.pcNewsMode;
    paranoidToggle.checked = !!currentSettings.paranoidMode;

    // Site toggle
    const sites = currentSettings.sites || {};
    siteToggle.checked = sites[currentDomainKey] !== false;

    // Lifetime stats
    const stats = currentSettings.stats || {};
    lifetimeHiddenCountEl.textContent = String(stats.totalHidden || 0);
  }

  /**
   * Persists settings to storage.
   */
  async function saveSettings() {
    await new Promise(resolve => browserAPI.storage.local.set(currentSettings, resolve));
    renderUI();
  }

  /**
   * Initializes event listeners.
   */
  function initListeners() {
    masterToggle.addEventListener('change', () => {
      currentSettings.enabled = masterToggle.checked;
      saveSettings();
    });

    levelButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const chosen = btn.getAttribute('data-level');
        currentSettings.level = chosen;
        saveSettings();
      });
    });

    pcNewsToggle.addEventListener('change', () => {
      currentSettings.pcNewsMode = pcNewsToggle.checked;
      saveSettings();
    });

    paranoidToggle.addEventListener('change', () => {
      currentSettings.paranoidMode = paranoidToggle.checked;
      saveSettings();
    });

    siteToggle.addEventListener('change', () => {
      if (!currentSettings.sites) currentSettings.sites = {};
      currentSettings.sites[currentDomainKey] = siteToggle.checked;
      saveSettings();
    });

    openOptionsBtn.addEventListener('click', () => {
      if (browserAPI.runtime.openOptionsPage) {
        browserAPI.runtime.openOptionsPage();
      } else {
        window.open(browserAPI.runtime.getURL('ui/options.html'));
      }
    });
  }

  async function load() {
    await detectCurrentSite();
    const stored = await new Promise(resolve => browserAPI.storage.local.get(null, resolve));
    if (stored && Object.keys(stored).length > 0) {
      currentSettings = Object.assign({}, defaults, stored);
    }
    renderUI();
    initListeners();
  }

  document.addEventListener('DOMContentLoaded', load);
})();
