# ReplyOS — Chrome Extension

AI-powered Twitter/X reply generator that writes in **your voice**. Supports **Groq**, **NVIDIA NIM**, and **Google Gemini** as LLM providers.

## Architecture

```
TweetBot/
├── background.js              ← Service worker entry (ES module)
├── background/
│   ├── providers.js            ← Provider configs, constants, defaults
│   ├── storage.js              ← Chrome storage: sanitizers, CRUD
│   ├── prompts.js              ← System/user prompts, reply parsing
│   ├── api.js                  ← API calls (Groq/NVIDIA/Gemini)
│   └── handlers.js             ← Message action handlers
├── content.js                  ← Content script orchestrator
├── content/
│   ├── state.js                ← Shared state & utilities
│   ├── scraper.js              ← Tweet text/author/thread extraction
│   └── ui.js                   ← Modal, rendering, keyboard nav
├── content.css                 ← Injected styles for Twitter overlay
├── popup/
│   ├── popup.html              ← Extension popup UI
│   ├── popup.js                ← Popup logic
│   └── popup.css               ← Popup styles
├── onboarding/                 ← First-run onboarding flow
├── icons/                      ← Extension icons
└── manifest.json               ← MV3 manifest
```

## Providers

| Provider       | Endpoint Format              | Auth Style          | Free Tier |
|----------------|------------------------------|---------------------|-----------|
| Groq           | OpenAI-compatible            | Bearer token        | ✅ Yes     |
| NVIDIA NIM     | OpenAI-compatible            | Bearer token        | ✅ Yes     |
| Google Gemini  | `generativelanguage.googleapis.com` | `x-goog-api-key` header | ✅ Yes     |

## How It Works

1. Content script injects "✦ AI Reply" buttons on every tweet
2. User clicks → modal opens → background generates 4 replies (Contrarian, Insightful, Relatable, Funny)
3. System prompt uses user's voice profile (tone, examples, past replies) to match their style
4. User picks a reply → injected directly into Twitter's compose box

## Reply Strategies

- **Contrarian** — Push back or offer a different angle
- **Insightful** — Add depth the original tweet missed
- **Relatable** — Share a real-feeling experience
- **Funny** — Genuinely clever humor (no clichés)

## Development

1. Clone this repo
2. Open `chrome://extensions` → Enable Developer Mode
3. Click "Load unpacked" → Select the `TweetBot` folder
4. Get an API key from [Groq](https://console.groq.com), [NVIDIA](https://build.nvidia.com), or [Google AI Studio](https://aistudio.google.com/apikey)
5. Open the extension popup → paste your key → test connection

## Key Design Decisions

- **No bundler** — Pure JS, no build step. MV3 service worker uses ES modules natively.
- **Content scripts loaded sequentially** — `state.js` → `scraper.js` → `ui.js` → `content.js` via manifest.json `content_scripts` array.
- **API keys stored locally** — Never transmitted anywhere except the selected provider's API endpoint.
- **SOLID file structure** — Each module has a single responsibility. Easy to navigate and extend.
