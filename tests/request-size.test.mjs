import assert from "node:assert/strict";
import test from "node:test";

import { parseApiError } from "../background/api.js";
import { buildSystemPrompt, buildUserPrompt } from "../background/prompts.js";

test("provider 413 maps to a retryable trimmed-context error", () => {
  const error = parseApiError(
    413,
    {},
    "Request Entity Too Large",
    { get: () => "" }
  );

  assert.equal(error.code, "request_too_large");
  assert.equal(error.message, "That tweet/thread is too large to send. I trimmed context; retry once.");
  assert.equal(error.apiMessage, "");
});

test("prompt builders cap persona, tweet, and thread size", () => {
  const persona = {
    name: "Tester",
    handle: "tester",
    background: "Builder",
    niche: ["SaaS"],
    tone: "Direct",
    goal: "Reply well",
    writingStyle: "x".repeat(5000),
    customReplyPrompt: "c".repeat(5000),
    avoidPhrases: "",
    exampleTweets: Array.from({ length: 5 }, () => "e".repeat(1000)),
    savedReplies: Array.from({ length: 20 }, (_, idx) => ({
      used: true,
      strategy: "Insightful",
      replyText: `${idx} ${"r".repeat(1000)}`
    }))
  };

  const systemPrompt = buildSystemPrompt(persona);
  const userPrompt = buildUserPrompt({
    tweetText: "t".repeat(900),
    tweetAuthor: "tester",
    threadContext: "p".repeat(1800)
  });

  assert.ok(systemPrompt.length < 6500);
  assert.ok(userPrompt.length < 3300);
});
