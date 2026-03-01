/* ───────────────────────────────────────────
   background.js — Entry point (service worker)
   Imports modules and sets up the message router
   ─────────────────────────────────────────── */

import { getProviderConfig, getActiveModel } from "./background/providers.js";
import { ensureDefaults, getFullState, saveUsedReplyToMemory } from "./background/storage.js";
import {
  handleGenerateReplies,
  handleTestConnection,
  handleSaveSettings,
  handleSavePersona,
  handleSaveOnboarding,
  handleExportPersona,
  handleImportPersona,
  handleClearAllData,
  serializeError
} from "./background/handlers.js";

/* ── Lifecycle ── */

async function openOnboardingTab() {
  const url = chrome.runtime.getURL("onboarding/onboarding.html");
  await chrome.tabs.create({ url });
  return { opened: true };
}

async function openSettingsPopup() {
  try {
    await chrome.action.openPopup();
    return { opened: true, via: "popup" };
  } catch {
    await openOnboardingTab();
    return { opened: true, via: "onboarding" };
  }
}

chrome.runtime.onInstalled.addListener(async (details) => {
  await ensureDefaults();
  if (details.reason === "install") {
    await openOnboardingTab();
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureDefaults();
});

/* ── Message router ── */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      const action = message?.action;

      switch (action) {
        case "GET_STATE": {
          sendResponse({ ok: true, ...(await getFullState()) });
          break;
        }
        case "GET_CONTENT_PREFS": {
          const { settings } = await ensureDefaults();
          sendResponse({
            ok: true,
            prefs: {
              extensionEnabled: settings.extensionEnabled,
              showButtonOnAllTweets: settings.showButtonOnAllTweets,
              showCharacterCount: settings.showCharacterCount,
              provider: settings.provider,
              providerLabel: getProviderConfig(settings.provider).label,
              activeModel: getActiveModel(settings, settings.provider)
            }
          });
          break;
        }
        case "SAVE_SETTINGS": {
          sendResponse({ ok: true, ...(await handleSaveSettings(message.payload)) });
          break;
        }
        case "SAVE_PERSONA": {
          sendResponse({ ok: true, ...(await handleSavePersona(message.payload)) });
          break;
        }
        case "SAVE_ONBOARDING": {
          sendResponse({ ok: true, ...(await handleSaveOnboarding(message.payload)) });
          break;
        }
        case "TEST_CONNECTION": {
          sendResponse({ ok: true, ...(await handleTestConnection(message.payload || {})) });
          break;
        }
        case "GENERATE_REPLIES": {
          sendResponse({ ok: true, ...(await handleGenerateReplies(message.payload || {})) });
          break;
        }
        case "SAVE_USED_REPLY": {
          sendResponse({ ok: true, ...(await saveUsedReplyToMemory(message.payload || {})) });
          break;
        }
        case "EXPORT_PERSONA": {
          sendResponse({ ok: true, ...(await handleExportPersona()) });
          break;
        }
        case "IMPORT_PERSONA": {
          sendResponse({ ok: true, ...(await handleImportPersona(message.payload || {})) });
          break;
        }
        case "CLEAR_ALL_DATA": {
          sendResponse({ ok: true, ...(await handleClearAllData()) });
          break;
        }
        case "OPEN_ONBOARDING": {
          sendResponse({ ok: true, ...(await openOnboardingTab()) });
          break;
        }
        case "OPEN_SETTINGS_POPUP": {
          sendResponse({ ok: true, ...(await openSettingsPopup()) });
          break;
        }
        default: {
          sendResponse({ ok: false, error: { message: "Unknown action.", code: "unknown_action" } });
        }
      }
    } catch (error) {
      sendResponse({ ok: false, error: serializeError(error) });
    }
  })();

  return true;
});
