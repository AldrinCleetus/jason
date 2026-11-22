/**
 * GTA Shield - Generic Fallback Site Adapter (generic.js)
 * Provides heuristic card detection and full-page blocking for arbitrary web pages.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GTAShieldGenericAdapter = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Isolated Heuristic Selectors Config
  const SELECTORS = {
    cards: [
      'article',
      '[role="article"]',
      '.post',
      '.card',
      '.entry',
      '.news-item',
      '.feed-item',
      '.search-result',
      'li:has(a):has(img)'
    ],
    title: [
      'h1',
      'h2',
      'h3',
      'h4',
      '.title',
      'a.headline'
    ],
    description: [
      'p',
      '.description',
      '.summary',
      '.excerpt'
    ],
    author: [
      '.author',
      '[rel="author"]',
      '.byline',
      '.source'
    ],
    thumbnail: [
      'img'
    ]
  };

  function match(url) {
    // Generic matches anything as fallback
    return true;
  }

  function findCards(rootNode) {
    const selector = SELECTORS.cards.join(', ');
    const results = [];

    if (rootNode.matches && rootNode.matches(selector)) {
      results.push(rootNode);
    }
    if (rootNode.querySelectorAll) {
      const found = rootNode.querySelectorAll(selector);
      for (let i = 0; i < found.length; i++) {
        results.push(found[i]);
      }
    }
    return results;
  }

  function extractSignals(cardElement, pageContext = {}) {
    let title = '';
    let author = '';
    let description = '';
    let altText = '';
    let thumbnail = '';
    const hrefs = [];

    // Extract Title
    for (const sel of SELECTORS.title) {
      const el = cardElement.querySelector(sel);
      if (el && el.textContent) {
        title = el.textContent.trim();
        break;
      }
    }

    // Extract Author
    for (const sel of SELECTORS.author) {
      const el = cardElement.querySelector(sel);
      if (el && el.textContent) {
        author = el.textContent.trim();
        break;
      }
    }

    // Extract Description
    for (const sel of SELECTORS.description) {
      const el = cardElement.querySelector(sel);
      if (el && el.textContent) {
        description = el.textContent.trim();
        break;
      }
    }

    // Extract Image & Alt
    const img = cardElement.querySelector('img');
    if (img) {
      altText = img.getAttribute('alt') || '';
      thumbnail = img.getAttribute('src') || '';
    }

    // Extract Links
    const links = cardElement.querySelectorAll('a[href]');
    for (let i = 0; i < links.length; i++) {
      const h = links[i].getAttribute('href');
      if (h && !hrefs.includes(h)) hrefs.push(h);
    }

    return {
      title,
      author,
      description,
      altText,
      thumbnail,
      hrefs,
      ariaLabels: cardElement.getAttribute('aria-label') || '',
      allText: (cardElement.textContent || '').trim(),
      pageTitle: document.title || ''
    };
  }

  function hideCard(cardElement, decision, settings) {
    cardElement.setAttribute('data-gta-shield-scanned', 'blocked');
    cardElement.classList.add('gta-shield-blocked');

    const videos = cardElement.querySelectorAll('video, audio');
    videos.forEach(v => {
      try {
        v.pause();
        v.muted = true;
        v.removeAttribute('src');
      } catch (e) {}
    });

    const existing = cardElement.querySelector('.gta-shield-placeholder');
    if (existing) existing.remove();

    const placeholder = document.createElement('div');
    placeholder.className = 'gta-shield-placeholder';
    placeholder.setAttribute('role', 'alert');

    let html = `
      <div class="gta-shield-placeholder-icon">🛡️</div>
      <div class="gta-shield-placeholder-body">
        <div class="gta-shield-placeholder-title">GTA 6 Content Hidden</div>
        <div class="gta-shield-placeholder-sub">Blocked by GTA Shield to prevent PC spoilers</div>
    `;

    if (settings.debugMode) {
      html += `
        <div class="gta-shield-placeholder-debug">
          Reasons: ${decision.reasons.join('; ')} | Score: ${decision.score} | Level: ${decision.level}
        </div>
      `;
    }

    if (settings.level === 'light') {
      html += `
        <button class="gta-shield-reveal-btn" type="button">Click to Reveal (Light Level)</button>
      `;
    }

    html += `</div>`;
    placeholder.innerHTML = html;

    if (settings.level === 'light') {
      const btn = placeholder.querySelector('.gta-shield-reveal-btn');
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          revealCard(cardElement);
        });
      }
    }

    cardElement.appendChild(placeholder);
  }

  function showPCNews(cardElement, decision, settings) {
    cardElement.setAttribute('data-gta-shield-scanned', 'blocked');
    cardElement.classList.add('gta-shield-pc-news-card');

    const media = cardElement.querySelectorAll('img, video');
    media.forEach(m => m.style.setProperty('display', 'none', 'important'));

    const existing = cardElement.querySelector('.gta-shield-pc-news');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.className = 'gta-shield-pc-news';
    banner.setAttribute('role', 'status');

    banner.innerHTML = `
      <div class="gta-shield-pc-news-badge">🎮 GTA Shield • PC News Bypass</div>
      <div class="gta-shield-pc-news-title">${decision.details.title || 'GTA 6 PC Announcement'}</div>
      <div class="gta-shield-pc-news-note">Images and media stripped to prevent spoiler exposure</div>
    `;

    cardElement.appendChild(banner);
  }

  function revealCard(cardElement) {
    cardElement.setAttribute('data-gta-shield-scanned', 'clean');
    cardElement.classList.remove('gta-shield-blocked');
    const placeholder = cardElement.querySelector('.gta-shield-placeholder');
    if (placeholder) placeholder.remove();
  }

  /**
   * Checks if the entire page is dedicated to GTA 6. If so, replaces the page with a block screen.
   */
  function checkPageLevelBlock(coordinator) {
    const pageUrl = window.location.href;
    const pageTitle = document.title || '';
    const combined = `${pageUrl} ${pageTitle}`;

    // Only block the entire page if Tier 1 match is found in URL or page Title
    if (coordinator.engine.matchesObfuscatedGTA6(combined)) {
      const settings = coordinator.getSettings();

      // Check if PC news bypass applies to the page
      if (settings.pcNewsMode) {
        const pcCheck = coordinator.engine.checkPCNewsBypass(combined, settings);
        if (pcCheck.isMatch) return; // Allow PC news page
      }

      if (document.body && !document.querySelector('.gta-shield-page-blocker')) {
        const blocker = document.createElement('div');
        blocker.className = 'gta-shield-page-blocker';
        blocker.innerHTML = `
          <div class="gta-shield-page-blocker-icon">🛡️</div>
          <h1>Page Blocked by GTA Shield</h1>
          <p>This entire page contains heavy GTA 6 topics or spoilers. It has been blocked to protect you before the PC launch.</p>
          <div class="gta-shield-page-blocker-actions">
            <button class="gta-shield-page-blocker-btn" id="gta-shield-go-back">Go Back</button>
            <button class="gta-shield-page-blocker-btn secondary" id="gta-shield-proceed">Proceed Anyway</button>
          </div>
        `;

        document.body.appendChild(blocker);

        blocker.querySelector('#gta-shield-go-back').addEventListener('click', () => {
          window.history.back();
        });
        blocker.querySelector('#gta-shield-proceed').addEventListener('click', () => {
          blocker.remove();
        });
      }
    }
  }

  function initHooks(coordinator) {
    // Run page-level check after DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => checkPageLevelBlock(coordinator));
    } else {
      checkPageLevelBlock(coordinator);
    }
  }

  return {
    name: 'generic',
    SELECTORS,
    match,
    findCards,
    extractSignals,
    hideCard,
    showPCNews,
    revealCard,
    initHooks
  };
});
