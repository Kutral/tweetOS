/* ───────────────────────────────────────────
   background/providers.js
   Provider configs, constants, and defaults
   ─────────────────────────────────────────── */

export const PROVIDERS = {
    groq: {
        id: "groq",
        label: "Groq",
        endpoint: "https://api.groq.com/openai/v1/chat/completions",
        keyField: "groqApiKey",
        modelField: "groqModel",
        defaultModel: "llama-3.3-70b-versatile",
        modelOptions: [
            "llama-3.3-70b-versatile",
            "llama-3.1-8b-instant",
            "meta-llama/llama-4-scout-17b-16e-instruct",
            "qwen/qwen3-32b",
            "moonshotai/kimi-k2-instruct-0905",
            "groq/compound",
            "groq/compound-mini",
            "openai/gpt-oss-120b",
            "openai/gpt-oss-20b",
            "openai/gpt-oss-safeguard-20b"
        ],
        signupUrl: "https://console.groq.com"
    },
    nvidia: {
        id: "nvidia",
        label: "NVIDIA",
        endpoint: "https://integrate.api.nvidia.com/v1/chat/completions",
        keyField: "nvidiaApiKey",
        modelField: "nvidiaModel",
        defaultModel: "nvidia/llama-3.3-nemotron-super-49b-v1",
        modelOptions: [
            "nvidia/llama-3.3-nemotron-super-49b-v1",
            "meta/llama-3.1-8b-instruct",
            "minimaxai/minimax-m2.5",
            "moonshotai/kimi-k2.5"
        ],
        signupUrl: "https://build.nvidia.com"
    },
    google: {
        id: "google",
        label: "Google Gemini",
        endpoint: "https://generativelanguage.googleapis.com/v1beta/models",
        keyField: "googleApiKey",
        modelField: "googleModel",
        defaultModel: "gemini-3-flash-preview",
        modelOptions: [
            "gemini-3-flash-preview",
            "gemini-2.5-flash"
        ],
        signupUrl: "https://aistudio.google.com/apikey"
    }
};

export const STRATEGIES = ["Contrarian", "Insightful", "Relatable", "Funny", "Bold", "Story", "Question"];
export const REQUIRED_REPLY_STRATEGIES = ["Contrarian", "Insightful", "Relatable", "Funny"];
export const FUNNY_BLOCKLIST = ["fuck", "shit", "damn", "bitch", "bastard", "pig", "hell", "crap", "suck", "idiot"];

export const DEFAULT_PERSONA = {
    name: "",
    handle: "",
    background: "",
    niche: [],
    tone: "",
    goal: "",
    writingStyle: "",
    customReplyPrompt: "",
    avoidPhrases: "",
    exampleTweets: ["", "", "", "", ""],
    savedReplies: []
};

export const DEFAULT_SETTINGS = {
    provider: "groq",
    groqApiKey: "",
    nvidiaApiKey: "",
    googleApiKey: "",
    groqModel: PROVIDERS.groq.defaultModel,
    nvidiaModel: PROVIDERS.nvidia.defaultModel,
    googleModel: PROVIDERS.google.defaultModel,
    extensionEnabled: true,
    showButtonOnAllTweets: true,
    showCharacterCount: true
};

export const DEFAULT_COUNTERS = {
    totalRepliesGenerated: 0,
    totalRepliesUsed: 0
};

export const DEFAULT_ONBOARDING = {
    step: 1,
    completed: false,
    connectionVerified: false,
    lastUpdated: new Date().toISOString()
};

export function getProviderConfig(providerId) {
    return PROVIDERS[providerId] || PROVIDERS.groq;
}

export function getActiveKey(settings, providerId) {
    const provider = getProviderConfig(providerId);
    return sanitizeString(settings[provider.keyField], 400);
}

export function getActiveModel(settings, providerId, explicitModel = "") {
    if (explicitModel) {
        return sanitizeString(explicitModel, 120);
    }
    const provider = getProviderConfig(providerId);
    const fromSettings = sanitizeString(settings[provider.modelField], 120);
    return fromSettings || provider.defaultModel;
}

export function maskKey(key) {
    const safe = sanitizeString(key, 400);
    if (!safe) {
        return "";
    }
    if (safe.length <= 4) {
        return `••••${safe}`;
    }
    return `••••••${safe.slice(-4)}`;
}

/* Shared sanitize helpers — also exported for use by storage.js */
export function sanitizeString(value, maxLength = 5000) {
    if (typeof value !== "string") {
        return "";
    }
    return value.trim().slice(0, maxLength);
}

export function sanitizeArray(values, maxItems = 10, maxLength = 500) {
    if (!Array.isArray(values)) {
        return [];
    }
    return values
        .map((item) => sanitizeString(item, maxLength))
        .filter(Boolean)
        .slice(0, maxItems);
}

export function clone(value) {
    return JSON.parse(JSON.stringify(value));
}
