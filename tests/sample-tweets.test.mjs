import assert from "node:assert/strict";
import test from "node:test";

import { ensureExactlyFourReplies } from "../background/prompts.js";

const samples = [
  "Most SaaS products are just spreadsheets with auth",
  "I spent 3 hours debugging a CSS gap that was just line-height",
  "Founders keep optimizing onboarding before anyone wants the product",
  "India UPI made payments invisible, but refunds are still a spreadsheet problem"
];

const genericProviderReplies = [
  { strategy: "Contrarian", text: "Great point, this is where the real issue starts." },
  { strategy: "Insightful", text: "This is where the incentives become really important." },
  { strategy: "Relatable", text: "This is so relatable for anyone building products." },
  { strategy: "Funny", text: "This is giving another startup learning the hard way." }
];

test("sample tweets produce grounded drafts after repair", () => {
  for (const tweetText of samples) {
    const replies = ensureExactlyFourReplies(genericProviderReplies, {
      tweetText,
      tweetAuthor: "sample",
      threadContext: ""
    });

    assert.equal(replies.length, 4, tweetText);
    assert.ok(
      replies.every((reply) => !/^(great point|this is|this is where|this is so|this is giving)\b/i.test(reply.text)),
      tweetText
    );
    assert.ok(
      replies.every((reply) => reply.text.length <= 180),
      tweetText
    );
  }
});
