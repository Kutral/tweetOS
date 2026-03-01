/* ───────────────────────────────────────────
   content/state.js
   Shared state, constants, and utility functions
   Loaded first by manifest.json content_scripts
   ─────────────────────────────────────────── */

/* eslint-disable no-unused-vars */
/* globals — these become available to subsequent content scripts */

const REPLYOS_STATE = {
    prefs: {
        extensionEnabled: true,
        showButtonOnAllTweets: true,
        showCharacterCount: true,
        providerLabel: "Groq"
    },
    activeRequest: null,
    modal: null,
    modalContext: null,
    selectedIndex: -1,
    rateLimitTimer: null
};

const DEBOUNCE_MS = 300;

function debounce(fn, wait) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), wait);
    };
}

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function sendRuntimeMessage(message) {
    return new Promise((resolve, reject) => {
        try {
            chrome.runtime.sendMessage(message, (response) => {
                const runtimeError = chrome.runtime.lastError;
                if (runtimeError) {
                    const err = new Error(runtimeError.message || "Runtime message failed.");
                    if (/context invalidated/i.test(err.message)) {
                        err.code = "extension_invalidated";
                    }
                    reject(err);
                    return;
                }

                if (!response?.ok) {
                    const err = new Error(response?.error?.message || "Request failed.");
                    err.code = response?.error?.code || "unknown";
                    err.status = response?.error?.status || 0;
                    err.retryAfter = response?.error?.retryAfter || 0;
                    err.apiMessage = response?.error?.apiMessage || "";
                    reject(err);
                    return;
                }

                resolve(response);
            });
        } catch (error) {
            reject(error);
        }
    });
}
