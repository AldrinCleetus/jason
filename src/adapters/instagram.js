/**
 * GTA Shield - Instagram Site Adapter (instagram.js)
 * Isolates DOM selectors and custom handling for Instagram feeds,
 * Reels vertical player, Explore grid, and Stories tray.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GTAShieldInstagramAdapter = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Isolated DOM Selectors Config
  const SELECTORS = {
    cards: [
      'article',
      'div[role="presentation"] > div > div > div > article',
      'div._aagv',
      'div.x1qjc9v5',
      'div[role="dialog"]',
      'li[role="menuitem"]' // Stories tray
    ],
    caption: [
      'h1',
      'span._aacl',
      'div._a9zs',
      'ul._a9z6',
      'span[dir="auto"]'
    ],
    account: [
      'header a',
      'span.xt0psk2 a',
      'a.x1i10hfl',
      'a[role="link"][tabindex="0"]'
    ],
    hashtags: [
      'a[href*="/explore/tags/"]'
    ],
    altText: [
      'img[alt]'
    ],
    audio: [
      'a[href*="/audio/"]'
    ],
    reelsPlayer: [
      'div[role="dialog"]',
      'div.x1qjc9v5'
    ]
  };

  function match(url) {
    return /instagram\.com/i.test(url || window.location.hostname);
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
    let caption = '';
    let author = '';
    let altText = '';
    let audio = '';
    const hashtags = [];
    const hrefs = [];

    // Extract Caption
    for (const sel of SELECTORS.caption) {
      const el = cardElement.querySelector(sel);
      if (el && el.textContent) {
        caption = el.textContent.trim();
        break;
      }
    }

    // Extract Account Name
    for (const sel of SELECTORS.account) {
      const el = cardElement.querySelector(sel);
      if (el && el.textContent) {
        author = el.textContent.trim().replace(/^@/, '');
        break;
      }
    }

    // Extract Hashtags
    for (const sel of SELECTORS.hashtags) {
      const tags = cardElement.querySelectorAll(sel);
      for (let i = 0; i < tags.length; i++) {
        const t = tags[i].textContent.trim();
        if (t && !hashtags.includes(t)) hashtags.push(t);
      }
    }

    // Extract Alt Text (Instagram auto-generates descriptive alt text)
    for (const sel of SELECTORS.altText) {
      const img = cardElement.querySelector(sel);
      if (img && img.getAttribute('alt')) {
        altText = img.getAttribute('alt');
        break;
      }
    }

    // Extract Audio Label
    for (const sel of SELECTORS.audio) {
      const el = cardElement.querySelector(sel);
      if (el && el.textContent) {
        audio = el.textContent.trim();
        break;
      }
    }

    // Extract Links
    const links = cardElement.querySelectorAll('a[href]');
    for (let i = 0; i < links.length; i++) {
      const h = links[i].getAttribute('href');
      if (h && !hrefs.includes(h)) hrefs.push(h);
    }

    return {
      title: caption,
      caption,
      author,
      altText: `${altText} ${audio}`,
      hashtags,
      hrefs,
      ariaLabels: cardElement.getAttribute('aria-label') || '',
      pageTitle: document.title || ''
    };
  }

  function hideCard(cardElement, decision, settings) {
    cardElement.setAttribute('data-gta-shield-scanned', 'blocked');
    cardElement.classList.add('gta-shield-blocked');

    // Neutralize video playback & audio
    const videos = cardElement.querySelectorAll('video, audio');
    videos.forEach(v => {
      try {
        v.pause();
        v.muted = true;
        v.removeAttribute('src');
      } catch (e) {}
    });

    // Check if this is an active Reel in the vertical player
    const isReel = cardElement.closest(SELECTORS.reelsPlayer.join(', ')) ||
                   /instagram\.com\/reels\//i.test(window.location.href);

    if (isReel) {
      // Automatically skip to next reel to prevent spoiler audio/frame
      setTimeout(() => {
        const eventDown = new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          code: 'ArrowDown',
          keyCode: 40,
          which: 40,
          bubbles: true
        });
        document.dispatchEvent(eventDown);
      }, 50);
    }

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
      <div class="gta-shield-pc-news-note">Images and videos stripped to prevent spoiler exposure</div>
    `;

    cardElement.appendChild(banner);
  }

  function revealCard(cardElement) {
    cardElement.setAttribute('data-gta-shield-scanned', 'clean');
    cardElement.classList.remove('gta-shield-blocked');
    const placeholder = cardElement.querySelector('.gta-shield-placeholder');
    if (placeholder) placeholder.remove();
  }

  function initHooks(coordinator) {
    // Stories tray scanner
    const scanStories = () => {
      const trayItems = document.querySelectorAll('div[role="menu"] button, ul[role="menu"] li');
      trayItems.forEach(item => {
        const text = item.textContent || '';
        if (text && coordinator.engine.matchesObfuscatedGTA6(text)) {
          item.style.setProperty('display', 'none', 'important');
        }
      });
    };

    setInterval(scanStories, 2500);
  }

  return {
    name: 'instagram',
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
