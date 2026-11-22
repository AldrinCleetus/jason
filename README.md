# 🛡️ GTA Shield - Firefox (Manifest V3) Extension

**GTA Shield** is a high-performance, fail-closed Firefox browser extension designed to protect gamers from Grand Theft Auto VI spoilers until the game officially launches on PC.

> **Fail-closed philosophy:** It is always better to hide a false positive than to see a spoiler.

---

## 🚀 Key Features

- **Multi-Platform Support:** Dedicated site adapters for **YouTube**, **Reddit** (supporting New Reddit Web Components/Shadow DOM and Old Reddit), **Instagram** (Feed, Explore, Reels auto-skip, and Stories), plus a **Generic Fallback** for gaming portals and news sites.
- **Pre-Hide Technology:** New cards start hidden via CSS (`visibility: hidden`) before scanning. Absolutely **zero flash of spoiler content** during page load or infinite scroll.
- **Multi-Signal Scoring Engine (`engine.js`):** Goes far beyond naive keyword checks by analyzing titles, descriptions, captions, hashtags, video thumbnails, image alt text, channel names, flairs, video chapters, link URLs, and comment trees.
- **Advanced Normalization:** Strips diacritics, strips zero-width spaces, collapses spacing/punctuation tricks (`g t a 6`, `g.t.a. 6`, `gta💀6`, `gta-vi`), and decodes leetspeak (`6t4 v1`, `gta v1`).
- **3 Filter Levels:**
  - **Strict (Default):** Hides on any Tier 1 match, any Tier 2 + Tier 3 combo, any blocklisted source, or dedicated GTA channels/subreddits. Click-to-reveal is permanently disabled.
  - **Balanced:** Hides on Tier 1 matches or Tier 2 terms paired with GTA context. Click-to-reveal is disabled.
  - **Light:** Hides on direct Tier 1 matches only. Click-to-reveal button is available.
- **PC News Bypass Mode:** When enabled, content matching strictly verified PC launch criteria (e.g. `(GTA 6) + (PC/Steam/Epic) + (Release/Date/Announce)`) is allowed through in a sanitized text-only card with thumbnails and media completely stripped.
- **Open Shadow DOM Handling:** Recursively traverses open shadow roots (e.g. `shreddit-post`, `shreddit-comment`) to detect and neutralize spoilers inside custom web components.
- **SPA Navigation Hooks:** Patches `history.pushState` / `history.replaceState` and listens for `yt-navigate-finish` and `popstate` to ensure smooth protection during client-side routing.
- **100% Local & Zero Dependencies:** Operates entirely within the browser sandbox with zero network requests and zero external telemetry.
- **Live Toolbar Badge:** Real-time badge counter displaying the number of spoilers blocked on the active tab.

---

## 📁 Architecture Overview

```
project_jason/
├── manifest.json             # Firefox Manifest V3 definition
├── icons/                    # Crisp extension icons (16px, 48px, 128px)
├── src/
│   ├── defaults.js           # Default settings, tiers, blocklists, & allowlists
│   ├── engine.js             # Core scoring, normalization, & PC-news detector
│   ├── background.js         # MV3 background script, tab badge coordinator
│   ├── content.js            # Content script coordinator (SPA, Shadow DOM, queue)
│   ├── prehide.css           # Instant CSS pre-hide rules & placeholder styles
│   └── adapters/
│       ├── youtube.js        # YouTube adapter (grid, shorts, comments, autocomplete)
│       ├── reddit.js         # Reddit adapter (shreddit, old.reddit, comment collapse)
│       ├── instagram.js      # Instagram adapter (feed, explore, reels auto-skip)
│       └── generic.js        # Heuristic card detector & page-level blocker
├── ui/
│   ├── popup.html / .js / .css    # Toolbar popup (master toggle, levels, stats)
│   └── options.html / .js / .css  # Full control center (keyword tiers, lists, live tester)
├── test/
│   ├── test_engine.js        # Standalone Node.js unit test suite
│   └── test.html             # Interactive in-browser test fixture
└── scripts/
    └── generate_icons.js     # Pure Node.js PNG icon generator
```

---

## 🛠️ Installation Instructions

### 1. Temporary Loading in Firefox (`about:debugging`)

1. Open Firefox.
2. In the URL bar, navigate to `about:debugging#/runtime/this-firefox`.
3. Click the **"Load Temporary Add-on…"** button.
4. Select the `manifest.json` file inside this repository directory.
5. The **GTA Shield** icon will appear on your Firefox toolbar.
6. Navigate to YouTube, Reddit, or Instagram to experience seamless spoiler blocking.

### 2. Unlisted Signing for Personal Long-Term Use

If you want the extension to remain permanently installed without reloading each time Firefox restarts:

1. Install `web-ext` CLI globally (optional, or use Mozilla's portal):
   ```bash
   npm install -g web-ext
   ```
2. Create a free account on [Mozilla Add-on Developer Hub](https://addons.mozilla.org/).
3. Obtain your API key and secret from **Tools → API Keys**.
4. Sign the extension as unlisted:
   ```bash
   web-ext sign --api-key="<YOUR_KEY>" --api-secret="<YOUR_SECRET>" --channel=unlisted
   ```
5. Mozilla will return a signed `.xpi` file.
6. In Firefox, open `about:addons`, click the gear icon (⚙️), and select **"Install Add-on From File…"**, then choose your signed `.xpi` file.

---

## 🧪 Testing & Verification

### Running Unit Tests (Node.js)

The scoring engine, normalization routines, leetspeak decoders, and bypass filters have a dedicated unit test suite with 30 assertions:

```bash
node test/test_engine.js
```

Expected output:
```
=== GTA Shield Engine Unit Tests ===
...
Total: 30 | Passed: 30 | Failed: 0
```

### Visual Browser Test Fixture

1. Open `test/test.html` directly in Firefox or any browser.
2. The fixture displays mock cards simulating:
   - YouTube video cards and YouTube comments
   - Obfuscated spellings (`g t a 6`, `gta💀6`, `6t4 v1`)
   - Reddit posts (`shreddit-post` and classic containers)
   - Instagram posts and Reels
   - PC News bypass headlines
   - Safe cards (e.g. "Lucia in indie broadway play", "Vice City 80s music")
3. Click **"Run Engine Scanner"** to witness live card neutralization, placeholder injection, and media stripping in action!

---

## ⚙️ Configuration & Customization

Click the **GTA Shield** toolbar icon to access quick controls:
- **Master Toggle:** Instantly enable or pause spoiler protection.
- **Protection Level:** Choose between **Strict** (fail-closed default), **Balanced**, or **Light**.
- **Current Site Toggle:** Disable protection for the current domain with one click.
- **PC News Mode:** Toggle headline pass-through for PC launch announcements.
- **Extra Paranoid Mode:** Automatically block any post from user-defined GTA accounts (useful for image/video-only posts with no text captions).

Click **Options & Keyword Tiers** to open the Control Center:
- **Editable Keyword Tiers:** Add/remove terms in Tier 1, Tier 2, and Tier 3.
- **Custom Blocklists:** Maintain channels, subreddits (`r/GTA6`), and accounts.
- **Live Score Tester:** Type any headline or card text to see calculated scores and engine decisions in real time before encountering them on the web.

---

## 📄 License

MIT License. Fail-closed spoiler protection for the PC master race.
