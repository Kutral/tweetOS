/*
   background/prompts.js
   Prompt building, reply parsing, response extraction
*/

import {
    STRATEGIES, REQUIRED_REPLY_STRATEGIES, FUNNY_BLOCKLIST,
    sanitizeString
} from "./providers.js";

const GENERIC_REPLY_PATTERNS = [
    /^(great point|good point|fair point|solid point|so true|true that|facts|exactly|100%|this resonates|love this|well said|accurate|nailed it|couldn't agree more)[.!]*$/i,
    /^(absolutely|totally|agreed|real|yep|yeah)[.!]*$/i,
    /^(this|this is so (true|real|accurate|relatable))[.!]*$/i,
    /^(couldn't have said it better|spot on|dead on|preach|say it louder)[.!]*$/i,
    /^(on point|big facts|real talk|no cap|fr fr|fr)[.!]*$/i
];

const AI_OPENER_PATTERNS = [
    /^great point[,!.]?\s*/i,
    /^good point[,!.]?\s*/i,
    /^fair point[,!.]?\s*/i,
    /^solid point[,!.]?\s*/i,
    /^absolutely[,!.]?\s*/i,
    /^totally[,!.]?\s*/i,
    /^this is where\s+/i,
    /^this is giving\s+/i,
    /^this is so\s+\w+\s+(?:for|because|when|that)?\s*/i,
    /^this is\s+/i
];

const STOPWORDS = new Set([
    "about", "after", "again", "against", "almost", "also", "always", "among", "because", "before",
    "being", "between", "both", "could", "every", "first", "going", "have", "into", "just", "like",
    "many", "more", "most", "much", "only", "other", "over", "really", "should", "since", "some",
    "still", "such", "than", "that", "their", "there", "these", "they", "thing", "think", "this",
    "those", "through", "tweet", "tweets", "under", "very", "what", "when", "where", "which", "while",
    "with", "would", "your", "made", "spent", "hours", "products"
]);

/* Prompt construction */

export function buildSystemPrompt(persona) {
    const examples = persona.exampleTweets
        .filter(Boolean)
        .slice(0, 3)
        .map((tweet, idx) => `${idx + 1}. ${sanitizeString(tweet, 120)}`)
        .join("\n");

    const memory = persona.savedReplies
        .filter((item) => item.used)
        .slice(-3)
        .map((item, idx) => `${idx + 1}. [${item.strategy}] ${sanitizeString(item.replyText, 120)}`)
        .join("\n");

    const customGuidance = persona.customReplyPrompt
        ? `CUSTOM RESPONSE INSTRUCTIONS:\n${sanitizeString(persona.customReplyPrompt, 320)}`
        : "CUSTOM RESPONSE INSTRUCTIONS FROM THE USER (HIGHEST PRIORITY STYLE GUIDANCE):\nNot set.";

    return `Write short X/Twitter reply drafts for this account. Sound like a quick human reaction: specific, opinionated, slightly uneven, never assistant-like.

Rules:
- Every reply needs a concrete hook from the tweet/thread.
- Prefer one narrow observation over a broad lesson.
- 7 to 22 words by default.
- Plain punctuation. No em dashes, semicolons, hashtags, emoji, or corporate words.
- Do not start with: great point, absolutely, this, this is, so true, facts, love this.
- Do not use: let's unpack, hot take, here's the thing, to be fair, game changer, resonates, delve, leverage.
- Do not quote the tweet back. React to the implication.

WHO YOU ARE:
Name: ${persona.name || "Unknown"}
Handle: @${persona.handle || "unknown"}
Background: ${sanitizeString(persona.background || "Not set", 120)}
Niche: ${persona.niche.join(", ") || "Not set"}
Tone: ${persona.tone || "Not set"}
Goal on Twitter: ${persona.goal || "Not set"}
Writing style: ${sanitizeString(persona.writingStyle || "Not set", 220)}
Phrases they avoid: ${sanitizeString(persona.avoidPhrases || "None listed", 160)}
${customGuidance}

THEIR ACTUAL TWEETS:
${examples || "1. No examples provided yet."}

REPLIES THEY ACTUALLY USED:
${memory || "1. No memory yet."}

THE 4 STRATEGIES:

1. CONTRARIAN: push back on the premise, cost, or incentive.

2. INSIGHTFUL: name the mechanism underneath it.

3. RELATABLE: name the lived annoyance. Do not say it is relatable.

4. FUNNY: deadpan or lightly absurd, anchored in the detail.

Final check: every reply must depend on this tweet specifically, use different first words, and sound postable after one edit.`;
}

export function buildUserPrompt({ tweetText, tweetAuthor, threadContext }) {
    const contextBlock = threadContext
        ? `Actual parent tweets in this thread:\n${threadContext}\n\n`
        : "";

    return `${contextBlock}Tweet you're replying to:
"${tweetText}"
by @${tweetAuthor || "unknown"}

Write 4 reply drafts. Use 4 different angles. Each draft must include a hook from the tweet or parent thread. No filler and no praise-only replies.

{
  "replies": [
    { "id": 1, "text": "reply here", "strategy": "Contrarian" },
    { "id": 2, "text": "reply here", "strategy": "Insightful" },
    { "id": 3, "text": "reply here", "strategy": "Relatable" },
    { "id": 4, "text": "reply here", "strategy": "Funny" }
  ]
}

Raw JSON only. No markdown. No fences. No explanation.`;
}

/* Response parsing */

export function safeJsonParse(text) {
    if (!text) {
        return null;
    }
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

export function extractCurlyJson(text) {
    if (!text) {
        return null;
    }
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
        return null;
    }
    return safeJsonParse(match[0]);
}

export function stripReasoningArtifacts(text) {
    if (!text || typeof text !== "string") {
        return "";
    }

    return text
        .replace(/<think>[\s\S]*?<\/think>/gi, "")
        .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();
}

export function polishFunnyReply(text) {
    if (!text) {
        return text;
    }

    const pattern = new RegExp(`\\b(?:${FUNNY_BLOCKLIST.join("|")})\\b`, "gi");
    const safeText = text.replace(pattern, "...").replace(/\s{2,}/g, " ").trim();
    return safeText || "keeping this playful";
}

function extractAnchorTerms(text) {
    const tokens = sanitizeString(text || "", 4000)
        .replace(/https?:\/\/\S+/g, " ")
        .replace(/[^a-zA-Z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(Boolean);

    const terms = [];
    tokens.forEach((token) => {
        const lower = token.toLowerCase();
        const isShortAcronym = /^[A-Z0-9]{2,5}$/.test(token);
        if ((lower.length >= 4 || isShortAcronym) && !STOPWORDS.has(lower)) {
            terms.push(lower);
        }
    });

    return Array.from(new Set(terms)).slice(0, 12);
}

function looksPraiseOnly(text) {
    const safe = sanitizeString(text || "", 280).toLowerCase();
    if (!safe) {
        return true;
    }
    return GENERIC_REPLY_PATTERNS.some((pattern) => pattern.test(safe));
}

function hasAnchor(text, anchorTerms) {
    const safe = sanitizeString((text || "").toLowerCase(), 400);
    if (!safe) {
        return false;
    }

    if (/\d/.test(safe)) {
        return true;
    }

    return anchorTerms.some((term) => safe.includes(term));
}

function extractFocusPhrase(text) {
    const cleaned = sanitizeString(text || "", 400)
        .replace(/https?:\/\/\S+/g, "")
        .replace(/\s+/g, " ")
        .trim();

    if (!cleaned) {
        return "that take";
    }

    const sentence = cleaned.split(/[.!?]/)[0].trim();
    const compact = sentence || cleaned;
    const words = compact.split(/\s+/).slice(0, 7);
    return words.join(" ").replace(/[,"']/g, "").trim() || "that take";
}

function extractTopicLabel(text) {
    const terms = extractAnchorTerms(text);
    if (!terms.length) {
        return extractFocusPhrase(text).toLowerCase();
    }

    const topicTerms = terms.slice(0, 2);
    return topicTerms.join(" ");
}

function buildGroundedFallbackReply(strategy, source) {
    const topic = extractTopicLabel(source?.tweetText || "");

    switch (strategy) {
        case "Contrarian":
            return `nah, the ${topic} angle is only half the story`;
        case "Insightful":
            return `the ${topic} angle is really about the incentive underneath`;
        case "Relatable":
            return `the ${topic} part is where the quick fix starts charging rent`;
        case "Funny":
            return `the ${topic} angle is doing unpaid overtime in this take`;
        default:
            return topic;
    }
}

function stripStrategyLabel(text) {
    return sanitizeString(text || "", 560)
        .replace(/^(?:contrarian|insightful|relatable|funny|bold|story|question)\s*[:\-]\s*/i, "")
        .trim();
}

function stripAiOpening(text) {
    const original = sanitizeString(text || "", 560);
    let cleaned = original;

    AI_OPENER_PATTERNS.some((pattern) => {
        if (!pattern.test(cleaned)) {
            return false;
        }
        cleaned = cleaned.replace(pattern, "").trim();
        return true;
    });

    return cleaned.length >= 6 ? cleaned : original;
}

function repairReply(reply, strategy, source, anchorTerms) {
    const text = sanitizeString(stripAiOpening(stripStrategyLabel(reply?.text || "")), 280);
    const strategyName = STRATEGIES.includes(strategy) ? strategy : "Insightful";

    if (!text || looksPraiseOnly(text) || !hasAnchor(text, anchorTerms)) {
        return {
            id: reply?.id || 0,
            strategy: strategyName,
            text: buildGroundedFallbackReply(strategyName, source)
        };
    }

    return {
        ...reply,
        strategy: strategyName,
        text
    };
}

function normalizeReplyObjects(items) {
    return items
        .map((item, idx) => {
            const rawText = sanitizeString(item?.text || item?.reply || item?.content || "", 560);
            const strippedText = stripAiOpening(stripStrategyLabel(stripReasoningArtifacts(rawText)));
            const strategy = STRATEGIES.includes(item?.strategy)
                ? item.strategy
                : REQUIRED_REPLY_STRATEGIES[idx] || STRATEGIES[idx % STRATEGIES.length];
            const text = strategy === "Funny" ? polishFunnyReply(strippedText) : strippedText;
            return {
                id: idx + 1,
                text,
                strategy
            };
        })
        .filter((item) => item.text)
        .slice(0, 4);
}

function fallbackRepliesFromLines(text) {
    if (!text) {
        return [];
    }
    const lines = text
        .split(/\r?\n/)
        .map((line) => stripReasoningArtifacts(line))
        .filter(Boolean)
        .map((line) => line.replace(/^[-*\d.\s]+/, ""))
        .map(stripStrategyLabel)
        .map(stripAiOpening)
        .map((line) => line.replace(/^\s*["']|["']\s*$/g, ""))
        .filter(Boolean)
        .slice(0, 4);

    return lines.map((line, idx) => {
        const strategy = REQUIRED_REPLY_STRATEGIES[idx] || STRATEGIES[idx % STRATEGIES.length];
        const cleanText = stripReasoningArtifacts(sanitizeString(line, 560));
        return {
            id: idx + 1,
            text: strategy === "Funny" ? polishFunnyReply(cleanText) : cleanText,
            strategy
        };
    });
}

export function parseRepliesFromContent(content) {
    if (!content || typeof content !== "string") {
        return [];
    }

    const cleanedContent = stripReasoningArtifacts(content);
    const parsedDirect = safeJsonParse(cleanedContent);
    if (parsedDirect?.replies && Array.isArray(parsedDirect.replies)) {
        return normalizeReplyObjects(parsedDirect.replies);
    }

    const parsedCurly = extractCurlyJson(cleanedContent);
    if (parsedCurly?.replies && Array.isArray(parsedCurly.replies)) {
        return normalizeReplyObjects(parsedCurly.replies);
    }

    return fallbackRepliesFromLines(cleanedContent);
}

export function ensureExactlyFourReplies(replies, source = {}) {
    const anchorTerms = extractAnchorTerms(`${source.tweetText || ""} ${source.threadContext || ""}`);
    const cleaned = normalizeReplyObjects(replies || []).map((reply, idx) =>
        repairReply(reply, REQUIRED_REPLY_STRATEGIES[idx] || reply.strategy, source, anchorTerms)
    );

    while (cleaned.length < 4) {
        const idx = cleaned.length;
        cleaned.push({
            id: idx + 1,
            text: buildGroundedFallbackReply(
                REQUIRED_REPLY_STRATEGIES[idx] || STRATEGIES[idx % STRATEGIES.length],
                source
            ),
            strategy: REQUIRED_REPLY_STRATEGIES[idx] || STRATEGIES[idx % STRATEGIES.length]
        });
    }

    return cleaned.slice(0, 4).map((item, idx) => ({
        ...item,
        id: idx + 1,
        strategy: REQUIRED_REPLY_STRATEGIES[idx] || item.strategy
    }));
}

export function extractContent(response) {
    return (
        sanitizeString(response?.choices?.[0]?.message?.content || "", 8000) ||
        sanitizeString(response?.choices?.[0]?.text || "", 8000) ||
        sanitizeString(response?.candidates?.[0]?.content?.parts?.[0]?.text || "", 8000)
    );
}
