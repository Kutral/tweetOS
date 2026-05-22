import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

import {
  ensureExactlyFourReplies,
  parseRepliesFromContent
} from "../background/prompts.js";

async function loadScraperSandbox(pathname = "/home") {
  const source = await readFile(new URL("../content/scraper.js", import.meta.url), "utf8");
  const sandbox = {
    URL,
    document: {
      querySelectorAll() {
        return [];
      }
    },
    location: {
      pathname
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox;
}

function fakeTweet({ text, handle = "person", name = "Person" }) {
  return {
    innerText: text,
    querySelector(selector) {
      if (selector === '[data-testid="tweetText"]') {
        return { textContent: text };
      }
      if (selector === 'a[href*="/status/"]') {
        return { href: `https://x.com/${handle}/status/123` };
      }
      if (selector === 'div[data-testid="User-Name"] span:not([aria-hidden="true"])') {
        return { textContent: name };
      }
      return null;
    }
  };
}

test("timeline pages do not treat unrelated earlier posts as thread context", async () => {
  const sandbox = await loadScraperSandbox("/home");
  const unrelated = fakeTweet({
    text: "airport coffee should qualify as a financial crime",
    handle: "mira"
  });
  const target = fakeTweet({
    text: "AI wrappers are not startups unless distribution is the moat",
    handle: "dev"
  });
  sandbox.document.querySelectorAll = () => [unrelated, target];

  assert.equal(sandbox.findThreadContext(target), "");
});

test("status pages keep real parent tweets with handles", async () => {
  const sandbox = await loadScraperSandbox("/dev/status/123");
  const parent = fakeTweet({
    text: "Most SaaS products are just spreadsheets with auth",
    handle: "founder"
  });
  const target = fakeTweet({
    text: "The hard part is distribution, not CRUD",
    handle: "dev"
  });
  sandbox.document.querySelectorAll = () => [parent, target];

  assert.equal(
    sandbox.findThreadContext(target),
    "@founder: Most SaaS products are just spreadsheets with auth"
  );
});

test("line fallback parsing removes visible strategy labels", () => {
  const replies = parseRepliesFromContent(`
1. Contrarian: distribution is the part nobody wants to price in
2. Insightful: the moat is usually boring sales motion, not the wrapper
3. Relatable: everyone learns this right after the landing page gets quiet
4. Funny: another wrapper discovering invoices exist
`);

  assert.equal(replies.length, 4);
  assert.deepEqual(
    replies.map((reply) => reply.strategy),
    ["Contrarian", "Insightful", "Relatable", "Funny"]
  );
  assert.ok(replies.every((reply) => !/^(contrarian|insightful|relatable|funny):/i.test(reply.text)));
});

test("empty or generic provider output falls back to source-specific replies without canned AI tells", () => {
  const source = {
    tweetText: "AI wrappers are not startups unless distribution is the moat",
    tweetAuthor: "dev",
    threadContext: ""
  };
  const replies = ensureExactlyFourReplies([], source);
  const joined = replies.map((reply) => reply.text).join("\n").toLowerCase();

  assert.equal(replies.length, 4);
  assert.ok(!/survivorship bias|downstream|age like milk|receipts/.test(joined));
  assert.ok(replies.every((reply) => /ai|wrapper|startup|distribution|moat/.test(reply.text.toLowerCase())));
});

test("repair removes common AI-style openers instead of trusting prompt compliance", () => {
  const source = {
    tweetText: "AI wrappers are not startups unless distribution is the moat",
    tweetAuthor: "dev",
    threadContext: ""
  };
  const replies = ensureExactlyFourReplies([
    { strategy: "Contrarian", text: "This is where distribution actually matters." },
    { strategy: "Insightful", text: "Great point, the moat is the motion." },
    { strategy: "Relatable", text: "This is so relatable for anyone shipping wrappers." },
    { strategy: "Funny", text: "This is giving another wrapper discovering invoices." }
  ], source);

  assert.ok(replies.every((reply) => !/^(this is|great point|this is so|this is giving)\b/i.test(reply.text)));
});
