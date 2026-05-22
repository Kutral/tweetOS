import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

function createSelect() {
  return {
    options: [],
    value: "",
    innerHTML: "",
    classList: {
      add() {},
      remove() {}
    },
    addEventListener() {},
    appendChild(option) {
      this.options.push(option);
      if (!this.value) {
        this.value = option.value;
      }
    }
  };
}

function createInput() {
  return {
    value: "",
    classList: {
      add() {},
      remove() {}
    },
    addEventListener() {},
    focus() {}
  };
}

test("popup model select falls back to bundled Groq models when provider metadata is missing", async () => {
  const source = await readFile(new URL("../popup/popup.js", import.meta.url), "utf8");
  const groqSelect = createSelect();
  const groqCustom = createInput();

  const elements = new Map([
    ["groq-model-select", groqSelect],
    ["groq-model-custom", groqCustom]
  ]);

  const sandbox = {
    console,
    setTimeout() {},
    window: {
      close() {},
      location: {
        reload() {}
      }
    },
    document: {
      querySelectorAll() {
        return [];
      },
      getElementById(id) {
        return elements.get(id) || null;
      },
      createElement() {
        return { value: "", textContent: "" };
      }
    }
  };

  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  vm.runInContext(`
    state.settings = { provider: "groq", groqModel: "llama-3.3-70b-versatile" };
    state.providerMetadata = [];
    populateModelSelect("groq");
  `, sandbox);

  assert.ok(groqSelect.options.length > 1);
  assert.equal(groqSelect.options[0].value, "llama-3.3-70b-versatile");
});

test("dashboard model select also uses bundled fallback models", async () => {
  const source = await readFile(new URL("../popup/popup.js", import.meta.url), "utf8");
  const providerSelect = createSelect();
  providerSelect.value = "groq";
  const modelSelect = createSelect();
  const modelCustom = createInput();

  const elements = new Map([
    ["dash-provider-selector", providerSelect],
    ["dash-model-select", modelSelect],
    ["dash-model-custom", modelCustom]
  ]);

  const sandbox = {
    console,
    setTimeout() {},
    window: {
      close() {},
      location: {
        reload() {}
      }
    },
    document: {
      querySelectorAll() {
        return [];
      },
      getElementById(id) {
        return elements.get(id) || null;
      },
      createElement() {
        return { value: "", textContent: "" };
      }
    }
  };

  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  vm.runInContext(`
    state.settings = { provider: "groq", groqModel: "llama-3.3-70b-versatile" };
    state.providerMetadata = [];
    populateDashboardModelControls();
  `, sandbox);

  assert.ok(modelSelect.options.length > 1);
  assert.equal(modelSelect.options[0].value, "llama-3.3-70b-versatile");
});
