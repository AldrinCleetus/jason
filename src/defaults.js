/**
 * GTA Shield - Default Configuration & Settings
 * Shared defaults across content scripts, background, popup, and options page.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GTAShieldDefaults = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DEFAULT_SETTINGS = {
    enabled: true,
    level: 'strict', // 'strict' (fail-closed default) | 'balanced' | 'light'
    sites: {
      'youtube.com': true,
      'reddit.com': true,
      'instagram.com': true,
      'generic': true
    },
    pcNewsMode: true,
    paranoidMode: false,
    paranoidAccounts: [
      'rockstargames',
      'rockstarintel',
      'gta6news',
      'gta6count',
      'gta6_countdown',
      'gta_series_videos',
      'dexerto',
      'ign',
      'gamerant',
      'mrbossftw'
    ],
    debugMode: false,

    // Tier 1 keywords (Strong - hide alone)
    tier1Keywords: [
      'gta 6',
      'gta vi',
      'gta6',
      'gtavi',
      'grand theft auto 6',
      'grand theft auto vi',
      'grand theft auto six',
      '#gta6',
      '#gtavi',
      '#gta6trailer',
      '#gta6leaks',
      '#gta6gameplay',
      'leonida'
    ],

    // Tier 2 keywords (Ambiguous - count when GTA context exists in same card/page)
    tier2Keywords: [
      'lucia',
      'jason',
      'rockstar',
      'trailer 3',
      'trailer 2',
      'trailer 1',
      'leak',
      'leaks',
      'leaker',
      'leakers',
      'leaked',
      'leaking',
      'map',
      'mission',
      'missions',
      'ending',
      'story',
      'protagonist',
      'take-two',
      'take two',
      'gameplay',
      'cutscene',
      'cutscenes',
      'spoilers',
      'spoiler',
      'release date',
      'delay',
      'delayed',
      'vice city'
    ],

    // Tier 3 keywords (Weak - contextual boost)
    tier3Keywords: [
      'gta',
      'grand theft auto',
      'open world',
      'rockstar games',
      'rockstargames',
      'ps5',
      'xbox series',
      'gta online',
      'gta v',
      'gta 5',
      'gaming leaks'
    ],

    // PC News Bypass Patterns:
    // (gta 6 | gta vi) + (pc | steam | epic) + (release | launch | announce | date | port | confirmed)
    pcNewsPatterns: [
      {
        id: 'pc_release_announcement',
        name: 'GTA 6 PC Release / Launch Announcement',
        primary: [
          'gta 6',
          'gta vi',
          'gta6',
          'gtavi',
          'grand theft auto 6',
          'grand theft auto vi',
          'grand theft auto six'
        ],
        platform: [
          'pc',
          'steam',
          'epic',
          'epic games',
          'windows'
        ],
        action: [
          'release',
          'launch',
          'announce',
          'announcement',
          'date',
          'port',
          'confirmed',
          'window',
          'specs',
          'system requirements',
          'preload'
        ]
      }
    ],

    // Blocklists per platform
    blocklists: {
      channels: [
        'GTA Series Videos',
        'Rockstar Games',
        'TGG',
        'MrBossFTW',
        'LegacyKillaHD',
        'Badger Goodger',
        'ZackCoxTV',
        'Vadim M',
        'INTER',
        'ENXGMA'
      ],
      subreddits: [
        'r/GTA6',
        'r/GTA_VI',
        'r/GTA6Unmoderated',
        'r/GamingLeaksAndRumours',
        'r/GTA',
        'r/rockstar',
        'r/GTAV'
      ],
      accounts: [
        'rockstargames',
        'rockstarintel',
        'gta6news',
        'gta6count',
        'gta6_countdown',
        'gta6.news',
        'gta_vi_leaks'
      ]
    },

    // Allowlists per platform
    allowlists: {
      channels: [],
      subreddits: [],
      accounts: [],
      domains: []
    },

    // Statistics
    stats: {
      totalHidden: 0,
      pcNewsBypassed: 0
    }
  };

  return {
    DEFAULT_SETTINGS: JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
  };
});
