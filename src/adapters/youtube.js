/**
 * GTA Shield - YouTube Site Adapter (youtube.js)
 * Isolates all DOM selectors and custom handling for YouTube.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GTAShieldYouTubeAdapter = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Isolated DOM Selectors Config
  const SELECTORS = {
    cards: [
      'ytd-rich-item-renderer',
      'ytd-video-renderer',
      'ytd-grid-video-renderer',
      'ytd-compact-video-renderer',
      'ytd-reel-item-renderer',
      'ytd-reel-video-renderer',
      'ytd-playlist-video-renderer',
      'ytd-playlist-panel-video-renderer',
      'ytd-comment-thread-renderer',
      'ytd-comment-view-model',
      'ytd-post-renderer',
      'ytd-notification-renderer',
      'yt-lockup-view-model',
      'ytd-rich-grid-media',
      '.ytp-ce-element'
    ],
    title: [
      '#video-title',
      '#video-title-link',
      'h3.title-style',
      'yt-formatted-string#video-title',
      'a.yt-lockup-metadata-view-model-wiz__title',
      '.yt-lockup-metadata-view-model-wiz__title',
      'h3.yt-lockup-metadata-view-model-wiz__title',
      'h3 a[href*="/watch"]',
      'a[href*="/watch"]',
      'h3 a',
      'h3',
      'h2',
      '.yt-core-attributed-string',
      '#content-text', // for comments
      '.ytp-ce-title'
    ],
    channel: [
      '#channel-name a',
      '#byline a',
      '.ytd-channel-name a',
      '#author-text',
      'yt-formatted-string#text.ytd-channel-name',
      '.yt-lockup-byline-view-model-wiz a',
      '.yt-lockup-byline-view-model-wiz',
      'a[href*="/@"]',
      'a[href*="/channel/"]',
      '.ytp-ce-channel-title'
    ],
    description: [
      '#description-text',
      '.metadata-snippet-text',
      '#snippet'
    ],
    thumbnail: [
      'ytd-thumbnail img',
      'yt-image img',
      '#thumbnail img',
      'img.yt-core-image',
      '.yt-thumbnail-view-model img',
      '.ytp-ce-element img'
    ],
    links: [
      'a#thumbnail',
      'a#video-title-link',
      'a.yt-simple-endpoint',
      'a[href*="/watch"]'
    ],
    searchSuggestions: [
      'ul.sbsb_b li',
      '.sbdd_b li',
      '.gsfs',
      'div.sbsb_c'
    ]
  };

  function match(url) {
    return /youtube\.com/i.test(url || window.location.hostname);
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
    const ariaLabelsList = [];

    // 1. Gather all aria-labels from cardElement and any descendants
    if (cardElement.getAttribute('aria-label')) {
      ariaLabelsList.push(cardElement.getAttribute('aria-label'));
    }
    const ariaEls = cardElement.querySelectorAll('[aria-label]');
    for (let i = 0; i < ariaEls.length; i++) {
      const a = ariaEls[i].getAttribute('aria-label');
      if (a && !ariaLabelsList.includes(a)) {
        ariaLabelsList.push(a);
      }
    }

    // 2. Extract Title from specific selectors
    for (const sel of SELECTORS.title) {
      const el = cardElement.querySelector(sel);
      if (el && el.textContent && el.textContent.trim()) {
        title = el.textContent.trim();
        break;
      }
    }

    // Fallback: If title selector missed, search headings & watch links
    if (!title) {
      const heading = cardElement.querySelector('h1, h2, h3, h4, a[href*="/watch"]');
      if (heading && heading.textContent && heading.textContent.trim()) {
        title = heading.textContent.trim();
      }
    }

    // 3. Extract Channel / Author
    for (const sel of SELECTORS.channel) {
      const el = cardElement.querySelector(sel);
      if (el && el.textContent && el.textContent.trim()) {
        author = el.textContent.trim();
        break;
      }
    }

    // 4. Extract Description / Snippet
    for (const sel of SELECTORS.description) {
      const el = cardElement.querySelector(sel);
      if (el && el.textContent && el.textContent.trim()) {
        description = el.textContent.trim();
        break;
      }
    }

    // 5. Extract Thumbnail & Alt Text from all images
    const imgEls = cardElement.querySelectorAll('img');
    for (let i = 0; i < imgEls.length; i++) {
      const alt = imgEls[i].getAttribute('alt');
      const src = imgEls[i].getAttribute('src');
      if (alt) altText += ' ' + alt;
      if (src && !thumbnail) thumbnail = src;
    }

    // 6. Extract Links
    for (const sel of SELECTORS.links) {
      const links = cardElement.querySelectorAll(sel);
      for (let i = 0; i < links.length; i++) {
        const h = links[i].getAttribute('href');
        if (h && !hrefs.includes(h)) hrefs.push(h);
      }
    }

    // 7. Full text content fallback
    const allText = (cardElement.textContent || '').trim();

    // 8. If title is still empty but we have aria-label or textContent, extract best line
    if (!title && ariaLabelsList.length > 0) {
      title = ariaLabelsList[0].split(/•|\n/)[0].trim();
    } else if (!title && allText) {
      title = allText.split(/\n/)[0].trim();
    }

    // Check if channel page
    const isChannelPage = /youtube\.com\/(@|channel\/|c\/)/i.test(window.location.href);

    return {
      title,
      author,
      description,
      altText: altText.trim(),
      thumbnail,
      hrefs,
      ariaLabels: ariaLabelsList.join(' '),
      titleAttrs: cardElement.getAttribute('title') || '',
      allText,
      isChannelPage,
      pageTitle: document.title || ''
    };
  }

  function hideCard(cardElement, decision, settings) {
    cardElement.setAttribute('data-gta-shield-scanned', 'blocked');
    cardElement.classList.add('gta-shield-blocked');

    // Neutralize any active video playback (especially inside Shorts or previews)
    const videos = cardElement.querySelectorAll('video');
    videos.forEach(v => {
      try {
        v.pause();
        v.muted = true;
        v.removeAttribute('src');
      } catch (e) {}
    });

    // Remove existing placeholder if present
    const existing = cardElement.querySelector('.gta-shield-placeholder');
    if (existing) existing.remove();

    // Create placeholder element
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

    // Click to reveal is available ONLY in Light level
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

    // Neutralize thumbnails and media
    const media = cardElement.querySelectorAll('img, video, ytd-thumbnail');
    media.forEach(m => m.style.setProperty('display', 'none', 'important'));

    const existing = cardElement.querySelector('.gta-shield-pc-news');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.className = 'gta-shield-pc-news';
    banner.setAttribute('role', 'status');

    banner.innerHTML = `
      <div class="gta-shield-pc-news-badge">🎮 GTA Shield • PC News Bypass</div>
      <div class="gta-shield-pc-news-title">${decision.details.title || 'GTA 6 PC Announcement'}</div>
      <div class="gta-shield-pc-news-note">Media and thumbnails stripped to prevent spoiler exposure</div>
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
   * YouTube-specific hooks: search autocomplete stripping and channel page monitoring.
   */
  function initHooks(coordinator) {
    // 1. Search Autocomplete Dropper
    const filterAutocomplete = () => {
      const items = document.querySelectorAll(SELECTORS.searchSuggestions.join(', '));
      items.forEach(item => {
        const text = (item.textContent || '').trim();
        if (text && coordinator.engine.matchesObfuscatedGTA6(text)) {
          item.style.setProperty('display', 'none', 'important');
        }
      });
    };

    // Watch for autocomplete box
    const acObserver = new MutationObserver(filterAutocomplete);
    acObserver.observe(document.documentElement, { childList: true, subtree: true });

    // 2. Channel Page Blocker: if channel name is in blocklist, show banner
    const checkChannelPage = () => {
      if (!/youtube\.com\/(@|channel\/)/i.test(window.location.href)) return;
      const channelHeader = document.querySelector('ytd-channel-name, #channel-header');
      if (channelHeader) {
        const channelName = (channelHeader.textContent || '').trim();
        const settings = coordinator.getSettings();
        const blocklist = settings.blocklists?.channels || [];
        if (blocklist.some(ch => ch.toLowerCase() === channelName.toLowerCase())) {
          const contents = document.querySelector('ytd-browse[page-subtype="channels"] #contents');
          if (contents && !contents.getAttribute('data-gta-shield-blocked')) {
            contents.setAttribute('data-gta-shield-blocked', 'true');
            contents.innerHTML = `
              <div class="gta-shield-placeholder" style="margin: 40px auto; max-width: 600px;">
                <div class="gta-shield-placeholder-icon">🛡️</div>
                <div class="gta-shield-placeholder-body">
                  <div class="gta-shield-placeholder-title">Channel Content Hidden</div>
                  <div class="gta-shield-placeholder-sub">Channel "${channelName}" is on your GTA Shield blocklist.</div>
                </div>
              </div>
            `;
          }
        }
      }
    };

    window.addEventListener('yt-navigate-finish', checkChannelPage);
    setTimeout(checkChannelPage, 1000);
  }

  return {
    name: 'youtube',
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
