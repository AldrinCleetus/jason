/**
 * GTA Shield - Visual Test Fixture Runner (test.js)
 */
(function () {
  'use strict';

  const banner = document.getElementById('results-banner');
  const runBtn = document.getElementById('btn-run-all');
  const settings = window.GTAShieldDefaults.DEFAULT_SETTINGS;

  function evaluateFixture() {
    let blockedCount = 0;
    let pcNewsCount = 0;
    let cleanCount = 0;
    const logs = [];

    const cards = document.querySelectorAll('.fixture-card');

    cards.forEach((card, index) => {
      let adapter = window.GTAShieldGenericAdapter;
      if (card.matches('ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-comment-thread-renderer')) {
        adapter = window.GTAShieldYouTubeAdapter;
      } else if (card.matches('shreddit-post, article[data-testid="post-container"]')) {
        adapter = window.GTAShieldRedditAdapter;
      } else if (card.querySelector('.badge-ig')) {
        adapter = window.GTAShieldInstagramAdapter;
      }

      const signals = adapter.extractSignals(card);
      const decision = window.GTAShieldEngine.scoreCard(signals, settings);

      if (decision.shouldHide) {
        adapter.hideCard(card, decision, settings);
        blockedCount++;
        logs.push(`Card ${index + 1} (${adapter.name}): [BLOCKED] Score: ${decision.score} - Reasons: ${decision.reasons.join(', ')}`);
      } else if (decision.isPCNews) {
        adapter.showPCNews(card, decision, settings);
        pcNewsCount++;
        logs.push(`Card ${index + 1} (${adapter.name}): [PC NEWS BYPASS] ${decision.reasons.join(', ')}`);
      } else {
        adapter.revealCard(card);
        cleanCount++;
        logs.push(`Card ${index + 1} (${adapter.name}): [CLEAN - SHOWN] No spoiler match`);
      }
    });

    banner.textContent = `=== SCANNED ${cards.length} CARDS ===\n` +
      `• Blocked Spoilers: ${blockedCount}\n` +
      `• PC News Bypassed (Media Stripped): ${pcNewsCount}\n` +
      `• Clean & Shown: ${cleanCount}\n\n` +
      logs.join('\n');
  }

  if (runBtn) {
    runBtn.addEventListener('click', evaluateFixture);
  }
})();
