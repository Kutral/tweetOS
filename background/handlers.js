/* ───────────────────────────────────────────
   background/handlers.js
   Message action handlers
   ─────────────────────────────────────────── */

import {
    getProviderConfig, getActiveKey, getActiveModel,
    sanitizeString, clone,
    DEFAULT_PERSONA, DEFAULT_SETTINGS, DEFAULT_COUNTERS, DEFAULT_ONBOARDING
} from "./providers.js";

import {
    ensureDefaults, getFullState, buildProviderMetadata,
    sanitizeSettings, sanitizePersona, sanitizeOnboarding,
    incrementGeneratedCounter, saveUsedReplyToMemory
} from "./storage.js";

import {
    buildSystemPrompt, buildUserPrompt,
    parseRepliesFromContent, ensureExactlyFourReplies, extractContent
} from "./prompts.js";

import { callProvider } from "./api.js";

/* ── Generate replies ── */

export async function handleGenerateReplies(data) {
    const { persona, settings } = await ensureDefaults();
    const providerId = settings.provider;
    const provider = getProviderConfig(providerId);
    const apiKey = getActiveKey(settings, providerId);
    const model = getActiveModel(settings, providerId);

    if (!apiKey) {
        const error = new Error("No API key configured.");
        error.code = "no_api_key";
        throw error;
    }

    const tweetText = sanitizeString(data.tweetText || "", 4000);
    if (!tweetText) {
        const error = new Error("Couldn't read this tweet. Try another.");
        error.code = "tweet_parse_error";
        throw error;
    }

    const threadContext = sanitizeString(data.threadContext || "", 6000);
    const tweetAuthor = sanitizeString(data.tweetAuthor || "", 120).replace(/^@+/, "");

    const messages = [
        {
            role: "system",
            content: buildSystemPrompt(persona)
        },
        {
            role: "user",
            content: buildUserPrompt({ tweetText, tweetAuthor, threadContext })
        }
    ];

    const response = await callProvider({
        providerId,
        apiKey,
        model,
        messages,
        temperature: 0.78,
        maxTokens: 1200
    });

    const content = extractContent(response);

    let replies = parseRepliesFromContent(content);
    replies = ensureExactlyFourReplies(replies, {
        tweetText,
        tweetAuthor,
        threadContext
    });

    await incrementGeneratedCounter();

    return {
        replies,
        provider: providerId,
        providerLabel: provider.label,
        model
    };
}

/* ── Test connection ── */

export async function handleTestConnection(data) {
    const state = await ensureDefaults();
    const providerId = ["nvidia", "google"].includes(data.provider) ? data.provider : "groq";
    const settings = state.settings;
    const provider = getProviderConfig(providerId);

    const incomingKey = sanitizeString(data.apiKey || "", 400);
    const apiKey = incomingKey || getActiveKey(settings, providerId);
    const model = getActiveModel(settings, providerId, sanitizeString(data.model || "", 120));

    if (!apiKey) {
        const error = new Error("API key is required.");
        error.code = "no_api_key";
        throw error;
    }

    await callProvider({
        providerId,
        apiKey,
        model,
        messages: [{ role: "user", content: "test connection now" }],
        temperature: 0,
        maxTokens: 12
    });

    return {
        provider: providerId,
        providerLabel: provider.label,
        model,
        success: true
    };
}

/* ── Settings & persona CRUD ── */

export async function handleSaveSettings(data) {
    const { settings } = await ensureDefaults();
    const patch = data && typeof data === "object" ? data : {};

    const next = sanitizeSettings({
        ...settings,
        ...patch
    });

    await chrome.storage.local.set({ settings: next });
    return {
        settings: next,
        providerMetadata: buildProviderMetadata(next)
    };
}

export async function handleSavePersona(data) {
    const { persona } = await ensureDefaults();
    const patch = data && typeof data === "object" ? data : {};

    const merged = {
        ...persona,
        ...patch
    };

    if (Array.isArray(patch.exampleTweets)) {
        merged.exampleTweets = patch.exampleTweets;
    }

    if (Array.isArray(patch.niche)) {
        merged.niche = patch.niche;
    }

    if (Array.isArray(patch.savedReplies)) {
        merged.savedReplies = patch.savedReplies;
    }

    const next = sanitizePersona(merged);
    await chrome.storage.local.set({ persona: next });

    return { persona: next };
}

export async function handleSaveOnboarding(data) {
    const { onboarding } = await ensureDefaults();
    const patch = data && typeof data === "object" ? data : {};
    const next = sanitizeOnboarding({
        ...onboarding,
        ...patch,
        lastUpdated: new Date().toISOString()
    });

    await chrome.storage.local.set({ onboarding: next });
    return { onboarding: next };
}

export async function handleExportPersona() {
    const { persona, settings } = await ensureDefaults();
    return {
        exportData: {
            persona,
            settings: {
                provider: settings.provider,
                groqModel: settings.groqModel,
                nvidiaModel: settings.nvidiaModel,
                googleModel: settings.googleModel,
                showButtonOnAllTweets: settings.showButtonOnAllTweets,
                showCharacterCount: settings.showCharacterCount
            },
            exportedAt: new Date().toISOString(),
            version: "1.0.0"
        }
    };
}

export async function handleImportPersona(data) {
    const incoming = data && typeof data === "object" ? data : {};
    const importedPersona = sanitizePersona(incoming.persona || incoming);

    const { settings } = await ensureDefaults();
    const importedSettings = incoming.settings && typeof incoming.settings === "object"
        ? sanitizeSettings({ ...settings, ...incoming.settings })
        : settings;

    await chrome.storage.local.set({
        persona: importedPersona,
        settings: {
            ...importedSettings,
            groqApiKey: settings.groqApiKey,
            nvidiaApiKey: settings.nvidiaApiKey,
            googleApiKey: settings.googleApiKey
        }
    });

    return {
        persona: importedPersona,
        settings: {
            ...importedSettings,
            groqApiKey: settings.groqApiKey,
            nvidiaApiKey: settings.nvidiaApiKey,
            googleApiKey: settings.googleApiKey
        }
    };
}

export async function handleClearAllData() {
    await chrome.storage.local.set({
        persona: clone(DEFAULT_PERSONA),
        settings: clone(DEFAULT_SETTINGS),
        counters: clone(DEFAULT_COUNTERS),
        onboarding: clone(DEFAULT_ONBOARDING)
    });

    return await getFullState();
}

export function serializeError(error) {
    if (!error) {
        return { message: "Unknown error", code: "unknown" };
    }

    return {
        message: error.message || "Unknown error",
        code: error.code || "unknown",
        status: error.status || 0,
        retryAfter: error.retryAfter || 0,
        apiMessage: error.apiMessage || ""
    };
}
