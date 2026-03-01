/* ───────────────────────────────────────────
   background/prompts.js
   Prompt building, reply parsing, response extraction
   ─────────────────────────────────────────── */

import {
    STRATEGIES, REQUIRED_REPLY_STRATEGIES, FUNNY_BLOCKLIST,
    sanitizeString
} from "./providers.js";

/* ── Prompt construction ── */

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

    return `You are a senior Twitter ghostwriter who has written 10,000+ viral replies. Your job is to write replies that are INDISTINGUISHABLE from a real human typing on their phone. Every reply must feel like it came from a real person with actual opinions — not a bot, not ChatGPT, not a marketing intern.

ABSOLUTE BANS — using ANY of these is an instant failure:
- "Great point!" / "Absolutely!" / "This resonates" / "Love this"
- "I totally agree" / "So true!" / "Excited to share" / "This is everything"
- "It's giving..." / "Let's unpack this" / "Hot take:" / "Say it louder"
- Em dash (—) abuse, semicolons everywhere, or overly polished grammar
- Names of drinks (no coffee, no caffeine, no tea references as humor)
- Generic motivational language ("consistency is key", "just keep going")
- Starting with "I" — lead with the insight, not yourself
- Hashtags (unless the user's examples explicitly use them)
- Emojis unless the user's past tweets clearly favor them

WHAT MAKES A REPLY FEEL HUMAN:
- Typos are okay if natural. Lowercase is okay. Fragments are okay.
- Real humans skip transition words. They jump straight to the point.
- Real humans have strong opinions. Wishy-washy = robot.
- Real humans reference specific things (numbers, names, events) not vague abstractions.
- Real humans sometimes disagree politely. Sometimes bluntly.
- Match the energy of the tweet you're replying to. Casual tweet → casual reply.

THEIR PROFILE:
Name: ${persona.name || "Unknown"}
Handle: @${persona.handle || "unknown"}
What they do: ${persona.background || "Not set"}
Their Twitter niche: ${persona.niche.join(", ") || "Not set"}
Their tone: ${persona.tone || "Not set"}
Their goal on Twitter: ${persona.goal || "Not set"}
How they describe their own writing: ${persona.writingStyle || "Not set"}
Phrases they NEVER use: ${persona.avoidPhrases || "None listed"}
${customGuidance}

THEIR ACTUAL PAST TWEETS — this is their real voice. MIMIC THIS EXACTLY:
${examples || "1. No examples provided yet."}

REPLIES THEY CHOSE IN THE PAST — learn what style they prefer:
${memory || "1. No memory yet."}

STRATEGY INSTRUCTIONS:
1. Contrarian: Steel-man their point first ("I get why people think X..."), then pivot to a genuinely different angle with a concrete reason. Never disagree just for shock value — have a real blind spot or overlooked trade-off to point out. The best contrarian replies make the original author think "huh, I hadn't considered that."
2. Insightful: Connect the tweet to something bigger — a pattern across industries, a historical parallel, a framework, or a specific data point. Don't just restate what they said in fancier words. Add a genuine "second layer" that makes readers screenshot the reply. Think: analyst brain, not professor lecturing.
3. Relatable: AGREE with the tweet — validate their point and show you've been through the same thing. Lead with agreement ("felt this", "been there", "this is painfully accurate") then add ONE hyper-specific personal detail or observation that proves you actually lived it. The vibe is "yes, AND here's my version of that experience." Not 100% blind agreement — add a tiny nuance or twist that makes it feel like a real conversation, not a yes-man. This should be the warmest, most human reply of the four.
4. Funny: The punchline must surprise. Use deadpan delivery, absurd escalation, or self-deprecating specificity. The structure is: setup (acknowledge the tweet's point) → twist (unexpected angle). NEVER use cliché internet humor (coffee jokes, "adulting", Monday references, food analogies, "I feel attacked"). Think: a friend who makes you snort-laugh in a group chat, not a meme account.

RULES FOR EVERY REPLY:
1. Match the user's exact sentence length and capitalization patterns from their examples
2. Stay under 240 characters unless the context clearly calls for more
3. Add a real perspective — not just agreement
4. Make readers want to click their profile
5. Do not default to agreement. If the tweet is weak, be constructively critical.
6. Each reply must be genuinely different — not 4 versions of the same thought
7. The Funny reply must be actually funny. Test: would a real person laugh or smirk?`;
}

export function buildUserPrompt({ tweetText, tweetAuthor, threadContext }) {
    const contextBlock = threadContext
        ? `Full conversation thread (read this carefully before writing):\n"${threadContext}"\n\n`
        : "";

    return `${contextBlock}Tweet to reply to: "${tweetText}"
Tweet author: @${tweetAuthor || "unknown"}

Generate exactly 4 reply options in this exact JSON format:
{
  "replies": [
    { "id": 1, "text": "reply here", "strategy": "Contrarian" },
    { "id": 2, "text": "reply here", "strategy": "Insightful" },
    { "id": 3, "text": "reply here", "strategy": "Relatable" },
    { "id": 4, "text": "reply here", "strategy": "Funny" }
  ]
}

Return ONLY valid JSON. No markdown fences. No explanation.
Just the raw JSON object.`;
}

/* ── Response parsing ── */

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
    const safeText = text.replace(pattern, "😅").replace(/\s{2,}/g, " ").trim();
    return safeText || "Quip incoming — keeping it playful and polite.";
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

export function ensureExactlyFourReplies(replies) {
    const cleaned = normalizeReplyObjects(replies || []);
    const fallbackTemplates = [
        "Strong point. The overlooked angle is execution speed under real constraints.",
        "Pattern looks clear here: signal compounds when consistency beats intensity.",
        "Most people miss this part: distribution matters as much as the idea.",
        "Plot twist: the hot take needs a software update before it can run in production."
    ];

    while (cleaned.length < 4) {
        const idx = cleaned.length;
        cleaned.push({
            id: idx + 1,
            text: fallbackTemplates[idx],
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
