/**
 * GTA Shield - Reddit Site Adapter (reddit.js)
 * Isolates DOM selectors and custom handling for New Reddit (shreddit),
 * Old Reddit, Shadow DOM web components, and comment trees.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GTAShieldRedditAdapter = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Isolated DOM Selectors Config
  const SELECTORS = {
    cards: [
      'shreddit-post',
      'shreddit-comment',
      'div[data-testid="post-container"]',
      'article',
      '.thing.link',
      '.thing.comment',
      '[data-testid="crosspost-post"]'
    ],
    title: [
      '[slot="title"]',
      'a[data-click-id="body"]',
      'a.title',
      'p.title a',
      'h1',
      'h2',
      'h3',
      '.post-title'
    ],
    subreddit: [
      'a[data-testid="subreddit-name"]',
      'a[href^="/r/"]',
      '[subreddit-prefixed-name]',
      '.subreddit'
    ],
    author: [
      'a[data-testid="post_author_link"]',
      'a.author',
      '[author]'
    ],
    flair: [
      '[data-testid="post-flair"]',
      '.linkflairlabel',
      'shreddit-post-flair',
      '.flair'
    ],
    commentBody: [
      'div[data-testid="comment"]',
      '.usertext-body',
      '-post-comment',
      'div.md'
    ],
    links: [
      'a.styled-outbound-link',
      'a[data-testid="outbound-link"]',
      'a.title[href]'
    ],
    sidebarModules: [
      'aside',
      '[data-testid="trending-module"]',
      'div[data-testid="frontpage-sidebar"]'
    ]
  };

  function match(url) {
    return /reddit\.com/i.test(url || window.location.hostname);
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

    // Inspect shadow roots if present
    if (rootNode.shadowRoot && rootNode.shadowRoot.querySelectorAll) {
      const shadowFound = rootNode.shadowRoot.querySelectorAll(selector);
      for (let i = 0; i < shadowFound.length; i++) {
        results.push(shadowFound[i]);
      }
    }

    return results;
  }

  function extractSignals(cardElement, pageContext = {}) {
    let title = '';
    let author = '';
    let subreddit = '';
    let flair = '';
    let commentText = '';
    const hrefs = [];

    // Extract Title (including attributes on shreddit-post)
    if (cardElement.getAttribute('post-title')) {
      title = cardElement.getAttribute('post-title');
    } else {
      for (const sel of SELECTORS.title) {
        const el = cardElement.querySelector(sel);
        if (el && el.textContent) {
          title = el.textContent.trim();
          break;
        }
      }
    }

    // Extract Subreddit
    if (cardElement.getAttribute('subreddit-prefixed-name')) {
      subreddit = cardElement.getAttribute('subreddit-prefixed-name');
    } else {
      for (const sel of SELECTORS.subreddit) {
        const el = cardElement.querySelector(sel);
        if (el && el.textContent) {
          subreddit = el.textContent.trim();
          break;
        }
      }
    }

    // Extract Author
    if (cardElement.getAttribute('author')) {
      author = cardElement.getAttribute('author');
    } else {
      for (const sel of SELECTORS.author) {
        const el = cardElement.querySelector(sel);
        if (el && el.textContent) {
          author = el.textContent.trim();
          break;
        }
      }
    }

    // Extract Flair
    for (const sel of SELECTORS.flair) {
      const el = cardElement.querySelector(sel);
      if (el && el.textContent) {
        flair = el.textContent.trim();
        break;
      }
    }

    // Extract Comment body if it's a comment
    for (const sel of SELECTORS.commentBody) {
      const el = cardElement.querySelector(sel);
      if (el && el.textContent) {
        commentText = el.textContent.trim();
        break;
      }
    }

    // Extract Outbound Links
    for (const sel of SELECTORS.links) {
      const links = cardElement.querySelectorAll(sel);
      for (let i = 0; i < links.length; i++) {
        const h = links[i].getAttribute('href');
        if (h && !hrefs.includes(h)) hrefs.push(h);
      }
    }

    // Check if current page is a subreddit page
    const isSubredditPage = /reddit\.com\/r\//i.test(window.location.href);

    return {
      title: title || commentText,
      author,
      subreddit,
      flair,
      commentPreviews: commentText,
      hrefs,
      ariaLabels: cardElement.getAttribute('aria-label') || '',
      allText: (cardElement.textContent || '').trim(),
      isSubredditPage,
      pageTitle: document.title || ''
    };
  }

  function hideCard(cardElement, decision, settings) {
    cardElement.setAttribute('data-gta-shield-scanned', 'blocked');
    cardElement.classList.add('gta-shield-blocked');

    // Neutralize any active audio/video
    const videos = cardElement.querySelectorAll('video, audio');
    videos.forEach(v => {
      try {
        v.pause();
        v.muted = true;
        v.removeAttribute('src');
      } catch (e) {}
    });

    // If it's a comment, collapse its reply chain
    if (cardElement.tagName.toLowerCase() === 'shreddit-comment') {
      try {
        cardElement.collapsed = true;
        cardElement.setAttribute('collapsed', '');
      } catch (e) {}
    } else if (cardElement.classList.contains('comment')) {
      cardElement.classList.add('collapsed');
    }

    // Remove existing placeholder if present
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

    // Neutralize media
    const media = cardElement.querySelectorAll('img, video, [data-testid="post-image"]');
    media.forEach(m => m.style.setProperty('display', 'none', 'important'));

    const existing = cardElement.querySelector('.gta-shield-pc-news');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.className = 'gta-shield-pc-news';
    banner.setAttribute('role', 'status');

    banner.innerHTML = `
      <div class="gta-shield-pc-news-badge">🎮 GTA Shield • PC News Bypass</div>
      <div class="gta-shield-pc-news-title">${decision.details.title || 'GTA 6 PC Announcement'}</div>
      <div class="gta-shield-pc-news-note">Media and images stripped to prevent spoiler exposure</div>
    `;

    cardElement.appendChild(banner);
  }

  function revealCard(cardElement) {
    cardElement.setAttribute('data-gta-shield-scanned', 'clean');
    cardElement.classList.remove('gta-shield-blocked');
    const placeholder = cardElement.querySelector('.gta-shield-placeholder');
    if (placeholder) placeholder.remove();

    if (cardElement.tagName.toLowerCase() === 'shreddit-comment') {
      cardElement.collapsed = false;
      cardElement.removeAttribute('collapsed');
    }
  }

  function initHooks(coordinator) {
    // Scan sidebar trending module periodically
    const scanSidebar = () => {
      const sidebars = document.querySelectorAll(SELECTORS.sidebarModules.join(', '));
      sidebars.forEach(sidebar => {
        const links = sidebar.querySelectorAll('a');
        links.forEach(link => {
          const text = link.textContent || '';
          if (coordinator.engine.matchesObfuscatedGTA6(text)) {
            const container = link.closest('li, div') || link;
            container.style.setProperty('display', 'none', 'important');
          }
        });
      });
    };

    setInterval(scanSidebar, 2000);
  }

  return {
    name: 'reddit',
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
