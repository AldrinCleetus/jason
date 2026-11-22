/**
 * GTA Shield - Unit Test Suite for engine.js
 * Run with: node test/test_engine.js
 */
const engine = require('../src/engine');
const defaults = require('../src/defaults');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

function runTests() {
  console.log('=== GTA Shield Engine Unit Tests ===\n');

  // 1. Normalization & Obfuscation Handling
  console.log('--- 1. Normalization & Obfuscation ---');

  const norm1 = engine.normalizeText('Grànd Thèft Aùto 6');
  assert(norm1.includes('grand theft auto 6'), 'Strips diacritics: Grànd Thèft Aùto 6');

  const norm2 = engine.normalizeText('gta\u200B6\uFEFF');
  assert(!norm2.includes('\u200B') && !norm2.includes('\uFEFF'), 'Removes zero-width characters');

  const normEmoji = engine.normalizeText('gta💀6');
  assert(normEmoji.replace(/\s+/g, '') === 'gta6', 'Collapses emoji splitting keyword: gta💀6');

  const collapsedSpaced = engine.collapseSpacedAcronyms('g t a 6');
  assert(collapsedSpaced.includes('gta 6'), 'Collapses spaced letters: "g t a 6" -> "gta 6"');

  const collapsedDots = engine.collapseSpacedAcronyms('g.t.a. 6');
  assert(collapsedDots.includes('gta 6'), 'Collapses dotted letters: "g.t.a. 6" -> "gta 6"');

  const collapsedDashes = engine.collapseSpacedAcronyms('gta-vi');
  assert(collapsedDashes.includes('gta vi'), 'Collapses hyphenated: "gta-vi" -> "gta vi"');

  const leetDecoded = engine.leetDecode('6t4 v1');
  assert(leetDecoded.includes('gta vi'), 'Decodes leetspeak: "6t4 v1" -> "gta vi"');

  assert(engine.matchesObfuscatedGTA6('g t a 6'), 'Regex catches "g t a 6"');
  assert(engine.matchesObfuscatedGTA6('GTA-VI'), 'Regex catches "GTA-VI"');
  assert(engine.matchesObfuscatedGTA6('gta💀6'), 'Regex catches "gta💀6"');
  assert(engine.matchesObfuscatedGTA6('#gta6leaks'), 'Regex catches hashtag "#gta6leaks"');
  assert(engine.matchesObfuscatedGTA6('#gtavi'), 'Regex catches hashtag "#gtavi"');
  assert(engine.matchesObfuscatedGTA6('leonida'), 'Regex catches "leonida"');

  // 2. Tier 1 Strong Matches (Instant Hide across levels)
  console.log('\n--- 2. Tier 1 Matches ---');

  const t1Strict = engine.scoreCard({ title: 'GTA 6 Gameplay Leaks Trailer' }, { level: 'strict' });
  assert(t1Strict.shouldHide === true && t1Strict.decision === 'HIDE', 'Tier 1 hides in Strict level');

  const t1Balanced = engine.scoreCard({ title: 'Grand Theft Auto VI Official Trailer' }, { level: 'balanced' });
  assert(t1Balanced.shouldHide === true && t1Balanced.decision === 'HIDE', 'Tier 1 hides in Balanced level');

  const t1Light = engine.scoreCard({ title: 'New GTA 6 Map Revealed' }, { level: 'light' });
  assert(t1Light.shouldHide === true && t1Light.decision === 'HIDE', 'Tier 1 hides in Light level');

  const t1Leonida = engine.scoreCard({ title: 'Exploring the new Leonida state' }, { level: 'strict' });
  assert(t1Leonida.shouldHide === true, 'Leonida triggers Tier 1 hide');

  // 3. Vice City Contextual Pairing
  console.log('\n--- 3. Vice City Contextual Rule ---');

  // Vice City alone without GTA context: should NOT trigger Tier 1 hide
  const vcAlone = engine.scoreCard({ title: 'Vice City nightlife documentary' }, { level: 'light' });
  assert(vcAlone.shouldHide === false, 'Vice City alone without GTA context does NOT hide in Light');

  // Vice City with GTA context (Tier 3 or GTA term): triggers Tier 1 hide
  const vcWithGTA = engine.scoreCard({ title: 'Vice City returning in the new GTA' }, { level: 'strict' });
  assert(vcWithGTA.shouldHide === true, 'Vice City paired with GTA context triggers hide in Strict');

  // 4. Tier 2 (Ambiguous) + Tier 3 (GTA Context) Combos
  console.log('\n--- 4. Tier 2 + Tier 3 Combos ---');

  // "Lucia" alone without GTA context
  const luciaAlone = engine.scoreCard({ title: 'Lucia talks about acting career' }, { level: 'balanced' });
  assert(luciaAlone.shouldHide === false, 'Lucia alone without GTA context is NOT hidden in Balanced');

  // "Lucia" + "Jason" with "GTA" or "Rockstar Games"
  const luciaWithGTA = engine.scoreCard({
    title: 'Lucia and Jason mission leaked details',
    description: 'Rockstar Games open world project'
  }, { level: 'balanced' });
  assert(luciaWithGTA.shouldHide === true, 'Lucia + Jason + Rockstar Games triggers hide in Balanced');

  // Light level ignores Tier 2 + Tier 3 combo (only Tier 1 in Light)
  const luciaLight = engine.scoreCard({
    title: 'Lucia and Jason mission leaked details',
    description: 'Rockstar Games open world project'
  }, { level: 'light' });
  assert(luciaLight.shouldHide === false, 'Tier 2 + Tier 3 combo is NOT hidden in Light mode');

  // 5. PC News Bypass Mode
  console.log('\n--- 5. PC News Bypass Mode ---');

  const pcNewsValid = engine.scoreCard({
    title: 'GTA 6 PC release date announced on Steam and Epic Games'
  }, { pcNewsMode: true, level: 'strict' });
  assert(pcNewsValid.decision === 'PC_NEWS_BYPASS' && pcNewsValid.isPCNews === true && pcNewsValid.shouldHide === false,
    'Valid PC release news triggers PC_NEWS_BYPASS');

  // Non-PC GTA 6 spoiler should still be hidden even when pcNewsMode is active
  const gtaSpoiler = engine.scoreCard({
    title: 'GTA 6 ending and full mission list leaked online'
  }, { pcNewsMode: true, level: 'strict' });
  assert(gtaSpoiler.shouldHide === true && gtaSpoiler.decision === 'HIDE',
    'GTA 6 spoiler is still HIDDEN when PC news mode is active');

  // When PC news mode is disabled, PC news should be hidden like normal
  const pcNewsDisabled = engine.scoreCard({
    title: 'GTA 6 PC release date confirmed'
  }, { pcNewsMode: false, level: 'strict' });
  assert(pcNewsDisabled.shouldHide === true && pcNewsDisabled.decision === 'HIDE',
    'PC news is HIDDEN when pcNewsMode is false');

  // 6. Blocklists & Allowlists
  console.log('\n--- 6. Blocklists & Allowlists ---');

  const blocklistSubreddit = engine.scoreCard({
    title: 'Check out this cool fan art',
    subreddit: 'r/GTA6'
  }, {
    level: 'strict',
    blocklists: { subreddits: ['r/GTA6'], channels: [], accounts: [] }
  });
  assert(blocklistSubreddit.shouldHide === true, 'Blocklisted subreddit r/GTA6 hides post in Strict');

  const allowlistChannel = engine.scoreCard({
    title: 'GTA 6 tech analysis and breakdown',
    author: 'Digital Foundry'
  }, {
    allowlists: { channels: ['Digital Foundry'], subreddits: [], accounts: [] }
  });
  assert(allowlistChannel.shouldHide === false && allowlistChannel.decision === 'SHOW',
    'Allowlisted channel is SHOWN even with Tier 1 keywords');

  // 7. Extra Paranoid Mode
  console.log('\n--- 7. Extra Paranoid Mode ---');

  const paranoidPost = engine.scoreCard({
    title: 'Random non-descript photo',
    author: 'some_monitored_user'
  }, {
    paranoidMode: true,
    paranoidAccounts: ['some_monitored_user'],
    blocklists: { accounts: [], channels: [], subreddits: [] }
  });
  assert(paranoidPost.shouldHide === true, 'Extra paranoid mode hides any post by monitored account');

  const notParanoid = engine.scoreCard({
    title: 'Random non-descript photo',
    author: 'some_monitored_user'
  }, {
    paranoidMode: false,
    paranoidAccounts: ['some_monitored_user'],
    blocklists: { accounts: [], channels: [], subreddits: [] }
  });
  assert(notParanoid.shouldHide === false, 'Without paranoid mode, non-GTA post by unblocked account is shown');

  // 8. Extraction of Multi-Signal Data
  console.log('\n--- 8. Multi-Signal Extraction & Scoring ---');

  const multiSignal = engine.scoreCard({
    title: 'Exciting news today',
    altText: 'GTA VI banner trailer screenshot',
    thumbnail: 'https://img.youtube.com/vi/123/gtavi_leak.jpg',
    author: 'GamingLeaksAndRumours'
  }, { level: 'strict' });
  assert(multiSignal.shouldHide === true, 'Catches GTA 6 hidden in altText, thumbnail filename, and source');

  // 9. Exact User Case Verification & allText / aria-label Fallbacks
  console.log('\n--- 9. User Video Case & Robust Fallbacks ---');

  const userVideoDirect = engine.scoreCard({
    title: 'GTA6 LEAKER GUILTY, UBISOFT IN BIG TROUBLE? & MORE',
    author: 'gameranx'
  }, { level: 'strict' });
  assert(userVideoDirect.shouldHide === true, 'Catches exact user video title directly');

  const userVideoAllTextOnly = engine.scoreCard({
    allText: 'GTA6 LEAKER GUILTY, UBISOFT IN BIG TROUBLE? & MORE\ngameranx\n456K views\n1 day ago',
    author: 'gameranx'
  }, { level: 'strict' });
  assert(userVideoAllTextOnly.shouldHide === true, 'Catches video when title selector fails and only allText is present');

  const userVideoAriaLabelOnly = engine.scoreCard({
    ariaLabels: 'GTA6 LEAKER GUILTY, UBISOFT IN BIG TROUBLE? & MORE by gameranx 1 day ago 14 minutes, 24 seconds',
    author: 'gameranx'
  }, { level: 'strict' });
  assert(userVideoAriaLabelOnly.shouldHide === true, 'Catches video when only aria-label is extracted from thumbnail link');

  console.log(`\n========================================`);
  console.log(`Total: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`);
  console.log(`========================================\n`);

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests();
