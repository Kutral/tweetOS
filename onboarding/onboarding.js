const state = {
  persona: null,
  settings: null,
  providerMetadata: [],
  testedProviders: {
    groq: false,
    nvidia: false
  }
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

function setError(message = "") {
  document.getElementById("error-line").textContent = message;
}

function selectedProvider() {
  return document.querySelector('input[name="provider"]:checked')?.value || "groq";
}

function selectedNiches() {
  return Array.from(document.querySelectorAll("#niche-pills button.active")).map((button) => button.dataset.value);
}

function selectedTone() {
  return document.querySelector(".tone.active")?.dataset.tone || "";
}

function getKeyField(provider) {
  return provider === "nvidia" ? "nvidiaApiKey" : "groqApiKey";
}

function getModelField(provider) {
  return provider === "nvidia" ? "nvidiaModel" : "groqModel";
}

function currentModel(provider) {
  const select = document.getElementById(`${provider}-model`);
  const custom = document.getElementById(`${provider}-model-custom`);

  if (!select || !custom) {
    return "";
  }

  if (select.value === "__custom__") {
    return custom.value.trim();
  }

  return select.value;
}

function setCardSelection(provider) {
  document.querySelectorAll(".provider-card").forEach((card) => {
    card.classList.toggle("active", card.dataset.providerCard === provider);
  });
}

function updateStyleCounter() {
  const input = document.getElementById("writing-style");
  document.getElementById("style-count").textContent = String(input.value.length);
}

function updateCustomPromptCounter() {
  const input = document.getElementById("custom-reply-prompt");
  document.getElementById("custom-reply-prompt-count").textContent = String(input.value.length);
}

function bindVoiceInputs() {
  document.getElementById("writing-style").addEventListener("input", updateStyleCounter);
  document
    .getElementById("custom-reply-prompt")
    .addEventListener("input", updateCustomPromptCounter);

  document.querySelectorAll("#niche-pills button").forEach((button) => {
    button.addEventListener("click", () => {
      button.classList.toggle("active");
    });
  });

  document.querySelectorAll(".tone").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tone").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
    });
  });
}

async function saveProviderSelection(provider) {
  try {
    const response = await sendMessage("SAVE_SETTINGS", { provider });
    state.settings = response.settings;
  } catch (error) {
    setError(error.message || "Could not save provider selection.");
  }
}

function bindProviderInputs() {
  document.querySelectorAll('input[name="provider"]').forEach((radio) => {
    radio.addEventListener("change", async () => {
      const provider = radio.value;
      setCardSelection(provider);
      await saveProviderSelection(provider);
    });
  });

  document.querySelectorAll("[data-provider-card]").forEach((card) => {
    card.addEventListener("click", (event) => {
      const target = event.target;
      if (target instanceof Element && target.closest("input,select,button,textarea")) {
        return;
      }

      const provider = card.dataset.providerCard;
      const radio = document.querySelector(`input[name="provider"][value="${provider}"]`);
      if (radio instanceof HTMLInputElement) {
        radio.checked = true;
        radio.dispatchEvent(new Event("change"));
      }
    });
  });

  document.querySelectorAll("[data-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const provider = button.dataset.toggle;
      const input = document.getElementById(`${provider}-key`);
      input.type = input.type === "password" ? "text" : "password";
    });
  });

  document.querySelectorAll("[data-signup]").forEach((button) => {
    button.addEventListener("click", () => {
      const provider = button.dataset.signup;
      const url = provider === "nvidia" ? "https://build.nvidia.com" : "https://console.groq.com";
      chrome.tabs.create({ url });
    });
  });

  document.querySelectorAll("[data-test]").forEach((button) => {
    button.addEventListener("click", async () => {
      const provider = button.dataset.test;
      await testConnection(provider);
    });
  });
}

function populateModelSelect(provider) {
  const meta = state.providerMetadata.find((item) => item.id === provider);
  const select = document.getElementById(`${provider}-model`);
  const custom = document.getElementById(`${provider}-model-custom`);
  const activeModel = state.settings[getModelField(provider)] || "";

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

  if (activeModel && !options.includes(activeModel)) {
    select.value = "__custom__";
    custom.classList.remove("hidden");
    custom.value = activeModel;
  } else {
    select.value = activeModel || options[0] || "__custom__";
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

    try {
      const field = getModelField(provider);
      const response = await sendMessage("SAVE_SETTINGS", { [field]: select.value });
      state.settings = response.settings;
    } catch (error) {
      setError(error.message || "Could not save model.");
    }
  });

  custom.addEventListener("change", async () => {
    const value = custom.value.trim();
    if (!value) {
      return;
    }

    try {
      const field = getModelField(provider);
      const response = await sendMessage("SAVE_SETTINGS", { [field]: value });
      state.settings = response.settings;
    } catch (error) {
      setError(error.message || "Could not save custom model.");
    }
  });
}

function fillFromState() {
  const persona = state.persona;

  document.getElementById("name").value = persona.name || "";
  document.getElementById("handle").value = persona.handle || "";
  document.getElementById("background").value = persona.background || "";
  document.getElementById("writing-style").value = persona.writingStyle || "";
  updateStyleCounter();
  document.getElementById("custom-reply-prompt").value = persona.customReplyPrompt || "";
  updateCustomPromptCounter();

  document.querySelectorAll("#niche-pills button").forEach((button) => {
    button.classList.toggle("active", (persona.niche || []).includes(button.dataset.value));
  });

  document.querySelectorAll(".tone").forEach((button) => {
    button.classList.toggle("active", button.dataset.tone === persona.tone);
  });

  const provider = state.settings.provider || "groq";
  const radio = document.querySelector(`input[name="provider"][value="${provider}"]`);
  if (radio instanceof HTMLInputElement) {
    radio.checked = true;
  }
  setCardSelection(provider);

  if (state.settings.groqApiKey) {
    document.getElementById("groq-key").placeholder = `Stored: ••••••${state.settings.groqApiKey.slice(-4)}`;
  }

  if (state.settings.nvidiaApiKey) {
    document.getElementById("nvidia-key").placeholder = `Stored: ••••••${state.settings.nvidiaApiKey.slice(-4)}`;
  }
}

async function testConnection(provider) {
  const line = document.getElementById(`${provider}-test-line`);
  const keyInput = document.getElementById(`${provider}-key`);
  const apiKey = keyInput.value.trim();
  const model = currentModel(provider);

  line.className = "test-line loading";
  line.innerHTML = '<span class="mini-spinner"></span>Testing connection...';

  try {
    const field = getModelField(provider);
    const keyField = getKeyField(provider);

    const savePayload = {
      provider,
      [field]: model
    };

    if (apiKey) {
      savePayload[keyField] = apiKey;
    }

    const saveResponse = await sendMessage("SAVE_SETTINGS", savePayload);
    state.settings = saveResponse.settings;

    await sendMessage("TEST_CONNECTION", {
      provider,
      apiKey,
      model
    });

    line.className = "test-line success";
    line.textContent = "✓ Connected! Ready to use.";

    state.testedProviders[provider] = true;
    await sendMessage("SAVE_ONBOARDING", { connectionVerified: provider === selectedProvider() });

    keyInput.value = "";
    const stored = state.settings[keyField] || "";
    if (stored) {
      keyInput.placeholder = `Stored: ••••••${stored.slice(-4)}`;
    }
  } catch (error) {
    line.className = "test-line error";
    line.textContent = `✕ ${error.apiMessage || error.message}`;
  }
}

async function saveProfileAndSettings(allowWithoutKey = false) {
  setError("");

  const provider = selectedProvider();
  const keyField = getKeyField(provider);
  const modelField = getModelField(provider);

  const model = currentModel(provider);
  if (!model) {
    setError("Select a model for the selected provider.");
    return;
  }

  const providerKeyInput = document.getElementById(`${provider}-key`).value.trim();
  const existingKey = state.settings[keyField] || "";

  if (!allowWithoutKey && !providerKeyInput && !existingKey) {
    setError("Paste an API key for the selected provider, or use 'Finish without test'.");
    return;
  }

  const personaPayload = {
    name: document.getElementById("name").value.trim(),
    handle: document.getElementById("handle").value.trim().replace(/^@+/, ""),
    background: document.getElementById("background").value.trim(),
    niche: selectedNiches(),
    tone: selectedTone(),
    writingStyle: document.getElementById("writing-style").value.trim(),
    customReplyPrompt: document.getElementById("custom-reply-prompt").value.trim()
  };

  const settingsPayload = {
    provider,
    [modelField]: model
  };

  if (providerKeyInput) {
    settingsPayload[keyField] = providerKeyInput;
  }

  try {
    const personaResponse = await sendMessage("SAVE_PERSONA", personaPayload);
    state.persona = personaResponse.persona;

    const settingsResponse = await sendMessage("SAVE_SETTINGS", settingsPayload);
    state.settings = settingsResponse.settings;

    await sendMessage("SAVE_ONBOARDING", {
      completed: true,
      step: 1,
      connectionVerified: Boolean(state.testedProviders[provider])
    });

    showCompletion();
  } catch (error) {
    setError(error.message || "Could not finish setup.");
  }
}

function showCompletion() {
  document.getElementById("action-bar").classList.add("hidden");
  document.getElementById("completion").classList.remove("hidden");
  document.getElementById("completion").scrollIntoView({ behavior: "smooth", block: "center" });
}

function bindActions() {
  document.getElementById("save-btn").addEventListener("click", async () => {
    await saveProfileAndSettings(false);
  });

  document.getElementById("skip-btn").addEventListener("click", async () => {
    await saveProfileAndSettings(true);
  });

  document.getElementById("open-x-btn").addEventListener("click", () => {
    chrome.tabs.create({ url: "https://x.com" });
  });
}

async function loadState() {
  const response = await sendMessage("GET_STATE");
  state.persona = response.persona;
  state.settings = response.settings;
  state.providerMetadata = response.providerMetadata || [];

  if (response.onboarding?.connectionVerified) {
    const provider = response.settings?.provider || "groq";
    state.testedProviders[provider] = true;
  }
}

(async function init() {
  try {
    await loadState();
    bindVoiceInputs();
    bindProviderInputs();
    populateModelSelect("groq");
    populateModelSelect("nvidia");
    fillFromState();
    bindActions();
  } catch (error) {
    setError(error.message || "Failed to initialize setup.");
  }
})();
