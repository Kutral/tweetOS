<div align="center">
  <img src="icons/icon128.png" alt="ReplyOS Logo" width="128" />
  <h1>ReplyOS</h1>
  <p><strong>Your personal AI ghostwriter, injected directly into X (Twitter).</strong></p>
  
  <p>
    <img src="https://img.shields.io/badge/Manifest-V3-30D158?style=flat-square&logo=googlechrome&logoColor=white" alt="Manifest V3" />
    <img src="https://img.shields.io/badge/Vanilla-JS-F7DF1E?style=flat-square&logo=javascript&logoColor=black" alt="Vanilla JS" />
    <img src="https://img.shields.io/badge/License-MIT-0A84FF?style=flat-square" alt="License MIT" />
  </p>
</div>

---

## ✦ What is ReplyOS?

Tired of using AI tools that make you sound like a robot? **ReplyOS** takes a different approach. It lives right inside your X (formerly Twitter) feed, and when you want to respond to a tweet, it generates four distinct drafts — written strictly in **your exact tone of voice**.

No more `"Great point!"`, no more `"This resonates!"`, and absolutely zero jokes about needing coffee. Just sharp, human-like replies powered by top-tier LLMs running locally through standard APIs.

## ✨ Premium Apple-Inspired Aesthetics

ReplyOS isn't just powerful; it’s beautiful. Built with an ultra-premium, **Apple-inspired design language**:
- **Stunning Glassmorphism:** Deep 32px blurs (`backdrop-filter`) over beautifully saturated dark mesh gradients. 
- **Liquid Smooth Micro-Animations:** Custom bezier curves and spring-like transitions make every interaction feel snappy and satisfying.
- **Squircles & Soft Shadows:** Perfectly dialed-in border-radiuses and diffuse box shadows give every UI element depth and physical presence on the screen.
- **Flawless Typography:** Driven by the `Inter` font family with tight tracking and semantic font weights, rendering beautifully against translucent backgrounds.

## 🧠 Supported AI Brains

Bring your own API key to unlock lightning-fast, uncensored generation. We've optimized ReplyOS for the fastest inference providers available:

- **🟢 Groq** (Llama 3, Mixtral) — *The speed demon.*
- **🟢 NVIDIA NIM** (Llama 3) — *Enterprise-grade reliability.*
- **🟢 Google Gemini** (Gemini 3 Flash, Gemini 1.5 Pro) — *Deep reasoning.*

*(All providers offer highly generous free-tier options, meaning ReplyOS is completely free to run).*

---

## 🎨 The 4 "Voices" of ReplyOS

Every time you hit the **✦ AI Reply** button beneath a tweet, ReplyOS analyzes the full context of the thread and generates four strategic angles:

1. **🔥 Contrarian** — Politely pushes back, offering a blind spot or fresh perspective.
2. **💡 Insightful** — Adds value. Connects the dots to broader frameworks or patterns.
3. **🤝 Relatable** — "Same here" energy, but powered by hyper-specific, human-feeling examples.
4. **😂 Funny** — Deadpan, observational, or self-deprecating. Think stand-up comedy, not greeting cards.

---

## 🛠 SOLID Architecture

ReplyOS is built using Vanilla JavaScript and Chrome Extensions Manifest V3. The codebase was meticulously refactored using **SOLID design principles**, making it incredibly easy to extend and maintain without touching a bundler:

```text
TweetBot/
├── background/                 🧠 The Brain (Service Worker)
│   ├── providers.js            ← Configurations & constants
│   ├── storage.js              ← Chrome.storage sanitization & CRUD
│   ├── prompts.js              ← System guardrails & complex response parsing
│   ├── api.js                  ← Unified Fetch API (Groq/Nvidia/Gemini)
│   └── handlers.js             ← Message action orchestration
│
├── content/                    🖥️ The Injector (Content Scripts loaded sequentially)
│   ├── state.js                ← Shared global state 
│   ├── scraper.js              ← Reads Tweet text, Authors, and FULL ancestor thread flow
│   └── ui.js                   ← Glassmorphic Modal rendering & keyboard nav
│
├── popup/                      🎛️ The Dashboard (HTML + popup.js + premium CSS)
├── onboarding/                 🚀 First-Time setup flow
└── manifest.json               ⚡ MV3 Configs
```

### 💡 Key Technical Decisions
1. **No Bundlers Required**: `background.js` leverages native ES Module imports (`"type": "module"` in manifest).
2. **Sequential Content Scripts**: `content.js` features are split into multiple files loaded via the `content_scripts` array sequentially, allowing clean code separation without a bundler.
3. **Deep Thread Context**: The visual scraper doesn't just read the tweet you clicked on; it climbs the DOM tree to capture up to 10 parent tweets, feeding the LLM the exact conversation history.
4. **Data Privacy First**: API keys and personas are stored entirely offline in `chrome.storage.local`.

---

## 🚀 Installation & Setup

Want to run it right now? It takes 60 seconds:

1. Clone or download this repository to your local machine:
   ```bash
   git clone https://github.com/yourusername/TweetBot.git
   ```
2. Open Google Chrome (or any Chromium browser like Brave, Edge, Arc).
3. Navigate to `chrome://extensions`.
4. Toggle **"Developer mode"** ON in the top right corner.
5. Click **"Load unpacked"** and select the folder you just downloaded.
6. The gorgeous **Onboarding flow** will open automatically. Follow the steps, insert your API key, and define your persona!

---

## ⌨️ Pro-Tips / Keyboard Navigation

We built ReplyOS for power users. When the generation modal opens:
- Press `1`, `2`, `3`, or `4` to instantly select a reply strategy.
- Press `Enter` to auto-inject the reply directly into the X compose box.
- Press `Escape` to close and vanish. 

---

<div align="center">
  <i>"Ghostwriting, perfected."</i><br><br>
  Built with ❤️ for power-tweeters.
</div>
