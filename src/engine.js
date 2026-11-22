/**
 * GTA Shield - Core Scoring Engine (engine.js)
 * Evaluates extracted signals from web elements to determine if they contain GTA 6 content.
 * Designed for fail-closed protection with zero external dependencies.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const defaults = require('./defaults');
    module.exports = factory(defaults);
  } else {
    root.GTAShieldEngine = factory(root.GTAShieldDefaults || {});
  }
})(typeof self !== 'undefined' ? self : this, function (defaultsModule) {
  'use strict';

  const DEFAULT_SETTINGS = defaultsModule.DEFAULT_SETTINGS || {
    enabled: true,
    level: 'strict',
    pcNewsMode: true,
    paranoidMode: false,
    debugMode: false,
    tier1Keywords: ['gta 6', 'gta vi', 'gta6', 'gtavi', 'grand theft auto 6', 'grand theft auto vi', 'leonida'],
    tier2Keywords: ['lucia', 'jason', 'rockstar', 'trailer 3', 'leak', 'map', 'mission', 'ending', 'story', 'protagonist', 'take-two', 'gameplay', 'vice city'],
    tier3Keywords: ['gta', 'grand theft auto', 'open world', 'rockstar games', 'gta online', 'gta v'],
    blocklists: { channels: [], subreddits: [], accounts: [] },
    allowlists: { channels: [], subreddits: [], accounts: [], domains: [] },
    paranoidAccounts: []
  };

  /**
   * Normalizes text by stripping diacritics, zero-width characters,
   * collapsing emoji/punctuation tricks, and decoding common leetspeak.
   */
  function normalizeText(text) {
    if (!text || typeof text !== 'string') return '';

    // 1. Unicode NFD normalization and remove diacritic marks
    let cleaned = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // 2. Remove zero-width characters, soft hyphens, and non-printable control chars
    cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF\u00AD\u2060\u200E\u200F\u0000-\u001F]/g, '');

    // 3. Lowercase
    cleaned = cleaned.toLowerCase();

    // 4. Decode common emojis used to split keywords (e.g. gta💀6, gta🔥vi)
    // Replace emoji and symbol sequences with a single space
    cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, ' ');

    return cleaned;
  }

  /**
   * Translates leetspeak characters to standard alphabet.
   */
  function leetDecode(str) {
    if (!str) return '';
    return str
      // Multi-char acronym leetspeak first
      .replace(/6t4/gi, 'gta')
      .replace(/\bv1\b/gi, 'vi')
      .replace(/\bv!\b/gi, 'vi')
      // Character substitutions
      .replace(/[@]/g, 'a')
      .replace(/[\$]/g, 's')
      .replace(/[0]/g, 'o')
      .replace(/[3]/g, 'e')
      .replace(/[4]/g, 'a')
      .replace(/[5]/g, 's')
      .replace(/[7]/g, 't')
      .replace(/[!]/g, 'i')
      .replace(/\|/g, 'i')
      .replace(/\b1\b/g, 'i');
  }

  /**
   * Collapses spaced out or punctuated acronyms, like:
   * "g t a 6" -> "gta 6"
   * "g.t.a. 6" -> "gta 6"
   * "g_t_a_6" -> "gta 6"
   * "gta-vi" -> "gta vi"
   */
  function collapseSpacedAcronyms(str) {
    if (!str) return '';
    // Collapse single-letter g-t-a or g t a
    let res = str.replace(/\bg\s*[\.\-_\*~]?\s*t\s*[\.\-_\*~]?\s*a\b/gi, 'gta');
    // Collapse grand-theft-auto
    res = res.replace(/\bgrand\s*[\.\-_\*~]?\s*theft\s*[\.\-_\*~]?\s*auto\b/gi, 'grand theft auto');
    // Normalize dashes and underscores to spaces
    res = res.replace(/[\.\-_\*~/\\+]+/g, ' ');
    // Collapse repeated characters (e.g. gtttaaa -> gta, leeeak -> leak)
    res = res.replace(/([a-z])\1{2,}/g, '$1$1');
    // Collapse whitespace
    res = res.replace(/\s+/g, ' ').trim();
    return res;
  }

  /**
   * Checks for obfuscated GTA 6 patterns using robust regexes
   * Covers: "gta 6", "gta vi", "gta6", "gtavi", "gta six", "grand theft auto 6/vi/six",
   * hashtags, and leetspeak forms.
   */
  const GTA6_REGEXES = [
    // Direct matches with optional separators
    /\b(?:g[\W_]*t[\W_]*a|grand[\W_]*theft[\W_]*auto)[\W_]*(?:6|vi|six)\b/i,
    // Joined forms: gta6, gtavi, gta6leaks, gta6trailer
    /\b(?:gta|grandtheftauto)(?:6|vi|six)\w*\b/i,
    // Hashtags: #gta6, #gtavi, #gta6trailer, #gta6leaks, #gtavileaks, etc.
    /#(?:gta|grandtheftauto)[\W_]*(?:6|vi|six)\w*/i,
    // Leetspeak variants: 6t4 6, 6t4 vi, gta v1, gtav!
    /\b6t4[\W_]*(?:6|vi|v1|v!|six)\b/i,
    /\bgta[\W_]*(?:v1|v!)\b/i,
    // Leonida (GTA 6 location)
    /\bleonida\b/i
  ];

  function matchesObfuscatedGTA6(text) {
    if (!text) return false;
    for (let i = 0; i < GTA6_REGEXES.length; i++) {
      if (GTA6_REGEXES[i].test(text)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Checks if string contains a keyword using word boundaries where appropriate.
   */
  function containsKeyword(normalizedText, keyword) {
    if (!normalizedText || !keyword) return false;
    const kw = keyword.toLowerCase().trim();
    if (!kw) return false;

    // If keyword starts with #, check directly
    if (kw.startsWith('#')) {
      return normalizedText.includes(kw);
    }

    // Word boundary match
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|\\W)${escaped}(?:$|\\W)`, 'i');
    return regex.test(normalizedText);
  }

  /**
   * Checks whether the card text matches PC News bypass criteria.
   * Format: Primary term (GTA 6) + Platform (PC/Steam/Epic) + Action (release/launch/date/announce/port)
   */
  function checkPCNewsBypass(normalizedCombinedText, settings) {
    if (!settings.pcNewsMode) {
      return { isMatch: false, reason: 'PC news mode is disabled' };
    }

    const patterns = settings.pcNewsPatterns || DEFAULT_SETTINGS.pcNewsPatterns;
    const text = normalizedCombinedText;

    for (const pattern of patterns) {
      const primaryMatch = pattern.primary.some(term => containsKeyword(text, term) || matchesObfuscatedGTA6(text));
      if (!primaryMatch) continue;

      const platformMatch = pattern.platform.some(term => containsKeyword(text, term));
      if (!platformMatch) continue;

      const actionMatch = pattern.action.some(term => containsKeyword(text, term));
      if (!actionMatch) continue;

      return {
        isMatch: true,
        patternId: pattern.id || pattern.name,
        reason: `Matched PC news pattern: (GTA 6) + (Platform) + (Action)`
      };
    }

    return { isMatch: false };
  }

  /**
   * Main Scoring Function.
   * Evaluates extracted signals against active settings and page context.
   * Returns a complete decision report.
   */
  function scoreCard(signals, customSettings = {}, pageContext = {}) {
    const settings = Object.assign({}, DEFAULT_SETTINGS, customSettings);

    // If extension is globally disabled, always allow
    if (!settings.enabled) {
      return {
        shouldHide: false,
        isPCNews: false,
        score: 0,
        decision: 'SHOW',
        level: settings.level,
        reasons: ['Extension disabled'],
        details: { tier1Matches: [], tier2Matches: [], tier3Matches: [] }
      };
    }

    // Aggregate text signals
    const title = signals.title || '';
    const description = signals.description || '';
    const caption = signals.caption || '';
    const altText = signals.altText || '';
    const ariaLabels = signals.ariaLabels || '';
    const titleAttrs = signals.titleAttrs || '';
    const author = (signals.author || '').trim();
    const subreddit = (signals.subreddit || '').trim();
    const flair = signals.flair || '';
    const thumbnail = signals.thumbnail || '';
    const chapters = signals.chapters || '';
    const comments = signals.commentPreviews || '';
    const hashtags = Array.isArray(signals.hashtags) ? signals.hashtags.join(' ') : (signals.hashtags || '');
    const hrefs = Array.isArray(signals.hrefs) ? signals.hrefs.join(' ') : (signals.hrefs || '');

    // Combine all textual signals
    const rawCombined = [
      title,
      description,
      caption,
      altText,
      ariaLabels,
      titleAttrs,
      flair,
      thumbnail,
      chapters,
      comments,
      hashtags,
      hrefs
    ].join(' ');

    // Normalize versions of text
    const normText = normalizeText(rawCombined);
    const leetText = leetDecode(normText);
    const collapsedText = collapseSpacedAcronyms(leetText);

    // Also normalize title specifically for targeted checks
    const normTitle = collapseSpacedAcronyms(leetDecode(normalizeText(title)));

    // Combined search string for keyword detection
    const fullSearchText = `${normText} ${leetText} ${collapsedText}`;

    // 1. Check Allowlists first
    const allowlists = settings.allowlists || DEFAULT_SETTINGS.allowlists;
    if (author && allowlists.channels && allowlists.channels.some(ch => ch.toLowerCase() === author.toLowerCase())) {
      return {
        shouldHide: false,
        isPCNews: false,
        score: 0,
        decision: 'SHOW',
        level: settings.level,
        reasons: [`Channel "${author}" is in allowlist`],
        details: { allowlisted: true }
      };
    }
    if (subreddit && allowlists.subreddits && allowlists.subreddits.some(sub => sub.toLowerCase() === subreddit.toLowerCase())) {
      return {
        shouldHide: false,
        isPCNews: false,
        score: 0,
        decision: 'SHOW',
        level: settings.level,
        reasons: [`Subreddit "${subreddit}" is in allowlist`],
        details: { allowlisted: true }
      };
    }
    if (author && allowlists.accounts && allowlists.accounts.some(acc => acc.toLowerCase() === author.toLowerCase())) {
      return {
        shouldHide: false,
        isPCNews: false,
        score: 0,
        decision: 'SHOW',
        level: settings.level,
        reasons: [`Account "${author}" is in allowlist`],
        details: { allowlisted: true }
      };
    }

    // 2. Extra Paranoid Mode Check
    if (settings.paranoidMode && author) {
      const paranoidList = settings.paranoidAccounts || DEFAULT_SETTINGS.paranoidAccounts;
      const isParanoidMatch = paranoidList.some(item => {
        const cleanItem = item.toLowerCase().replace(/^r\//, '').replace(/^@/, '');
        const cleanAuthor = author.toLowerCase().replace(/^r\//, '').replace(/^@/, '');
        return cleanAuthor === cleanItem;
      });

      if (isParanoidMatch) {
        return {
          shouldHide: true,
          isPCNews: false,
          score: 999,
          decision: 'HIDE',
          level: settings.level,
          reasons: [`Extra paranoid mode: Source "${author}" is in monitored GTA account list`],
          details: { paranoidMatch: true }
        };
      }
    }

    // 3. Blocklists Check
    const blocklists = settings.blocklists || DEFAULT_SETTINGS.blocklists;
    let isSourceBlocklisted = false;
    let blocklistReason = '';

    if (author && blocklists.channels && blocklists.channels.some(ch => ch.toLowerCase() === author.toLowerCase())) {
      isSourceBlocklisted = true;
      blocklistReason = `Channel "${author}" is in blocklist`;
    } else if (subreddit && blocklists.subreddits && blocklists.subreddits.some(sub => {
      const s1 = sub.toLowerCase().replace(/^r\//, '');
      const s2 = subreddit.toLowerCase().replace(/^r\//, '');
      return s1 === s2;
    })) {
      isSourceBlocklisted = true;
      blocklistReason = `Subreddit "${subreddit}" is in blocklist`;
    } else if (author && blocklists.accounts && blocklists.accounts.some(acc => {
      const a1 = acc.toLowerCase().replace(/^@/, '');
      const a2 = author.toLowerCase().replace(/^@/, '');
      return a1 === a2;
    })) {
      isSourceBlocklisted = true;
      blocklistReason = `Account "${author}" is in blocklist`;
    }

    // 4. Keyword and Regex Tier Matches
    const tier1Keywords = settings.tier1Keywords || DEFAULT_SETTINGS.tier1Keywords;
    const tier2Keywords = settings.tier2Keywords || DEFAULT_SETTINGS.tier2Keywords;
    const tier3Keywords = settings.tier3Keywords || DEFAULT_SETTINGS.tier3Keywords;

    const tier1Matches = [];
    const tier2Matches = [];
    const tier3Matches = [];

    // Check Obfuscated GTA 6 Regexes
    if (matchesObfuscatedGTA6(fullSearchText)) {
      tier1Matches.push('gta6_regex_match');
    }

    // Check Tier 1 keywords
    for (const kw of tier1Keywords) {
      if (containsKeyword(fullSearchText, kw)) {
        if (!tier1Matches.includes(kw)) tier1Matches.push(kw);
      }
    }

    // Check Tier 3 keywords first (needed for contextual pairing with Vice City & Tier 2)
    for (const kw of tier3Keywords) {
      if (containsKeyword(fullSearchText, kw)) {
        if (!tier3Matches.includes(kw)) tier3Matches.push(kw);
      }
    }

    // Special Tier 1 rule: "Vice City" counts as Tier 1 when paired with GTA context
    const hasViceCity = containsKeyword(fullSearchText, 'vice city');
    const hasGTAContext = tier3Matches.length > 0 ||
      pageContext.isGTAContext ||
      isSourceBlocklisted ||
      (author && /gta|rockstar/i.test(author)) ||
      (subreddit && /gta|rockstar/i.test(subreddit));

    if (hasViceCity) {
      if (hasGTAContext) {
        if (!tier1Matches.includes('vice city (paired with GTA context)')) {
          tier1Matches.push('vice city (paired with GTA context)');
        }
      } else {
        // Without GTA context, treat Vice City as Tier 2 ambiguous
        tier2Matches.push('vice city');
      }
    }

    // Check Tier 2 keywords
    for (const kw of tier2Keywords) {
      if (kw === 'vice city') continue; // Handled above
      if (containsKeyword(fullSearchText, kw)) {
        if (!tier2Matches.includes(kw)) tier2Matches.push(kw);
      }
    }

    // Context Boosts
    let contextBoost = 0;
    const contextReasons = [];

    if (pageContext.isGTAContext) {
      contextBoost += 30;
      contextReasons.push('Page URL or Document Title is GTA-related');
    }

    // Alt text or URL has strong indicators
    const altOrUrlText = `${normalizeText(altText)} ${normalizeText(hrefs)} ${normalizeText(thumbnail)}`;
    if (matchesObfuscatedGTA6(altOrUrlText)) {
      contextBoost += 40;
      contextReasons.push('Thumbnail URL or Alt-text contains Tier 1 term');
    }

    // Gaming source context
    if (author && /gaming|leaks|rockstar|gta/i.test(author)) {
      contextBoost += 25;
      contextReasons.push(`Gaming source: ${author}`);
    }
    if (subreddit && /gaming|leaks|rockstar|gta/i.test(subreddit)) {
      contextBoost += 25;
      contextReasons.push(`Gaming subreddit: ${subreddit}`);
    }

    // Calculate Numerical Score
    // Tier 1: 100 pts each
    // Tier 2: 25 pts each
    // Tier 3: 10 pts each
    let score = (tier1Matches.length * 100) +
                (tier2Matches.length * 25) +
                (tier3Matches.length * 10) +
                contextBoost;

    if (isSourceBlocklisted) {
      score += 150;
    }

    // 5. Check PC News Bypass Mode
    // Only applies if there is a Tier 1 match or high score
    if ((tier1Matches.length > 0 || score >= 50) && settings.pcNewsMode) {
      const pcCheck = checkPCNewsBypass(fullSearchText, settings);
      if (pcCheck.isMatch) {
        return {
          shouldHide: false,
          isPCNews: true,
          score,
          decision: 'PC_NEWS_BYPASS',
          level: settings.level,
          reasons: [pcCheck.reason],
          details: {
            title: title || normTitle,
            tier1Matches,
            tier2Matches,
            tier3Matches,
            pcPattern: pcCheck.patternId
          }
        };
      }
    }

    // 6. Make Filter Decision based on Level
    const level = settings.level || 'strict';
    let shouldHide = false;
    const reasons = [];

    if (isSourceBlocklisted) {
      reasons.push(blocklistReason);
      if (level === 'strict' || level === 'balanced') {
        shouldHide = true;
      }
    }

    if (level === 'strict') {
      // Strict:
      // Hide on any tier 1
      // OR any tier 2 + tier 3 combo
      // OR any tier 2 + context boost
      // OR any source on blocklist
      // OR whole GTA/Rockstar channels, subreddits, hashtag pages
      if (tier1Matches.length > 0) {
        shouldHide = true;
        reasons.push(`Tier 1 matches: [${tier1Matches.join(', ')}]`);
      } else if (tier2Matches.length > 0 && (tier3Matches.length > 0 || contextBoost > 0 || hasGTAContext)) {
        shouldHide = true;
        reasons.push(`Tier 2 ambiguous terms [${tier2Matches.join(', ')}] with GTA context [${tier3Matches.join(', ')}]`);
      } else if (isSourceBlocklisted) {
        shouldHide = true;
      } else if (signals.isChannelPage && hasGTAContext) {
        shouldHide = true;
        reasons.push('GTA/Rockstar dedicated channel page');
      } else if (signals.isSubredditPage && hasGTAContext) {
        shouldHide = true;
        reasons.push('GTA/Rockstar dedicated subreddit page');
      }
    } else if (level === 'balanced') {
      // Balanced:
      // Hide on tier 1, or tier 2 with GTA context
      if (tier1Matches.length > 0) {
        shouldHide = true;
        reasons.push(`Tier 1 matches: [${tier1Matches.join(', ')}]`);
      } else if (tier2Matches.length > 0 && (tier3Matches.length > 0 || pageContext.isGTAContext || hasGTAContext)) {
        shouldHide = true;
        reasons.push(`Tier 2 terms [${tier2Matches.join(', ')}] paired with GTA context`);
      }
    } else if (level === 'light') {
      // Light:
      // Hide on tier 1 only
      if (tier1Matches.length > 0) {
        shouldHide = true;
        reasons.push(`Tier 1 matches: [${tier1Matches.join(', ')}]`);
      }
    }

    const decision = shouldHide ? 'HIDE' : 'SHOW';

    if (settings.debugMode) {
      console.log(`[GTA Shield] [${decision}] Score: ${score} (Level: ${level})`, {
        reasons,
        tier1Matches,
        tier2Matches,
        tier3Matches,
        contextBoost,
        contextReasons,
        signals: { title, author, subreddit, flair, hashtags }
      });
    }

    return {
      shouldHide,
      isPCNews: false,
      score,
      decision,
      level,
      reasons,
      details: {
        tier1Matches,
        tier2Matches,
        tier3Matches,
        contextBoost,
        contextReasons,
        isSourceBlocklisted
      }
    };
  }

  /**
   * Helper to recursively walk all open Shadow DOMs starting from an element.
   */
  function walkShadowRoots(rootElement, callback) {
    if (!rootElement) return;

    callback(rootElement);

    if (rootElement.shadowRoot) {
      walkShadowRoots(rootElement.shadowRoot, callback);
    }

    const children = rootElement.children || [];
    for (let i = 0; i < children.length; i++) {
      walkShadowRoots(children[i], callback);
    }
  }

  return {
    normalizeText,
    leetDecode,
    collapseSpacedAcronyms,
    matchesObfuscatedGTA6,
    containsKeyword,
    checkPCNewsBypass,
    scoreCard,
    walkShadowRoots
  };
});
