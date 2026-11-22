/**
 * GTA Shield - Options & Control Center Logic (options.js)
 */
(function () {
  'use strict';

  const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
  const defaults = window.GTAShieldDefaults?.DEFAULT_SETTINGS || {};
  const engine = window.GTAShieldEngine;

  let currentSettings = Object.assign({}, defaults);

  // Tab switching
  const navItems = document.querySelectorAll('.nav-item');
  const tabPanels = document.querySelectorAll('.tab-panel');
  const pageTitle = document.getElementById('page-title');
  const saveStatus = document.getElementById('save-status');

  function switchTab(tabId, titleText) {
    navItems.forEach(item => {
      if (item.getAttribute('data-tab') === tabId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    tabPanels.forEach(panel => {
      if (panel.id === tabId) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });

    pageTitle.textContent = titleText;
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabId = item.getAttribute('data-tab');
      const title = item.textContent.trim();
      switchTab(tabId, title);
    });
  });

  /**
   * Saves settings to browser.storage.local.
   */
  async function save() {
    await new Promise(resolve => browserAPI.storage.local.set(currentSettings, resolve));
    saveStatus.textContent = 'All changes saved locally';
    saveStatus.style.color = 'var(--accent-green)';
  }

  function notifyChange() {
    saveStatus.textContent = 'Saving...';
    save();
  }

  /**
   * Renders tag pills with a remove button safely without innerHTML.
   */
  function renderTags(containerId, list, onRemove) {
    const container = document.getElementById(containerId);
    if (!container) return;

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    list.forEach((item, index) => {
      const pill = document.createElement('div');
      pill.className = 'tag-pill';

      const textSpan = document.createElement('span');
      textSpan.textContent = item;

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'remove-btn';
      removeBtn.title = 'Remove';
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', () => {
        onRemove(index);
      });

      pill.appendChild(textSpan);
      pill.appendChild(removeBtn);
      container.appendChild(pill);
    });
  }

  function renderAll() {
    // 1. Tiers
    renderTags('tier1-tags', currentSettings.tier1Keywords || [], (idx) => {
      currentSettings.tier1Keywords.splice(idx, 1);
      renderAll();
      notifyChange();
    });

    renderTags('tier2-tags', currentSettings.tier2Keywords || [], (idx) => {
      currentSettings.tier2Keywords.splice(idx, 1);
      renderAll();
      notifyChange();
    });

    renderTags('tier3-tags', currentSettings.tier3Keywords || [], (idx) => {
      currentSettings.tier3Keywords.splice(idx, 1);
      renderAll();
      notifyChange();
    });

    // 2. Blocklists
    const blocks = currentSettings.blocklists || { channels: [], subreddits: [], accounts: [] };
    renderTags('block-channels-tags', blocks.channels || [], (idx) => {
      blocks.channels.splice(idx, 1);
      renderAll();
      notifyChange();
    });

    renderTags('block-subreddits-tags', blocks.subreddits || [], (idx) => {
      blocks.subreddits.splice(idx, 1);
      renderAll();
      notifyChange();
    });

    renderTags('block-accounts-tags', blocks.accounts || [], (idx) => {
      blocks.accounts.splice(idx, 1);
      renderAll();
      notifyChange();
    });

    // Paranoid accounts
    renderTags('paranoid-accounts-tags', currentSettings.paranoidAccounts || [], (idx) => {
      currentSettings.paranoidAccounts.splice(idx, 1);
      renderAll();
      notifyChange();
    });

    // Allowlists
    const allows = currentSettings.allowlists || { channels: [] };
    renderTags('allow-channels-tags', allows.channels || [], (idx) => {
      allows.channels.splice(idx, 1);
      renderAll();
      notifyChange();
    });

    // 3. Site Toggles
    const sites = currentSettings.sites || {};
    document.getElementById('site-toggle-youtube').checked = sites['youtube.com'] !== false;
    document.getElementById('site-toggle-reddit').checked = sites['reddit.com'] !== false;
    document.getElementById('site-toggle-instagram').checked = sites['instagram.com'] !== false;
    document.getElementById('site-toggle-generic').checked = sites['generic'] !== false;

    // 4. Feature Toggles
    document.getElementById('options-pcnews-toggle').checked = !!currentSettings.pcNewsMode;
    document.getElementById('options-debug-toggle').checked = !!currentSettings.debugMode;
  }

  /**
   * Setup Add Keyword Buttons.
   */
  document.querySelectorAll('.add-tag-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-target');
      const val = prompt(`Enter new term:`);
      if (!val || !val.trim()) return;

      const trimmed = val.trim();

      if (target === 'tier1') {
        if (!currentSettings.tier1Keywords.includes(trimmed)) currentSettings.tier1Keywords.push(trimmed);
      } else if (target === 'tier2') {
        if (!currentSettings.tier2Keywords.includes(trimmed)) currentSettings.tier2Keywords.push(trimmed);
      } else if (target === 'tier3') {
        if (!currentSettings.tier3Keywords.includes(trimmed)) currentSettings.tier3Keywords.push(trimmed);
      } else if (target === 'block-channels') {
        if (!currentSettings.blocklists.channels.includes(trimmed)) currentSettings.blocklists.channels.push(trimmed);
      } else if (target === 'block-subreddits') {
        const sub = trimmed.startsWith('r/') ? trimmed : `r/${trimmed}`;
        if (!currentSettings.blocklists.subreddits.includes(sub)) currentSettings.blocklists.subreddits.push(sub);
      } else if (target === 'block-accounts') {
        if (!currentSettings.blocklists.accounts.includes(trimmed)) currentSettings.blocklists.accounts.push(trimmed);
      } else if (target === 'paranoid-accounts') {
        if (!currentSettings.paranoidAccounts.includes(trimmed)) currentSettings.paranoidAccounts.push(trimmed);
      } else if (target === 'allow-channels') {
        if (!currentSettings.allowlists.channels.includes(trimmed)) currentSettings.allowlists.channels.push(trimmed);
      }

      renderAll();
      notifyChange();
    });
  });

  // Site toggles listener
  ['youtube', 'reddit', 'instagram', 'generic'].forEach(siteKey => {
    const el = document.getElementById(`site-toggle-${siteKey}`);
    if (el) {
      el.addEventListener('change', () => {
        if (!currentSettings.sites) currentSettings.sites = {};
        const key = siteKey === 'generic' ? 'generic' : `${siteKey}.com`;
        currentSettings.sites[key] = el.checked;
        notifyChange();
      });
    }
  });

  // Feature toggles listener
  document.getElementById('options-pcnews-toggle').addEventListener('change', (e) => {
    currentSettings.pcNewsMode = e.target.checked;
    notifyChange();
  });

  document.getElementById('options-debug-toggle').addEventListener('change', (e) => {
    currentSettings.debugMode = e.target.checked;
    notifyChange();
  });

  // Reset to Defaults
  document.getElementById('reset-defaults-btn').addEventListener('click', () => {
    if (confirm('Reset all settings, keyword tiers, and blocklists to default values?')) {
      currentSettings = JSON.parse(JSON.stringify(defaults));
      renderAll();
      notifyChange();
    }
  });

  // Live Score Tester
  const runTestBtn = document.getElementById('run-test-btn');
  const testTitleInput = document.getElementById('test-title');
  const testDescInput = document.getElementById('test-desc');
  const testAuthorInput = document.getElementById('test-author');
  const testSubInput = document.getElementById('test-sub');
  const resultBox = document.getElementById('test-result-box');
  const resultBadge = document.getElementById('result-badge');
  const resultScore = document.getElementById('result-score');
  const resultReasons = document.getElementById('result-reasons');
  const resultMatches = document.getElementById('result-matches');

  runTestBtn.addEventListener('click', () => {
    const signals = {
      title: testTitleInput.value,
      description: testDescInput.value,
      author: testAuthorInput.value,
      subreddit: testSubInput.value
    };

    const decision = engine.scoreCard(signals, currentSettings);

    resultBox.style.display = 'flex';
    resultBadge.textContent = decision.decision;
    resultBadge.className = `result-badge ${decision.decision}`;
    resultScore.textContent = `Calculated Score: ${decision.score} (Level: ${decision.level})`;
    while (resultReasons.firstChild) {
      resultReasons.removeChild(resultReasons.firstChild);
    }
    const strongEl = document.createElement('strong');
    strongEl.textContent = 'Reasons: ';
    const textNode = document.createTextNode(decision.reasons.length ? decision.reasons.join(' • ') : 'No spoiler signals detected');
    resultReasons.appendChild(strongEl);
    resultReasons.appendChild(textNode);

    const det = decision.details || {};
    resultMatches.textContent = `Tier 1: [${(det.tier1Matches || []).join(', ')}] | Tier 2: [${(det.tier2Matches || []).join(', ')}] | Tier 3: [${(det.tier3Matches || []).join(', ')}]`;
  });

  // Load from storage
  async function init() {
    const stored = await new Promise(resolve => browserAPI.storage.local.get(null, resolve));
    if (stored && Object.keys(stored).length > 0) {
      currentSettings = Object.assign({}, defaults, stored);
    }
    renderAll();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
