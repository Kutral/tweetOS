/* ───────────────────────────────────────────
   content/ui.js
   Modal creation, rendering, error display, keyboard nav
   ─────────────────────────────────────────── */

/* eslint-disable no-unused-vars */
/* Depends on: content/state.js, content/scraper.js */

function ensureModalRoot() {
    if (REPLYOS_STATE.modal?.overlay?.isConnected) {
        return REPLYOS_STATE.modal;
    }

    const overlay = document.createElement("div");
    overlay.className = "replyos-overlay";

    const modal = document.createElement("div");
    modal.className = "replyos-modal";

    overlay.appendChild(modal);
    REPLYOS_STATE.modal = { overlay, modal };

    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
            closeModal();
        }
    });

    return REPLYOS_STATE.modal;
}

function clearRateLimitCountdown() {
    if (REPLYOS_STATE.rateLimitTimer) {
        clearInterval(REPLYOS_STATE.rateLimitTimer);
        REPLYOS_STATE.rateLimitTimer = null;
    }
}

function closeModal() {
    clearRateLimitCountdown();

    if (REPLYOS_STATE.modal?.overlay?.isConnected) {
        REPLYOS_STATE.modal.overlay.remove();
    }

    REPLYOS_STATE.modalContext = null;
    REPLYOS_STATE.selectedIndex = -1;
    REPLYOS_STATE.activeRequest = null;
    document.removeEventListener("keydown", handleModalKeyboard, true);
}

function setModalContent(content) {
    const root = ensureModalRoot();
    root.modal.innerHTML = content;

    const closeBtn = root.modal.querySelector(".replyos-close");
    if (closeBtn) {
        closeBtn.addEventListener("click", closeModal);
    }
}

function renderLoading(providerLabel = "AI") {
    setModalContent(`
    <div class="replyos-modal-header">
      <div class="replyos-modal-title">ReplyOS</div>
      <button type="button" class="replyos-close" aria-label="Close">✕</button>
    </div>
    <div class="replyos-modal-body">
      <div class="replyos-loading-stack">
        <div class="replyos-spinner-wrap">
          <div class="replyos-spinner"></div>
          <div class="replyos-loading-text">Generating replies in your voice...</div>
        </div>
        <div class="replyos-skeleton"></div>
        <div class="replyos-skeleton"></div>
        <div class="replyos-skeleton"></div>
      </div>
    </div>
    <div class="replyos-footer">
      <div class="replyos-provider">Powered by ${providerLabel}</div>
      <button type="button" class="replyos-footer-btn" disabled>↻ Regenerate</button>
    </div>
  `);
}

function selectCard(index) {
    REPLYOS_STATE.selectedIndex = index;
    const cards = Array.from(document.querySelectorAll(".replyos-card"));
    cards.forEach((card, idx) => {
        card.classList.toggle("replyos-selected", idx === index);
    });
}

async function copyReply(text, button) {
    try {
        await navigator.clipboard.writeText(text);
        if (button) {
            const original = button.textContent;
            button.textContent = "Copied ✓";
            button.disabled = true;
            setTimeout(() => {
                button.textContent = original;
                button.disabled = false;
            }, 2000);
        }
    } catch {
        // If clipboard fails, keep the UI responsive with no crash.
    }
}

async function waitForComposer(timeoutMs = 4500) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const composer = document.querySelector('[data-testid="tweetTextarea_0"]');
        if (composer) {
            return composer;
        }
        await wait(120);
    }
    return null;
}

function dispatchInputEvents(element, text) {
    element.dispatchEvent(
        new InputEvent("beforeinput", {
            bubbles: true,
            cancelable: true,
            inputType: "insertText",
            data: text
        })
    );

    element.dispatchEvent(
        new InputEvent("input", {
            bubbles: true,
            inputType: "insertText",
            data: text
        })
    );

    element.dispatchEvent(new Event("change", { bubbles: true }));
}

function setComposerText(composer, text) {
    composer.focus();

    if (document.queryCommandSupported("selectAll")) {
        document.execCommand("selectAll", false);
    }
    if (document.queryCommandSupported("insertText")) {
        document.execCommand("insertText", false, text);
    }

    if ((composer.textContent || "").trim() !== text.trim()) {
        composer.textContent = text;
    }

    dispatchInputEvents(composer, text);
}

async function injectReplyIntoComposer(text, article) {
    let composer = document.querySelector('[data-testid="tweetTextarea_0"]');

    if (!composer) {
        const replyButton = article.querySelector('[data-testid="reply"]');
        if (replyButton instanceof HTMLElement) {
            replyButton.click();
            composer = await waitForComposer();
        }
    }

    if (!composer) {
        return false;
    }

    setComposerText(composer, text);
    composer.focus();
    return true;
}

async function persistUsedReply(reply, context) {
    try {
        await sendRuntimeMessage({
            action: "SAVE_USED_REPLY",
            payload: {
                replyText: reply.text,
                strategy: reply.strategy,
                provider: context.provider,
                tweetContext: (context.tweetText || "").slice(0, 200)
            }
        });
    } catch {
        // Usage memory failure should not block UX.
    }
}

function setupResultsEvents(replies, context) {
    const cards = Array.from(document.querySelectorAll(".replyos-card"));

    cards.forEach((card, idx) => {
        card.addEventListener("click", () => {
            selectCard(idx);
        });

        const copyBtn = card.querySelector('[data-role="copy"]');
        const useBtn = card.querySelector('[data-role="use"]');

        copyBtn?.addEventListener("click", async (event) => {
            event.stopPropagation();
            await copyReply(replies[idx].text, copyBtn);
        });

        useBtn?.addEventListener("click", async (event) => {
            event.stopPropagation();
            try {
                const ok = await injectReplyIntoComposer(replies[idx].text, context.article);
                await persistUsedReply(replies[idx], context);

                if (!ok) {
                    await copyReply(replies[idx].text);
                    showInlineError(
                        "Couldn't auto-fill. Text copied to clipboard — paste it manually.",
                        false,
                        context
                    );
                    return;
                }

                closeModal();
            } catch {
                showInlineError(
                    "Couldn't auto-fill. Text copied to clipboard — paste it manually.",
                    false,
                    context
                );
            }
        });
    });

    const regenerate = document.querySelector('[data-role="regenerate"]');
    regenerate?.addEventListener("click", () => {
        generateReplies(context);
    });

    selectCard(0);
}

function showInlineError(message, includeRetry, context, error = null) {
    const isNoKey = error?.code === "no_api_key";
    const isRateLimit = error?.code === "rate_limited";
    const isInvalidated = error?.code === "extension_invalidated";

    const retryButton = includeRetry
        ? '<button type="button" class="replyos-mini-btn" data-role="retry">Retry</button>'
        : "";

    const setupButton = isNoKey
        ? '<button type="button" class="replyos-mini-btn primary" data-role="setup">⚙ Set up your API key</button>'
        : "";

    const reloadHint = isInvalidated ? "Reload Twitter tab to reactivate ReplyOS." : "";
    const countdownText = isRateLimit
        ? `Rate limit reached. Try again in <span data-role="countdown">${error.retryAfter || 0}</span> seconds.`
        : "";

    setModalContent(`
    <div class="replyos-modal-header">
      <div class="replyos-modal-title">ReplyOS</div>
      <button type="button" class="replyos-close" aria-label="Close">✕</button>
    </div>
    <div class="replyos-modal-body">
      <div class="replyos-error-box">
        <div>${message}</div>
        ${error?.apiMessage ? `<div>${error.apiMessage}</div>` : ""}
        ${countdownText ? `<div>${countdownText}</div>` : ""}
        ${reloadHint ? `<div>${reloadHint}</div>` : ""}
        <div class="replyos-error-actions">
          ${retryButton}
          ${setupButton}
        </div>
      </div>
    </div>
    <div class="replyos-footer">
      <div class="replyos-provider">Powered by ${REPLYOS_STATE.prefs.providerLabel}</div>
      <button type="button" class="replyos-footer-btn" data-role="regenerate">↻ Regenerate</button>
    </div>
  `);

    document.querySelector('[data-role="regenerate"]')?.addEventListener("click", () => {
        generateReplies(context);
    });

    document.querySelector('[data-role="retry"]')?.addEventListener("click", () => {
        generateReplies(context);
    });

    document.querySelector('[data-role="setup"]')?.addEventListener("click", async () => {
        try {
            await sendRuntimeMessage({ action: "OPEN_SETTINGS_POPUP" });
        } catch {
            // Ignore popup failures.
        }
    });

    if (isRateLimit) {
        let seconds = Number(error.retryAfter) || 0;
        const countdownNode = document.querySelector('[data-role="countdown"]');
        clearRateLimitCountdown();
        REPLYOS_STATE.rateLimitTimer = window.setInterval(() => {
            seconds = Math.max(0, seconds - 1);
            if (countdownNode) {
                countdownNode.textContent = String(seconds);
            }
            if (seconds === 0) {
                clearRateLimitCountdown();
            }
        }, 1000);
    }
}

function renderResults(replies, context) {
    const cardsMarkup = replies
        .map((reply, idx) => {
            const count = reply.text.length;
            const countClass = count > 280 ? "replyos-count over" : "replyos-count";
            const countMarkup = REPLYOS_STATE.prefs.showCharacterCount
                ? `<div class="${countClass}">${count} chars</div>`
                : "";

            return `
        <article class="replyos-card" data-index="${idx}" style="animation-delay:${idx * 80}ms">
          <div class="replyos-strategy">${reply.strategy}</div>
          <div class="replyos-text">${reply.text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
          <div class="replyos-meta">
            ${countMarkup}
            <div class="replyos-card-actions">
              <button type="button" class="replyos-mini-btn" data-role="copy">Copy</button>
              <button type="button" class="replyos-mini-btn primary" data-role="use">Use This Reply</button>
            </div>
          </div>
        </article>
      `;
        })
        .join("");

    setModalContent(`
    <div class="replyos-modal-header">
      <div class="replyos-modal-title">ReplyOS Suggestions</div>
      <button type="button" class="replyos-close" aria-label="Close">✕</button>
    </div>
    <div class="replyos-modal-body">
      <div class="replyos-replies">${cardsMarkup}</div>
    </div>
    <div class="replyos-footer">
      <div class="replyos-provider">Powered by ${context.providerLabel}</div>
      <div class="replyos-hotkeys">1 2 3 4 select • Enter use • Esc close</div>
      <button type="button" class="replyos-footer-btn" data-role="regenerate">↻ Regenerate</button>
    </div>
  `);

    setupResultsEvents(replies, context);
}

function normalizeUiError(error) {
    if (!navigator.onLine) {
        return {
            ...error,
            code: "network_error",
            message: "No connection. Check your network and retry."
        };
    }

    if (error.code === "unauthorized") {
        return { ...error, message: "Invalid API key. Check your key in settings." };
    }

    if (error.code === "rate_limited") {
        return {
            ...error,
            message: "Rate limit reached.",
            retryAfter: Number(error.retryAfter) || 0
        };
    }

    if (error.code === "server_error") {
        return { ...error, message: "AI service is down. Try again in a moment." };
    }

    if (error.code === "network_error") {
        return { ...error, message: "No connection. Check your network and retry." };
    }

    if (error.code === "tweet_parse_error") {
        return { ...error, message: "Couldn't read this tweet. Try another." };
    }

    if (error.code === "extension_invalidated") {
        return { ...error, message: "Reload Twitter tab to reactivate ReplyOS" };
    }

    return {
        ...error,
        message: error.message || "Something went wrong. Please retry."
    };
}

function handleModalKeyboard(event) {
    if (!REPLYOS_STATE.modal?.overlay?.isConnected) {
        return;
    }

    if (event.key === "Escape") {
        event.preventDefault();
        closeModal();
        return;
    }

    if (["1", "2", "3", "4"].includes(event.key)) {
        event.preventDefault();
        selectCard(Number(event.key) - 1);
        return;
    }

    if (event.key === "Enter") {
        const index = REPLYOS_STATE.selectedIndex;
        if (index >= 0) {
            const useButton = document.querySelector(`.replyos-card[data-index="${index}"] [data-role="use"]`);
            if (useButton instanceof HTMLButtonElement) {
                event.preventDefault();
                useButton.click();
            }
        }
    }
}
