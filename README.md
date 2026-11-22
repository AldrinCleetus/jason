<div align="center">

# 🛡️ GTA Shield

**Fail-Closed Firefox (Manifest V3) Spoiler Protection Extension for Grand Theft Auto VI**

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-orange?style=flat-square&logo=firefox)](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Build_a_cross_browser_extension)
[![Firefox](https://img.shields.io/badge/Firefox-109%2B-blue?style=flat-square&logo=firefox-browser)](https://www.mozilla.org/firefox/)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-Zero-success?style=flat-square)](package.json)
[![100% Local](https://img.shields.io/badge/Privacy-100%25%20Local-brightgreen?style=flat-square)](src/engine.js)
[![Tests Passing](https://img.shields.io/badge/Unit%20Tests-33%2F33%20Passing-success?style=flat-square)](test/test_engine.js)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

<p align="center">
  <em>"Fail-closed matters more than precision: I'd rather hide a false positive than see a spoiler before PC launch."</em>
</p>

</div>

---

## 📖 Table of Contents

1. [Overview & Philosophy](#-overview--philosophy)
2. [Architecture & Workflow](#-architecture--workflow)
3. [Key Features](#-key-features)
4. [Supported Platforms & Site Adapters](#-supported-platforms--site-adapters)
5. [Scoring Engine & Normalization Matrix](#-scoring-engine--normalization-matrix)
6. [Filter Levels Comparison](#-filter-levels-comparison)
7. [PC News Mode Bypass](#-pc-news-mode-bypass)
8. [Anti-Flicker & Hydration Guards](#-anti-flicker--hydration-guards)
9. [Installation & Setup](#-installation--setup)
   - [Temporary Load (`about:debugging`)](#1-temporary-installation-in-firefox)
   - [Permanent Unlisted Signing (`web-ext`)](#2-permanent-unlisted-installation)
10. [Testing & Verification](#-testing--verification)
11. [Project Structure](#-project-structure)
12. [Configuration & Control Center](#-configuration--control-center)
13. [License](#-license)

---

## 🎯 Overview & Philosophy

The console launch of Grand Theft Auto VI represents a massive spoiler minefield for PC gamers waiting for the PC release. Social feeds, search recommendations, algorithmic grids, and comment sections routinely leak story beats, map locations, missions, character fates, and endings.

**GTA Shield** implements a strict **fail-closed** architecture:
- If an element contains ambiguous signals paired with GTA context, it is hidden.
- If an element is in an unhydrated or unverified state, it is pre-hidden until proven clean.
- All DOM evaluation occurs entirely client-side with zero telemetry and zero network calls.

---

## 🏗️ Architecture & Workflow

GTA Shield cleanly separates extraction, scoring, DOM interception, and user configuration into dedicated modules:

```mermaid
flowchart TD
    A["Web Page DOM / Shadow Root"] -->|MutationObserver & History API| B["src/content.js<br/>(Content Coordinator)"]
    B -->|Check Site Match| C{"Active Adapter"}
    C -->|YouTube| D["src/adapters/youtube.js"]
    C -->|Reddit| E["src/adapters/reddit.js"]
    C -->|Instagram| F["src/adapters/instagram.js"]
    C -->|Generic| G["src/adapters/generic.js"]

    D & E & F & G -->|Extract Signals<br/>(Title, AllText, AriaLabels, AltText, Source, Hrefs)| H["src/engine.js<br/>(Scoring Engine)"]
    H -->|Normalize Diacritics, Leetspeak, Spacing| I["Rule & Tier Evaluator"]
    I -->|Check PC News Bypass| J{"PC News Mode?"}
    J -->|Matches Pattern| K["Show Text-Only Card<br/>(Strip Media/Thumbnails)"]
    J -->|No Bypass| L{"Filter Level<br/>(Strict / Balanced / Light)"}
    L -->|Trigger Score Threshold| M["Block Card & Neutralize Content<br/>(Insert Shield Placeholder)"]
    L -->|Clean Content| N["Reveal Card<br/>(Mark data-gta-shield-scanned)"]
    M -->|Increment Tab Counter| O["src/background.js<br/>(Badge Coordinator)"]
    O -->|Update Badge Text & Color| P["Firefox Toolbar Icon Badge"]
```

---

## 🚀 Key Features

- **Zero-Flicker Pre-Hide (`prehide.css`):** Potential content cards start hidden (`visibility: hidden`) before scanning. Eliminates the split-second "spoiler flash" common in naive extension implementations.
- **Asynchronous Hydration Guards:** Prevents race conditions where custom elements (e.g. YouTube Polymer/Lit components) insert empty container shells before stamping text nodes. Empty cards are never prematurely marked clean.
- **Deep Open Shadow DOM Traversal:** Recursively traverses open shadow roots across modern web components (e.g. `shreddit-post`, custom video widgets).
- **SPA Client-Side Navigation Hooks:** Hooks into `history.pushState`, `history.replaceState`, `popstate`, `hashchange`, and YouTube's custom `yt-navigate-finish` event.
- **Multi-Signal Extraction:** Scans titles, descriptions, captions, hashtags, video chapters, link hrefs, channel names, flairs, comment bodies, thumbnail URLs, and image alt text.
- **Full Text (`allText`) & `aria-label` Fallbacks:** Resilient against site redesigns and obfuscated CSS classes by evaluating the raw `textContent` and accessibility labels.
- **Editable Tiers & Blocklists:** Full options UI allowing users to customize keyword tiers, subreddits, channels, and monitored accounts.

---

## 🌐 Supported Platforms & Site Adapters

| Platform | Scope & Selectors Covered | Specific Features |
| :--- | :--- | :--- |
| **YouTube** | Home grid (`ytd-rich-item-renderer`, `yt-lockup-view-model`), search results (`ytd-video-renderer`), sidebar (`ytd-compact-video-renderer`), Shorts (`ytd-reel-video-renderer`), comments, end screens | Auto-pauses/mutes background video in Shorts; strips GTA search autocomplete suggestions; blocks dedicated GTA channels. |
| **Reddit** | New Reddit (`shreddit-post`, `shreddit-comment`), Old Reddit (`.thing.link`, `.thing.comment`), sidebar trending modules, flairs | Collapses spoiler comments and their reply subtrees; hides posts from blocklisted subreddits (e.g. `r/GTA6`). |
| **Instagram** | Feed posts (`article`), Explore grid, Reels vertical player, Stories tray | When an active Reel contains GTA 6 content, mutes audio, hides player, and auto-dispatches `ArrowDown` to skip to the next Reel. |
| **Generic Web** | Heuristic card detection (`article`, `li`, `[role=article]`, repeated sibling card blocks) | Full-page blocker overlay if the page URL or `document.title` indicates a dedicated GTA 6 spoiler/wiki page. |

---

## ⚖️ Scoring Engine & Normalization Matrix

The scoring engine (`src/engine.js`) normalizes all input before matching:
1. **Unicode De-accenting:** Normalizes via `NFD` and removes diacritics (`Grànd Thèft Aùto` → `grand theft auto`).
2. **Zero-Width Cleaning:** Removes zero-width spaces (`\u200B`), soft hyphens (`\u00AD`), and control characters.
3. **Emoji & Separator Stripping:** Collapses emojis separating keywords (`gta💀6` → `gta 6`).
4. **Acronym Spacing Collapse:** Collapses spaced letters and punctuation (`g t a 6`, `g.t.a. 6`, `g_t_a_6`, `gta-vi` → `gta 6`, `gta vi`).
5. **Leetspeak Decoding:** Maps substitutions (`6t4` → `gta`, `v1` / `v!` → `vi`, `@` → `a`, `$` → `s`, `0` → `o`, `3` → `e`, `4` → `a`, `7` → `t`).
6. **Obfuscation Regexes:** High-speed regex checks matching `\b(?:g[\W_]*t[\W_]*a|grand[\W_]*theft[\W_]*auto)[\W_]*(?:6|vi|six)\b`.

### Weighted Tier Model

| Tier | Weight | Examples | Behavior |
| :--- | :---: | :--- | :--- |
| **Tier 1 (Strong)** | **100 pts** | `"gta 6"`, `"gta vi"`, `"gta6"`, `"grand theft auto 6"`, `"#gta6"`, `"#gtavi"`, `"#gta6leaks"`, `"leonida"` | **Instant hide alone** across all filter levels. |
| **Tier 1 (Contextual)** | **100 pts** | `"Vice City"` (when paired with GTA context) | Hides as Tier 1 if paired with GTA context; treated as Tier 2 if alone. |
| **Tier 2 (Ambiguous)** | **25 pts** | `"lucia"`, `"jason"`, `"rockstar"`, `"trailer 3"`, `"leak"`, `"leaker"`, `"map"`, `"mission"`, `"ending"`, `"story"`, `"take-two"` | Counts only when GTA context exists on the card or page. |
| **Tier 3 (Contextual)** | **10 pts** | `"gta"`, `"grand theft auto"`, `"open world"`, `"rockstar games"`, `"gta online"`, `"gta v"`, gaming source | Provides the contextual boost needed to elevate Tier 2 terms to a block. |

---

## 🎚️ Filter Levels Comparison

| Level | Tier 1 Matches | Tier 2 + Tier 3 Combos | Blocklisted Source | Click-to-Reveal Available |
| :---: | :---: | :---: | :---: | :---: |
| **Strict** *(Default)* | ⛔ Hides | ⛔ Hides | ⛔ Hides | ❌ Disabled *(Fail-closed)* |
| **Balanced** | ⛔ Hides | ⛔ Hides (with GTA context) | ⛔ Hides | ❌ Disabled |
| **Light** | ⛔ Hides | ✅ Shows | ✅ Shows | ✅ **Enabled** *(Click to reveal)* |

---

## 🎮 PC News Mode Bypass

PC gamers need to know when the PC port is announced without getting spoiled by story/mission leaks.

When **PC News Mode** is toggled ON:
- Content matching strict patterns:
  `Primary Term: (GTA 6 | GTA VI | Grand Theft Auto 6)` **+**
  `Platform: (PC | Steam | Epic | Windows)` **+**
  `Action: (Release | Launch | Announce | Date | Port | Confirmed | Specs)`
- **Safe Passthrough:** The headline is displayed in a safe cyan status box.
- **Media Stripping:** Thumbnails, preview images, and embedded video frames are completely stripped to ensure no visual spoilers leak through.

---

## ⚡ Anti-Flicker & Hydration Guards

Modern single-page applications (SPAs) like YouTube create DOM elements before their data arrives:

```
[DOM Insertion] ytd-rich-item-renderer added (empty shell)
     │
     ▼
[GTA Shield Pre-hide] CSS visibility: hidden applied immediately
     │
     ▼
[Hydration Guard] Content script inspects card: hasContent === false
     │
     ├── Do NOT mark clean!
     └── Schedule staggered retries (100ms, 200ms, 300ms...)
     │
     ▼
[YouTube Hydration] Title "GTA6 LEAKER GUILTY..." is injected by framework
     │
     ▼
[MutationObserver] Catches added child nodes -> Finds parent card via .closest()
     │
     ▼
[Scoring Evaluation] Match found: Tier 1 ("gta6") + Tier 2 ("leaker")
     │
     ▼
[Neutralization] Content removed -> Placeholder attached -> Stamped data-gta-shield-scanned="blocked"
```

---

## 📦 Installation & Setup

### 1. Temporary Installation in Firefox

1. Open Firefox and navigate to:
   ```
   about:debugging#/runtime/this-firefox
   ```
2. Click **"Load Temporary Add-on…"**.
3. Navigate to this directory and select [manifest.json](file:///D:/Alien/Programming/browser_extensions/project_jason/manifest.json).
4. The **GTA Shield** icon will appear on your toolbar.

### 2. Permanent Unlisted Installation

To keep the add-on permanently installed without reloading on every browser restart:

1. Install Mozilla's `web-ext` utility:
   ```bash
   npm install -g web-ext
   ```
2. Get API credentials from your [Mozilla Add-on Developer Hub](https://addons.mozilla.org/developers/) account (**Tools → API Keys**).
3. Sign the add-on:
   ```bash
   web-ext sign --api-key="<YOUR_AMO_KEY>" --api-secret="<YOUR_AMO_SECRET>" --channel=unlisted
   ```
4. Install the resulting `.xpi` file via Firefox **Add-ons Manager** (`about:addons`) → Gear icon ⚙️ → **"Install Add-on From File…"**.

---

## 🧪 Testing & Verification

### Automated Unit Tests (Node.js)

Run the standalone unit test suite:

```bash
npm test
```
*or directly:*
```bash
node test/test_engine.js
```

All 33 test assertions verify diacritics stripping, leetspeak decoding, punctuation collapse, regexes, Tier 1/2/3 combinations, Vice City rules, blocklists, allowlists, paranoid mode, PC news bypass, and `allText` / `aria-label` fallbacks:

```text
=== GTA Shield Engine Unit Tests ===
...
========================================
Total: 33 | Passed: 33 | Failed: 0
========================================
```

### Visual In-Browser Test Fixture

1. Open [test/test.html](file:///D:/Alien/Programming/browser_extensions/project_jason/test/test.html) directly in Firefox or any browser.
2. Contains mock cards for YouTube, YouTube Shorts, YouTube comments, Reddit posts, Instagram Reels, obfuscated spellings, PC news bypass, and safe cards.
3. Click **"Run Engine Scanner"** to witness live DOM card neutralization in real time.

---

## 📂 Project Structure

```
project_jason/
├── .gitignore                # Ignore node_modules, temp files, and web-ext artifacts
├── package.json              # Project metadata & npm test scripts
├── manifest.json             # Firefox Manifest V3 manifest
├── README.md                 # Full documentation
├── LICENSE                   # MIT License
├── icons/                    # Extension icons
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
├── src/                      # Extension Core
│   ├── defaults.js           # Default settings, tiers, and blocklists
│   ├── engine.js             # Normalization and scoring module
│   ├── background.js         # Service coordinator & badge counter handler
│   ├── content.js            # Content coordinator (MutationObserver, Shadow DOM)
│   ├── prehide.css           # Pre-hide rules & placeholder styles
│   └── adapters/             # Platform-specific adapters
│       ├── youtube.js        # YouTube adapter (grid, shorts, comments, lockups)
│       ├── reddit.js         # Reddit adapter (shreddit, old.reddit, comments)
│       ├── instagram.js      # Instagram adapter (feed, explore, reels auto-skip)
│       └── generic.js        # Generic fallback & full-page blocker
├── ui/                       # Extension Interface
│   ├── popup.html / .js / .css    # Toolbar popup interface
│   └── options.html / .js / .css  # Advanced control center & live tester
├── test/                     # Testing & QA
│   ├── test_engine.js        # 33 automated unit tests
│   └── test.html             # Interactive visual DOM test fixture
└── scripts/
    └── generate_icons.js     # Pure Node.js PNG icon generator
```

---

## ⚙️ Configuration & Control Center

### Quick Toolbar Popup
- **Master Switch:** Instantly enable or pause all protection.
- **Protection Level:** Choose Strict, Balanced, or Light.
- **Active Site Toggle:** Disable or enable protection for the active domain with one click.
- **PC News Toggle:** Enable or disable PC release bypass.
- **Extra Paranoid Mode:** Automatically block accounts known for posting GTA content even if the post lacks caption text.
- **Live Counter:** Shows items hidden on the current page and lifetime stats.

### Options Page & Live Tester
- **Keyword Tier Editor:** Add or remove terms in Tier 1, Tier 2, and Tier 3 with interactive tag pills.
- **Blocklists / Allowlists:** Manage channels, subreddits, and accounts.
- **Live Score Tester:** Type any headline or caption and preview the engine's score, matched tiers, and decision in real-time.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
