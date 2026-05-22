/* ───────────────────────────────────────────
   background/api.js
   API calls: Groq, NVIDIA (OpenAI-compat), Google Gemini
   ─────────────────────────────────────────── */

import { getProviderConfig, sanitizeString } from "./providers.js";

/* ── Error parsing ── */

export function parseApiError(status, parsed, rawText, headers) {
    const apiMessage =
        sanitizeString(parsed?.error?.message, 800) ||
        sanitizeString(parsed?.message, 800) ||
        sanitizeString(rawText, 800) ||
        "Unknown API error";

    const retryHeader = headers?.get?.("retry-after") || "";
    const retryAfter = Number.parseInt(retryHeader, 10);

    if (status === 401) {
        return {
            status,
            code: "unauthorized",
            message: "Invalid API key. Check your key in settings.",
            apiMessage
        };
    }

    if (status === 429) {
        return {
            status,
            code: "rate_limited",
            message: "Rate limit hit.",
            retryAfter: Number.isFinite(retryAfter) ? retryAfter : 0,
            apiMessage
        };
    }

    if (status === 413) {
        return {
            status,
            code: "request_too_large",
            message: "That tweet/thread is too large to send. I trimmed context; retry once.",
            apiMessage: ""
        };
    }

    if (status >= 500) {
        return {
            status,
            code: "server_error",
            message: "AI service is down. Try again in a moment.",
            apiMessage
        };
    }

    return {
        status,
        code: "api_error",
        message: apiMessage,
        apiMessage
    };
}

/* ── Provider call ── */

export async function callProvider({ providerId, apiKey, model, messages, temperature = 0.8, maxTokens = 420 }) {
    const provider = getProviderConfig(providerId);

    if (!apiKey) {
        const err = new Error("API key missing.");
        err.code = "no_api_key";
        throw err;
    }

    // Build request differently for Google Gemini vs OpenAI-compatible providers
    let endpoint, headers, payload;

    if (providerId === "google") {
        // Gemini REST API: different endpoint, auth, and payload format
        endpoint = `${provider.endpoint}/${model}:generateContent`;
        headers = {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
        };

        // Convert OpenAI messages to Gemini contents format
        const systemMsg = messages.find(m => m.role === "system");
        const userMsgs = messages.filter(m => m.role !== "system");
        const contents = userMsgs.map(m => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }]
        }));

        payload = { contents };
        if (systemMsg) {
            payload.system_instruction = { parts: [{ text: systemMsg.content }] };
        }
        payload.generationConfig = {
            temperature,
            maxOutputTokens: maxTokens,
            responseMimeType: "application/json"
        };

        // Suppress thinking tokens to prevent them from eating output budget
        // Gemini 3 models use thinkingLevel, Gemini 2.5 uses thinkingBudget
        if (model.includes("gemini-3")) {
            payload.generationConfig.thinkingConfig = { thinkingLevel: "minimal" };
        } else if (model.includes("gemini-2.5")) {
            payload.generationConfig.thinkingConfig = { thinkingBudget: 0 };
        }
    } else {
        // OpenAI-compatible providers (Groq, NVIDIA)
        endpoint = provider.endpoint;
        headers = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`
        };
        payload = {
            model,
            messages,
            temperature,
            max_tokens: maxTokens,
            stream: false
        };

        // Fix reasoning models: suppress <think> blocks so output is clean JSON
        const lowerModel = model.toLowerCase();
        if (providerId === "groq") {
            if (lowerModel.includes("gpt-oss")) {
                payload.reasoning_effort = "low";
                payload.reasoning_format = "hidden";
            } else if (lowerModel.includes("qwen3")) {
                payload.reasoning_effort = "none";
            }
        }

        // NVIDIA: disable thinking for Kimi/Moonshot reasoning models
        if (providerId === "nvidia") {
            if (lowerModel.includes("kimi") || lowerModel.includes("moonshot")) {
                payload.chat_template_kwargs = { thinking: false };
                payload.include_reasoning = false;
            }
        }
    }

    let response;
    try {
        response = await fetch(endpoint, {
            method: "POST",
            headers,
            body: JSON.stringify(payload)
        });
    } catch (error) {
        const err = new Error("No internet connection detected.");
        err.code = "network_error";
        err.raw = error instanceof Error ? error.message : String(error);
        throw err;
    }

    const rawText = await response.text();
    let parsed;

    try {
        parsed = rawText ? JSON.parse(rawText) : {};
    } catch {
        parsed = {};
    }

    if (!response.ok) {
        const apiError = parseApiError(response.status, parsed, rawText, response.headers);
        const err = new Error(apiError.message);
        err.code = apiError.code;
        err.status = apiError.status;
        err.retryAfter = apiError.retryAfter || 0;
        err.apiMessage = apiError.apiMessage;
        throw err;
    }

    return parsed;
}
