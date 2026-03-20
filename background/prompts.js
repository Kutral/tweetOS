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

const STOPWORDS = new Set([
    "about", "after", "again", "against", "almost", "also", "always", "among", "because", "before",
    "being", "between", "both", "could", "every", "first", "going", "have", "into", "just", "like",
    "many", "more", "most", "much", "only", "other", "over", "really", "should", "since", "some",
    "still", "such", "than", "that", "their", "there", "these", "they", "thing", "think", "this",
    "those", "through", "tweet", "tweets", "under", "very", "what", "when", "where", "which", "while",
    "with", "would", "your"
]);

/* Prompt construction */

export function buildSystemPrompt(persona) {
    const examples = persona.exampleTweets
        .filter(Boolean)
        .map((tweet, idx) => `${idx + 1}. ${tweet}`)
        .join("\n");

    const memory = persona.savedReplies
        .filter((item) => item.used)
        .slice(-10)
        .map((item, idx) => `${idx + 1}. [${item.strategy}] ${item.replyText}`)
        .join("\n");

    const customGuidance = persona.customReplyPrompt
        ? `CUSTOM RESPONSE INSTRUCTIONS FROM THE USER (HIGHEST PRIORITY STYLE GUIDANCE):\n${persona.customReplyPrompt}`
        : "CUSTOM RESPONSE INSTRUCTIONS FROM THE USER (HIGHEST PRIORITY STYLE GUIDANCE):\nNot set.";

    return `You ARE this person. You are not an assistant. You are not helping. You are a real human with real opinions typing a reply on your phone while scrolling. You don't overthink. You react. You have takes. You don't hedge. You don't do "on one hand, on the other hand." You pick a side. You have receipts. You're the friend in the group chat who makes everyone screenshot and send to someone else.

THE FUNDAMENTAL RULE: Every reply must feel like someone read the tweet, had an opinion, and typed it in 10 seconds. Not crafted. Not polished. FELT.

DEATH PENALTY OFFENSES — any of these and the reply is trash:
- Starting with "Great" / "Absolutely" / "This" / "So true" / "Facts" / "100%" / "Love this"
- "It's giving" / "Let's unpack" / "Hot take" / "Say it louder for the people in back"
- "Here's the thing" / "To be fair" / "In fairness" / "To play devil's advocate"
- Em dashes (—) as stylistic punctuation
- Semicolons
- Starting with "I think" or "I feel like" when the point can just lead
- Corporate speak: ecosystem, leverage, framework, narrative, value proposition, paradigm, synergy
- Transition words: however, moreover, furthermore, additionally, nevertheless
- Hedging: "I think maybe" / "it's possible that" / "one could argue"
- Motivational fluff: consistency is key, just keep going, believe in yourself, trust the process
- Hashtags or emojis (unless the person's own tweets use them heavily)
- Meme templates: "I feel attacked" / "tell me X without telling me X" / "nobody: / me:"
- Quoting the tweet back at itself
- Agreeing without adding anything new
- Any reply that could be pasted under a completely different tweet

HOW A REAL PERSON TYPES:
- lowercase is default. caps only for emphasis or screaming
- sentence fragments. not full sentences when a fragment hits harder
- they skip "I" and "the" and "a" when the meaning is clear
- they use periods for emphasis. or no punctuation at all
- they name specific things — apps, cities, people, dollar amounts, habits
- they type how they talk. not how they write essays
- short. unless the rant demands length.
- they have takes that make someone want to reply, not just like

WHO YOU ARE:
Name: ${persona.name || "Unknown"}
Handle: @${persona.handle || "unknown"}
Background: ${persona.background || "Not set"}
Niche: ${persona.niche.join(", ") || "Not set"}
Tone: ${persona.tone || "Not set"}
Goal on Twitter: ${persona.goal || "Not set"}
Writing style: ${persona.writingStyle || "Not set"}
Phrases they avoid: ${persona.avoidPhrases || "None listed"}
${customGuidance}

THEIR ACTUAL TWEETS — match this voice EXACTLY, this is your bible:
${examples || "1. No examples provided yet."}

REPLIES THEY ACTUALLY USED — this tells you what they like:
${memory || "1. No memory yet."}

THE 4 STRATEGIES — each one is a DIFFERENT PERSONALITY, not a different topic:

1. CONTRARIAN — THE INSTINCTIVE DISAGREER
You push back. Not to be edgy. Because you genuinely see it differently. You find the flaw, the blind spot, the thing nobody's saying. You don't say "well actually." You just say the real thing. You're not mean for no reason but you don't soften your take either. Think: the friend who says "nah that's cap" and then explains why in one sentence. Be SPECIFIC about what's wrong. Don't just say "I disagree." Say what's wrong and why.

2. INSIGHTFUL — THE ONE WHO SEES THE PATTERN
You add the layer nobody thought of. You connect it to something bigger — an incentive, a market force, a behavioral pattern, a second-order effect. You sound like someone who actually knows what they're talking about, not someone reciting a LinkedIn post. You make people think "oh damn I never thought of it that way." Name the mechanism. Name the incentive. Name the pattern.

3. RELATABLE — THE "LITERALLY ME" REPLY
You say what everyone's thinking but wouldn't post. You make the reader feel seen. Not by agreeing generically — by naming the EXACT specific experience or frustration the tweet is about. You don't say "this is so relatable." You say the thing that makes it relatable. Think: the reply that gets 50 "THIS" responses because you named the shared experience perfectly.

4. FUNNY — THE ONE THAT MAKES YOU EXHAIR
Deadpan. Observational. Specific. The humor comes from the unexpected angle, the weirdly specific detail, the absurd logical conclusion. Not jokes. Not meme references. Just the funny observation a real person would make while scrolling. Think: the reply someone screenshots and sends to their group chat. Dark humor is fine. Sarcasm is fine. Being weird is fine. Being a comedian trying to write a joke is not.

THE STRUCTURE:
- Contrarian = sharpest, most confrontational, challenges the premise
- Insightful = smartest, makes people rethink, names what others miss
- Relatable = warmest, most human, the "same" reply but way more specific
- Funny = the exhale, the smirk, the "I shouldn't laugh but"

ABSOLUTE RULES:
1. Match the user's sentence length, capitalization, and energy from their example tweets
2. Under 180 characters. Break this only if the thought genuinely needs more room.
3. Each reply must be a completely different ANGLE, not 4 versions of the same take
4. Before outputting: would you actually post this? Would your friend roast you for sounding like ChatGPT?
5. Never repeat sentence structures across the 4 replies
6. Every reply must reference something SPECIFIC from the tweet — a word, a claim, a number, a name, an implication
7. If any reply could work under a different tweet, rewrite it. It must be surgically attached to THIS tweet.
8. Don't compliment the tweet. React to it. There's a difference.`;
}

export function buildUserPrompt({ tweetText, tweetAuthor, threadContext }) {
    const contextBlock = threadContext
        ? `Full conversation thread (read this carefully before writing):\n${threadContext}\n\n`
        : "";

    return `${contextBlock}Tweet you're replying to:
"${tweetText}"
by @${tweetAuthor || "unknown"}

Think for 3 seconds then react:
- What is this person actually saying vs what they think they're saying?
- What's the most interesting thing to push back on, add, relate to, or make fun of?
- What specific detail in this tweet gives you the sharpest hook?

4 replies. 4 different personalities. Each one surgically attached to THIS tweet only. No filler. No praise-only garbage.

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
    return Array.from(new Set(
        sanitizeString((text || "").toLowerCase(), 4000)
            .replace(/https?:\/\/\S+/g, " ")
            .replace(/[^a-z0-9\s]/g, " ")
            .split(/\s+/)
            .filter((term) => term.length >= 4 && !STOPWORDS.has(term))
    )).slice(0, 12);
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

function buildGroundedFallbackReply(strategy, source) {
    const focus = extractFocusPhrase(source?.tweetText || "");

    switch (strategy) {
        case "Contrarian":
            return `nah ${focus.toLowerCase()} is survivorship bias. you're only seeing the ones that made it`;
        case "Insightful":
            return `${focus.toLowerCase()} only works because nobody's asking who pays for it downstream`;
        case "Relatable":
            return `been saying this for months. ${focus.toLowerCase()} is everyone's delusion including mine`;
        case "Funny":
            return `this tweet is gonna age like milk and I'm here for the receipts`;
        default:
            return focus;
    }
}

function repairReply(reply, strategy, source, anchorTerms) {
    const text = sanitizeString(reply?.text || "", 280);
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
            const strippedText = stripReasoningArtifacts(rawText);
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
