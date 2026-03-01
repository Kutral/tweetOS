/* ───────────────────────────────────────────
   content.js — Orchestrator
   Observer, injection, prefs, and settings watcher
   Depends on: content/state.js, content/scraper.js, content/ui.js
   ─────────────────────────────────────────── */

function clearInjectedButtons() {
  document.querySelectorAll('.replyos-action-wrap').forEach((node) => node.remove());
  document.querySelectorAll('article[data-replyos="true"]').forEach((article) => {
    article.removeAttribute("data-replyos");
  });
}

function applyInjection() {
  if (!REPLYOS_STATE.prefs.extensionEnabled || !REPLYOS_STATE.prefs.showButtonOnAllTweets) {
    clearInjectedButtons();
    return;
  }

  const articles = document.querySelectorAll('article[data-testid="tweet"]');
  articles.forEach((article) => {
    if (article.dataset.replyos === "true") {
      return;
    }

    const toolbar = getActionToolbar(article);
    if (!toolbar) {
      return;
    }

    const wrap = document.createElement("div");
    wrap.className = "replyos-action-wrap";

    const button = document.createElement("button");
    button.className = "replyos-action-btn";
    button.type = "button";
    button.textContent = "✦ AI Reply";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openReplyModal(article);
    });

    wrap.appendChild(button);
    toolbar.appendChild(wrap);
    article.dataset.replyos = "true";
  });
}

function startObserver() {
  const debouncedInject = debounce(applyInjection, DEBOUNCE_MS);
  const observer = new MutationObserver(() => {
    debouncedInject();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  applyInjection();
}

async function generateReplies(context) {
  REPLYOS_STATE.modalContext = context;
  renderLoading(REPLYOS_STATE.prefs.providerLabel);

  try {
    const request = sendRuntimeMessage({
      action: "GENERATE_REPLIES",
      payload: {
        tweetText: context.tweetText,
        tweetAuthor: context.authorHandle,
        threadContext: context.threadContext
      }
    });

    REPLYOS_STATE.activeRequest = request;
    const response = await request;
    REPLYOS_STATE.activeRequest = null;

    const resultsContext = {
      ...context,
      provider: response.provider,
      providerLabel: response.providerLabel || REPLYOS_STATE.prefs.providerLabel,
      model: response.model
    };

    renderResults(response.replies || [], resultsContext);
  } catch (rawError) {
    const error = normalizeUiError(rawError || {});
    const message =
      error.code === "rate_limited"
        ? "Rate limit reached."
        : error.message || "Something went wrong while generating replies.";

    showInlineError(message, error.code !== "no_api_key", context, error);
  }
}

function openReplyModal(article) {
  if (!REPLYOS_STATE.prefs.extensionEnabled) {
    return;
  }

  const tweetText = findTweetText(article);
  const author = findTweetAuthor(article);
  const threadContext = findThreadContext(article);

  const context = {
    article,
    tweetText,
    authorHandle: author.handle,
    authorName: author.name,
    threadContext
  };

  const { overlay } = ensureModalRoot();
  if (!overlay.isConnected) {
    document.body.appendChild(overlay);
  }

  document.addEventListener("keydown", handleModalKeyboard, true);
  generateReplies(context);
}

async function loadPrefs() {
  try {
    const response = await sendRuntimeMessage({ action: "GET_CONTENT_PREFS" });
    REPLYOS_STATE.prefs = {
      ...REPLYOS_STATE.prefs,
      ...(response.prefs || {})
    };
  } catch {
    REPLYOS_STATE.prefs = {
      ...REPLYOS_STATE.prefs,
      extensionEnabled: true,
      showButtonOnAllTweets: true,
      showCharacterCount: true,
      providerLabel: "Groq"
    };
  }
}

const PROVIDER_LABELS = {
  groq: "Groq",
  nvidia: "NVIDIA",
  google: "Google Gemini"
};

function watchSettingsChanges() {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes.settings) {
      return;
    }

    const next = changes.settings.newValue || {};
    REPLYOS_STATE.prefs.extensionEnabled =
      typeof next.extensionEnabled === "boolean"
        ? next.extensionEnabled
        : REPLYOS_STATE.prefs.extensionEnabled;
    REPLYOS_STATE.prefs.showButtonOnAllTweets =
      typeof next.showButtonOnAllTweets === "boolean"
        ? next.showButtonOnAllTweets
        : REPLYOS_STATE.prefs.showButtonOnAllTweets;
    REPLYOS_STATE.prefs.showCharacterCount =
      typeof next.showCharacterCount === "boolean"
        ? next.showCharacterCount
        : REPLYOS_STATE.prefs.showCharacterCount;
    REPLYOS_STATE.prefs.providerLabel = PROVIDER_LABELS[next.provider] || "Groq";

    applyInjection();
  });
}

(async function initReplyOS() {
  try {
    await loadPrefs();
    watchSettingsChanges();
    startObserver();
  } catch {
    // Avoid breaking Twitter page execution in case extension initialization fails.
  }
})();
