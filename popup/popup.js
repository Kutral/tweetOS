const state = {
  persona: null,
  settings: null,
  counters: null,
  providerMetadata: [],
  corruptedPersona: false
};

function sendMessage(action, payload = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action, payload }, (response) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message || "Runtime error"));
        return;
      }

      if (!response?.ok) {
        const err = new Error(response?.error?.message || "Request failed");
        err.code = response?.error?.code || "unknown";
        err.apiMessage = response?.error?.apiMessage || "";
        reject(err);
        return;
      }

      resolve(response);
    });
  });
}

function showToast(message) {
  const node = document.getElementById("toast");
  node.textContent = message;
  node.classList.add("show");
  setTimeout(() => {
    node.classList.remove("show");
  }, 2500);
}

function setTabs() {
  const buttons = Array.from(document.querySelectorAll(".tab-btn"));
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.toggle("active", b === button));

      const tab = button.dataset.tab;
      document.querySelectorAll(".tab-panel").forEach((panel) => {
        panel.classList.toggle("active", panel.id === `tab-${tab}`);
      });
    });
  });
}

function getProviderMeta(providerId) {
  return state.providerMetadata.find((provider) => provider.id === providerId) || null;
}

function getModelField(providerId) {
  const map = { nvidia: "nvidiaModel", google: "googleModel" };
  return map[providerId] || "groqModel";
}

function getKeyField(providerId) {
  const map = { nvidia: "nvidiaApiKey", google: "googleApiKey" };
  return map[providerId] || "groqApiKey";
}

function renderDashboard() {
  const handle = state.persona?.handle ? `@${state.persona.handle}` : "@yourhandle";
  const provider = state.settings?.provider || "groq";
  const hasKey = Boolean(state.settings?.[getKeyField(provider)]);
  const enabled = state.settings?.extensionEnabled !== false;

  const masterToggle = document.getElementById("master-enabled-toggle");
  if (masterToggle) {
    masterToggle.checked = enabled;
  }
  document.querySelector(".popup-app")?.classList.toggle("disabled", !enabled);

  document.getElementById("dashboard-handle").textContent = handle;
  const dot = document.getElementById("status-dot");
  dot.classList.toggle("active", hasKey && enabled);
  document.getElementById("status-text").textContent =
    !enabled ? "Disabled" : hasKey ? "Active" : "Setup needed";

  document.getElementById("stat-total").textContent = String(state.counters?.totalRepliesGenerated || 0);

  const weekStart = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const thisWeek = (state.persona?.savedReplies || []).filter((entry) => {
    return entry.used && new Date(entry.timestamp).getTime() >= weekStart;
  }).length;
  document.getElementById("stat-week").textContent = String(thisWeek);
}

function populateDashboardModelControls() {
  const providerSelect = document.getElementById("dash-provider-selector");
  const modelSelect = document.getElementById("dash-model-select");
  const modelCustom = document.getElementById("dash-model-custom");

  if (!providerSelect || !modelSelect || !modelCustom) {
    return;
  }

  const fillModelsForProvider = (providerId) => {
    const meta = getProviderMeta(providerId);
    const activeModel = state.settings?.[getModelField(providerId)] || "";
    const options = Array.from(new Set([...(meta?.modelOptions || []), activeModel].filter(Boolean)));

    modelSelect.innerHTML = "";
    options.forEach((model) => {
      const option = document.createElement("option");
      option.value = model;
      option.textContent = model;
      modelSelect.appendChild(option);
    });

    const customOption = document.createElement("option");
    customOption.value = "__custom__";
    customOption.textContent = "Custom model";
    modelSelect.appendChild(customOption);

    if (options.includes(activeModel)) {
      modelSelect.value = activeModel;
      modelCustom.classList.add("hidden");
      modelCustom.value = "";
    } else if (activeModel) {
      modelSelect.value = "__custom__";
      modelCustom.classList.remove("hidden");
      modelCustom.value = activeModel;
    } else {
      modelSelect.value = options[0] || "__custom__";
      modelCustom.classList.add("hidden");
      modelCustom.value = "";
    }
  };

  providerSelect.value = state.settings?.provider || "groq";
  fillModelsForProvider(providerSelect.value);

  providerSelect.onchange = () => {
    fillModelsForProvider(providerSelect.value);
  };

  modelSelect.onchange = () => {
    if (modelSelect.value === "__custom__") {
      modelCustom.classList.remove("hidden");
      modelCustom.focus();
    } else {
      modelCustom.classList.add("hidden");
      modelCustom.value = "";
    }
  };
}

function getDashboardSelectedModel() {
  const modelSelect = document.getElementById("dash-model-select");
  const modelCustom = document.getElementById("dash-model-custom");

  if (!modelSelect || !modelCustom) {
    return "";
  }

  if (modelSelect.value === "__custom__") {
    return modelCustom.value.trim();
  }
  return modelSelect.value;
}

function bindDashboardActions() {
  const masterToggle = document.getElementById("master-enabled-toggle");
  const showButtonToggle = document.getElementById("toggle-show-button");
  const showCharToggle = document.getElementById("toggle-char-count");
  const dashProvider = document.getElementById("dash-provider-selector");
  const dashSaveAiBtn = document.getElementById("dash-save-ai-btn");

  showButtonToggle.checked = Boolean(state.settings?.showButtonOnAllTweets);
  showCharToggle.checked = Boolean(state.settings?.showCharacterCount);
  if (dashProvider) {
    dashProvider.value = state.settings?.provider || "groq";
  }

  masterToggle?.addEventListener("change", async () => {
    try {
      const response = await sendMessage("SAVE_SETTINGS", {
        extensionEnabled: masterToggle.checked
      });
      state.settings = response.settings;
      renderDashboard();
      showToast(masterToggle.checked ? "ReplyOS enabled ✓" : "ReplyOS disabled");
    } catch (error) {
      showToast(error.message || "Failed to save");
    }
  });

  showButtonToggle.addEventListener("change", async () => {
    try {
      const response = await sendMessage("SAVE_SETTINGS", {
        showButtonOnAllTweets: showButtonToggle.checked
      });
      state.settings = response.settings;
      showToast("Saved ✓");
    } catch (error) {
      showToast(error.message || "Failed to save");
    }
  });

  showCharToggle.addEventListener("change", async () => {
    try {
      const response = await sendMessage("SAVE_SETTINGS", {
        showCharacterCount: showCharToggle.checked
      });
      state.settings = response.settings;
      showToast("Saved ✓");
    } catch (error) {
      showToast(error.message || "Failed to save");
    }
  });

  dashSaveAiBtn?.addEventListener("click", async () => {
    const provider = dashProvider?.value || state.settings?.provider || "groq";
    const model = getDashboardSelectedModel();

    if (!model) {
      showToast("Select a model first");
      return;
    }

    try {
      const response = await sendMessage("SAVE_SETTINGS", {
        provider,
        [getModelField(provider)]: model
      });
      state.settings = response.settings;
      state.providerMetadata = response.providerMetadata || state.providerMetadata;
      populateDashboardModelControls();
      updateProviderVisuals();
      showToast("AI model saved ✓");
    } catch (error) {
      showToast(error.message || "Failed to save AI selection");
    }
  });

  document.getElementById("edit-profile-btn").addEventListener("click", async () => {
    try {
      await sendMessage("OPEN_ONBOARDING");
      window.close();
    } catch (error) {
      showToast(error.message || "Could not open onboarding");
    }
  });
}

function renderToneSelector() {
  const tone = state.persona?.tone || "";
  document.querySelectorAll("#tone-pills button").forEach((button) => {
    button.classList.toggle("active", button.dataset.tone === tone);
    button.addEventListener("click", () => {
      document.querySelectorAll("#tone-pills button").forEach((node) => {
        node.classList.remove("active");
      });
      button.classList.add("active");
    });
  });
}

function renderVoiceTab() {
  const styleInput = document.getElementById("voice-style");
  const styleCount = document.getElementById("voice-style-count");
  const customPromptInput = document.getElementById("custom-prompt");
  const customPromptCount = document.getElementById("custom-prompt-count");
  const accordions = document.getElementById("tweet-accordions");

  styleInput.value = state.persona?.writingStyle || "";
  styleCount.textContent = String(styleInput.value.length);
  styleInput.addEventListener("input", () => {
    styleCount.textContent = String(styleInput.value.length);
  });

  customPromptInput.value = state.persona?.customReplyPrompt || "";
  customPromptCount.textContent = String(customPromptInput.value.length);
  customPromptInput.addEventListener("input", () => {
    customPromptCount.textContent = String(customPromptInput.value.length);
  });

  accordions.innerHTML = "";
  const tweets = state.persona?.exampleTweets || ["", "", "", "", ""];

  tweets.forEach((tweet, idx) => {
    const wrap = document.createElement("div");
    wrap.className = "accordion";
    wrap.innerHTML = `
      <button type="button">Example Tweet ${idx + 1}</button>
      <div class="accordion-body">
        <textarea rows="3" data-example-index="${idx}" maxlength="280">${tweet || ""}</textarea>
      </div>
    `;

    const title = wrap.querySelector("button");
    title.addEventListener("click", () => {
      wrap.classList.toggle("open");
    });

    accordions.appendChild(wrap);
  });

  renderToneSelector();

  document.getElementById("save-voice-btn").addEventListener("click", async () => {
    const selectedTone = document.querySelector("#tone-pills button.active")?.dataset.tone || "";
    const writingStyle = styleInput.value.trim();
    const customReplyPrompt = customPromptInput.value.trim();
    const exampleTweets = Array.from(document.querySelectorAll("[data-example-index]")).map((input) => {
      return input.value.trim();
    });

    try {
      const response = await sendMessage("SAVE_PERSONA", {
        tone: selectedTone,
        writingStyle,
        customReplyPrompt,
        exampleTweets
      });
      state.persona = response.persona;
      showToast("Changes saved ✓");
    } catch (error) {
      showToast(error.message || "Failed to save changes");
    }
  });
}

function populateModelSelect(providerId) {
  const meta = getProviderMeta(providerId);
  const select = document.getElementById(`${providerId}-model-select`);
  const custom = document.getElementById(`${providerId}-model-custom`);
  const activeModel = state.settings?.[getModelField(providerId)] || "";

  if (!meta || !select || !custom) {
    return;
  }

  const options = Array.from(new Set([...(meta.modelOptions || []), activeModel].filter(Boolean)));
  select.innerHTML = "";

  options.forEach((model) => {
    const option = document.createElement("option");
    option.value = model;
    option.textContent = model;
    select.appendChild(option);
  });

  const customOption = document.createElement("option");
  customOption.value = "__custom__";
  customOption.textContent = "Custom model";
  select.appendChild(customOption);

  if (options.includes(activeModel)) {
    select.value = activeModel;
    custom.classList.add("hidden");
  } else if (activeModel) {
    select.value = "__custom__";
    custom.classList.remove("hidden");
    custom.value = activeModel;
  } else {
    select.value = options[0] || "__custom__";
    custom.classList.add("hidden");
  }

  select.addEventListener("change", async () => {
    if (select.value === "__custom__") {
      custom.classList.remove("hidden");
      custom.focus();
      return;
    }

    custom.classList.add("hidden");
    custom.value = "";
    await persistModel(providerId, select.value);
  });

  custom.addEventListener("change", async () => {
    const value = custom.value.trim();
    if (value) {
      await persistModel(providerId, value);
    }
  });
}

function currentModelValue(providerId) {
  const select = document.getElementById(`${providerId}-model-select`);
  const custom = document.getElementById(`${providerId}-model-custom`);
  if (!select || !custom) {
    return "";
  }

  if (select.value === "__custom__") {
    return custom.value.trim();
  }
  return select.value;
}

async function persistModel(providerId, model) {
  if (!model) {
    return;
  }

  const field = getModelField(providerId);
  try {
    const response = await sendMessage("SAVE_SETTINGS", { [field]: model });
    state.settings = response.settings;
    state.providerMetadata = response.providerMetadata || state.providerMetadata;
    showToast("Model updated ✓");
  } catch (error) {
    showToast(error.message || "Model update failed");
  }
}

function updateProviderVisuals() {
  const provider = state.settings?.provider || "groq";
  document.getElementById("provider-selector").value = provider;

  document.querySelectorAll("[data-provider-card]").forEach((card) => {
    card.classList.toggle("active", card.dataset.providerCard === provider);
  });

  const keyInput = document.getElementById("api-key-input");
  const note = document.getElementById("key-note");
  const rawKey = state.settings?.[getKeyField(provider)] || "";

  if (!keyInput.value.trim()) {
    if (rawKey) {
      keyInput.placeholder = `Stored: ••••••${rawKey.slice(-4)}`;
    } else {
      keyInput.placeholder = "Paste API key";
    }
  }

  note.textContent = "Your API key is stored locally on your device only. We never see it.";
}

function bindProviderActions() {
  const providerSelector = document.getElementById("provider-selector");
  const keyInput = document.getElementById("api-key-input");
  const keyToggle = document.getElementById("toggle-key-visibility");
  const updateBtn = document.getElementById("update-key-btn");
  const testBtn = document.getElementById("test-connection-btn");
  const status = document.getElementById("test-status");

  providerSelector.addEventListener("change", async () => {
    try {
      const response = await sendMessage("SAVE_SETTINGS", { provider: providerSelector.value });
      state.settings = response.settings;
      state.providerMetadata = response.providerMetadata || state.providerMetadata;
      updateProviderVisuals();
    } catch (error) {
      showToast(error.message || "Failed to switch provider");
    }
  });

  document.querySelectorAll("[data-provider-card]").forEach((card) => {
    card.addEventListener("click", async (event) => {
      const target = event.target;
      if (target instanceof Element && target.closest("select, input, button")) {
        return;
      }
      const provider = card.dataset.providerCard;
      providerSelector.value = provider;
      providerSelector.dispatchEvent(new Event("change"));
    });
  });

  document.querySelectorAll(".tiny-link").forEach((button) => {
    button.addEventListener("click", () => {
      const provider = button.dataset.link;
      const urls = {
        groq: "https://console.groq.com",
        nvidia: "https://build.nvidia.com",
        google: "https://aistudio.google.com/apikey"
      };
      chrome.tabs.create({ url: urls[provider] || urls.groq });
    });
  });

  keyToggle.addEventListener("click", () => {
    keyInput.type = keyInput.type === "password" ? "text" : "password";
  });

  updateBtn.addEventListener("click", async () => {
    const provider = providerSelector.value;
    const model = currentModelValue(provider);
    const keyValue = keyInput.value.trim();

    const payload = {
      provider,
      [getModelField(provider)]: model
    };

    if (keyValue) {
      payload[getKeyField(provider)] = keyValue;
    }

    try {
      const response = await sendMessage("SAVE_SETTINGS", payload);
      state.settings = response.settings;
      state.providerMetadata = response.providerMetadata || state.providerMetadata;
      keyInput.value = "";
      updateProviderVisuals();
      showToast("Settings updated ✓");
    } catch (error) {
      showToast(error.message || "Failed to update settings");
    }
  });

  testBtn.addEventListener("click", async () => {
    const provider = providerSelector.value;
    const model = currentModelValue(provider);
    const apiKey = keyInput.value.trim();

    status.className = "test-status loading";
    status.innerHTML = '<span class="mini-spinner"></span>Testing connection...';

    try {
      await sendMessage("TEST_CONNECTION", {
        provider,
        apiKey,
        model
      });

      status.className = "test-status success";
      status.textContent = "✓ Connected! Ready to use.";
      await sendMessage("SAVE_ONBOARDING", { connectionVerified: true });
    } catch (error) {
      status.className = "test-status error";
      status.textContent = `✕ ${error.apiMessage || error.message}`;
    }
  });
}

function bindSettingsActions() {
  document.getElementById("export-btn").addEventListener("click", async () => {
    try {
      const response = await sendMessage("EXPORT_PERSONA");
      const blob = new Blob([JSON.stringify(response.exportData, null, 2)], {
        type: "application/json"
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "persona.json";
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      showToast(error.message || "Export failed");
    }
  });

  const importInput = document.getElementById("import-file");
  document.getElementById("import-btn").addEventListener("click", () => {
    importInput.click();
  });

  importInput.addEventListener("change", async () => {
    const file = importInput.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      await sendMessage("IMPORT_PERSONA", parsed);
      window.location.reload();
    } catch (error) {
      showToast(error.message || "Import failed");
    } finally {
      importInput.value = "";
    }
  });

  document.getElementById("clear-data-btn").addEventListener("click", async () => {
    const ok = window.confirm("Clear all ReplyOS data including voice profile and saved replies?");
    if (!ok) {
      return;
    }

    try {
      await sendMessage("CLEAR_ALL_DATA");
      window.location.reload();
    } catch (error) {
      showToast(error.message || "Could not clear data");
    }
  });

  document.getElementById("reset-btn").addEventListener("click", async () => {
    try {
      await sendMessage("SAVE_PERSONA", {
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
      });
      window.location.reload();
    } catch (error) {
      showToast(error.message || "Reset failed");
    }
  });
}

async function hydrate() {
  renderDashboard();
  populateDashboardModelControls();

  const resetCard = document.getElementById("reset-card");
  resetCard.classList.toggle("hidden", !state.corruptedPersona);

  renderVoiceTab();

  populateModelSelect("groq");
  populateModelSelect("nvidia");
  populateModelSelect("google");
  updateProviderVisuals();

  bindDashboardActions();
  bindProviderActions();
  bindSettingsActions();
}

async function load() {
  const response = await sendMessage("GET_STATE");
  state.persona = response.persona;
  state.settings = response.settings;
  state.counters = response.counters;
  state.providerMetadata = response.providerMetadata || [];
  state.corruptedPersona = Boolean(response.corruptedPersona);
}

(async function initPopup() {
  setTabs();

  try {
    await load();
    await hydrate();
  } catch (error) {
    showToast(error.message || "Failed to load ReplyOS");
  }
})();
