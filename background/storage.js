/* ───────────────────────────────────────────
   background/storage.js
   Chrome storage: sanitizers, defaults, CRUD
   ─────────────────────────────────────────── */

import {
    STRATEGIES, PROVIDERS,
    DEFAULT_PERSONA, DEFAULT_SETTINGS, DEFAULT_COUNTERS, DEFAULT_ONBOARDING,
    sanitizeString, sanitizeArray, clone,
    getProviderConfig, getActiveKey, getActiveModel, maskKey
} from "./providers.js";

/* ── Sanitizers ── */

export function sanitizeReplyEntry(entry) {
    const item = entry && typeof entry === "object" ? entry : {};
    return {
        id: Number(item.id) || Date.now(),
        replyText: sanitizeString(item.replyText, 600),
        tweetContext: sanitizeString(item.tweetContext, 200),
        strategy: STRATEGIES.includes(item.strategy) ? item.strategy : "Insightful",
        provider: ["groq", "nvidia", "google"].includes(item.provider) ? item.provider : "groq",
        timestamp: sanitizeString(item.timestamp, 64) || new Date().toISOString(),
        used: Boolean(item.used)
    };
}

export function sanitizePersona(rawPersona) {
    const persona = rawPersona && typeof rawPersona === "object" ? rawPersona : {};
    const exampleTweets = Array.isArray(persona.exampleTweets)
        ? persona.exampleTweets.slice(0, 5).map((tweet) => sanitizeString(tweet, 280))
        : [];
    while (exampleTweets.length < 5) {
        exampleTweets.push("");
    }

    const savedReplies = Array.isArray(persona.savedReplies)
        ? persona.savedReplies.map(sanitizeReplyEntry).filter((item) => item.replyText)
        : [];

    return {
        name: sanitizeString(persona.name, 120),
        handle: sanitizeString(persona.handle, 60).replace(/^@+/, ""),
        background: sanitizeString(persona.background, 180),
        niche: sanitizeArray(persona.niche, 10, 60),
        tone: sanitizeString(persona.tone, 60),
        goal: sanitizeString(persona.goal, 80),
        writingStyle: sanitizeString(persona.writingStyle, 500),
        customReplyPrompt: sanitizeString(persona.customReplyPrompt, 1400),
        avoidPhrases: sanitizeString(persona.avoidPhrases, 500),
        exampleTweets,
        savedReplies: savedReplies.slice(-50)
    };
}

export function sanitizeSettings(rawSettings) {
    const settings = rawSettings && typeof rawSettings === "object" ? rawSettings : {};
    const validProviders = ["groq", "nvidia", "google"];
    const provider = validProviders.includes(settings.provider) ? settings.provider : "groq";

    const groqModel = sanitizeString(settings.groqModel, 120) || PROVIDERS.groq.defaultModel;
    const nvidiaModel = sanitizeString(settings.nvidiaModel, 120) || PROVIDERS.nvidia.defaultModel;
    const googleModel = sanitizeString(settings.googleModel, 120) || PROVIDERS.google.defaultModel;

    return {
        provider,
        groqApiKey: sanitizeString(settings.groqApiKey, 400),
        nvidiaApiKey: sanitizeString(settings.nvidiaApiKey, 400),
        googleApiKey: sanitizeString(settings.googleApiKey, 400),
        groqModel,
        nvidiaModel,
        googleModel,
        extensionEnabled:
            typeof settings.extensionEnabled === "boolean" ? settings.extensionEnabled : true,
        showButtonOnAllTweets:
            typeof settings.showButtonOnAllTweets === "boolean"
                ? settings.showButtonOnAllTweets
                : true,
        showCharacterCount:
            typeof settings.showCharacterCount === "boolean" ? settings.showCharacterCount : true
    };
}

export function sanitizeCounters(rawCounters) {
    const counters = rawCounters && typeof rawCounters === "object" ? rawCounters : {};
    return {
        totalRepliesGenerated: Number(counters.totalRepliesGenerated) || 0,
        totalRepliesUsed: Number(counters.totalRepliesUsed) || 0
    };
}

export function sanitizeOnboarding(rawOnboarding) {
    const onboarding = rawOnboarding && typeof rawOnboarding === "object" ? rawOnboarding : {};
    const step = Number(onboarding.step);
    return {
        step: Number.isFinite(step) && step >= 1 && step <= 5 ? step : 1,
        completed: Boolean(onboarding.completed),
        connectionVerified: Boolean(onboarding.connectionVerified),
        lastUpdated: sanitizeString(onboarding.lastUpdated, 64) || new Date().toISOString()
    };
}

function isLikelyCorruptedPersona(rawPersona) {
    if (rawPersona === undefined || rawPersona === null) {
        return false;
    }
    return typeof rawPersona !== "object" || Array.isArray(rawPersona);
}

/* ── Storage operations ── */

export async function ensureDefaults() {
    const stored = await chrome.storage.local.get(["persona", "settings", "counters", "onboarding"]);
    const persona = sanitizePersona(stored.persona);
    const settings = sanitizeSettings(stored.settings);
    const counters = sanitizeCounters(stored.counters);
    const onboarding = sanitizeOnboarding(stored.onboarding);

    const updates = {};
    if (!stored.persona || JSON.stringify(stored.persona) !== JSON.stringify(persona)) {
        updates.persona = persona;
    }
    if (!stored.settings || JSON.stringify(stored.settings) !== JSON.stringify(settings)) {
        updates.settings = settings;
    }
    if (!stored.counters || JSON.stringify(stored.counters) !== JSON.stringify(counters)) {
        updates.counters = counters;
    }
    if (!stored.onboarding || JSON.stringify(stored.onboarding) !== JSON.stringify(onboarding)) {
        updates.onboarding = onboarding;
    }

    if (Object.keys(updates).length > 0) {
        await chrome.storage.local.set(updates);
    }

    return {
        persona,
        settings,
        counters,
        onboarding,
        corruptedPersona: isLikelyCorruptedPersona(stored.persona)
    };
}

export function buildProviderMetadata(settings) {
    return Object.values(PROVIDERS).map((provider) => ({
        id: provider.id,
        label: provider.label,
        endpoint: provider.endpoint,
        modelOptions: provider.modelOptions,
        model: getActiveModel(settings, provider.id),
        signupUrl: provider.signupUrl,
        hasKey: Boolean(getActiveKey(settings, provider.id)),
        maskedKey: maskKey(getActiveKey(settings, provider.id))
    }));
}

export async function getFullState() {
    const state = await ensureDefaults();
    return {
        ...state,
        providerMetadata: buildProviderMetadata(state.settings)
    };
}

export async function incrementGeneratedCounter() {
    const { counters } = await ensureDefaults();
    const next = {
        ...counters,
        totalRepliesGenerated: counters.totalRepliesGenerated + 1
    };
    await chrome.storage.local.set({ counters: next });
    return next;
}

export async function saveUsedReplyToMemory(payload) {
    const { persona, counters } = await ensureDefaults();

    const entry = sanitizeReplyEntry({
        id: Date.now(),
        replyText: payload.replyText,
        tweetContext: sanitizeString(payload.tweetContext || "", 200),
        strategy: payload.strategy,
        provider: payload.provider,
        timestamp: new Date().toISOString(),
        used: true
    });

    if (!entry.replyText) {
        return { persona, counters };
    }

    const updatedReplies = [...persona.savedReplies, entry].slice(-50);
    const updatedPersona = {
        ...persona,
        savedReplies: updatedReplies
    };

    const updatedCounters = {
        ...counters,
        totalRepliesUsed: counters.totalRepliesUsed + 1
    };

    try {
        await chrome.storage.local.set({ persona: updatedPersona, counters: updatedCounters });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!/quota|exceeded/i.test(message)) {
            throw error;
        }

        const pruned = updatedReplies.slice(10);
        await chrome.storage.local.set({
            persona: { ...updatedPersona, savedReplies: pruned },
            counters: updatedCounters
        });
    }

    return {
        persona: updatedPersona,
        counters: updatedCounters
    };
}
