# 📜 Changelog

All notable changes to the **GTA Shield** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.0] - 2026-11-22

### Added
- **Vice City / GTA 6 Neon Theme:** Complete visual redesign across popup, options control center, icons, and placeholder shields:
  - Vice City sunset gradients (`#ff2a85` neon pink, `#ff7b00` sunset orange, `#7209b7` purple).
  - Glowing neon placeholders with "🌴 VI SHIELD 🛡️" branding and glowing borders.
  - PC News dispatch styling with neon teal (`#00f5d4`) styling.
  - Updated high-resolution extension icons with neon VI sunset styling.
- **Formal Versioning:** Added `CHANGELOG.md`, bumped version to `1.2.0` in `manifest.json` and `package.json`, and surfaced version badges in extension UI.

### Fixed
- **Mermaid Diagram Parse Error:** Fixed GitHub rich display parse error in `README.md` by properly formatting node identifiers and removing unquoted parentheses/HTML linebreaks in edge transitions.

---

## [1.1.0] - 2026-11-22

### Added
- **Modern YouTube DOM Selectors:** Added native support for `yt-lockup-view-model`, `.yt-lockup-metadata-view-model-wiz__title`, `a.yt-core-attributed-string`, and `ytd-rich-grid-media`.
- **Raw `allText` Engine Fallback:** Scoring engine now incorporates `cardElement.textContent` directly into the evaluation pool (`rawCombined`). Even if YouTube or other sites modify class names or IDs, the visible text is guaranteed to be scored.
- **Recursive `aria-label` Extraction:** Added subtree scanning for all child `[aria-label]` attributes (e.g. YouTube thumbnail links) which reliably contain full video titles.
- **Asynchronous Hydration Guards:** Added hydration checks to `content.js` to ensure unhydrated custom element shells are not prematurely marked clean, with mutation observers re-evaluating cards when child text nodes render.
- **Keyword Expansion:** Added `leaker`, `leakers`, and `leaking` to Tier 2 keywords.

---

## [1.0.0] - 2026-11-22

### Added
- **Initial Release:** Firefox Manifest V3 extension.
- **Core Scoring Engine (`src/engine.js`):** 3-tier weighted model with diacritics stripping, zero-width character removal, spacing/punctuation collapse, and leetspeak decoding.
- **Platform Adapters:** Dedicated modules for YouTube, Reddit (New & Old Reddit with Shadow DOM support), Instagram (Reels auto-skip, Explore, Stories), and Generic Web fallback.
- **Pre-Hide CSS:** Zero-flash CSS pre-hiding (`src/prehide.css`).
- **PC News Bypass:** Safe text-only passthrough for PC release/announcement headlines with all media stripped.
- **Popup & Options:** User control center for keyword tiers, blocklists/allowlists, protection levels (Strict, Balanced, Light), and a live score testing simulator.
- **Automated Test Suite:** 33 unit tests with Node.js runner and in-browser fixture (`test/test.html`).
