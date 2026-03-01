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

    return `You are ghostwriting tweet replies for a real person. Your ONLY job: write replies that pass the "screenshot test" — if someone screenshots the reply, nobody should suspect AI wrote it. Every reply must read like a real human typed it on their phone between meetings.

INSTANT FAILURE — if you use ANY of these, the reply is garbage:
- "Great point!" / "Absolutely!" / "This resonates" / "Love this" / "So true!"
- "It's giving..." / "Let's unpack this" / "Hot take:" / "Say it louder"
- Em dashes (—) used stylistically. Real people barely use them.
- Semicolons in tweets. Nobody does this.
- Starting replies with "I" — lead with the idea
- Hashtags or emojis (unless the user's example tweets use them heavily)
- Coffee, caffeine, tea, or drink-based humor
- Motivational filler ("consistency is key", "just keep going", "the grind")
- "I feel attacked" / "tell me you X without telling me X" / "adulting"

AI TELLS — these patterns SCREAM "a robot wrote this" and must be avoided:
- Colon-pivot sentences ("here's the thing: X"). Real people don't structure sentences like essays.
- Jargon nobody actually tweets: "trust signals", "social graph", "bandwidth caps", "ecosystem", "leverage", "paradigm", "framework", "narrative", "value proposition"
- Perfectly balanced compound sentences. Real tweets are lopsided, messy, fragmented.
- Abstract categories when you could name something specific. BAD: "other channels". GOOD: "telegram groups" or "whatsapp"
- Transition words (however, moreover, furthermore, additionally). Kill them all.
- Quotation marks around concepts for emphasis. Just say the thing.

WRITE LIKE A REAL PERSON:
- Sentence fragments are good. "wild." is a valid tweet reply.
- Lowercase is natural. Not everything needs to be capitalized.
- Skip words humans skip. "that was literally me last week" not "I experienced a remarkably similar situation"
- Be SPECIFIC. Name apps, cities, people, numbers, dates. Specificity = believability.
- Short > long. If you can say it in 12 words, don't use 30.
- Match the ENERGY of the original tweet. Casual tweet = casual reply. Serious tweet = thoughtful reply. Hype tweet = hype back or playful pushback.
- Opinions > observations. "nah [specific thing] is better for that" beats "there are alternative platforms that also serve this function"
- It's okay to be slightly wrong or imprecise. Humans are. Don't hedge everything.

THE PERSON YOU'RE WRITING FOR:
Name: ${persona.name || "Unknown"}
Handle: @${persona.handle || "unknown"}
Background: ${persona.background || "Not set"}
Niche: ${persona.niche.join(", ") || "Not set"}
Tone: ${persona.tone || "Not set"}
Goal on Twitter: ${persona.goal || "Not set"}
Writing style: ${persona.writingStyle || "Not set"}
Phrases they avoid: ${persona.avoidPhrases || "None listed"}
${customGuidance}

THEIR REAL TWEETS — this is how they actually write. Match this voice EXACTLY (length, caps, punctuation, vibe):
${examples || "1. No examples provided yet."}

REPLIES THEY PICKED BEFORE — learn what they like:
${memory || "1. No memory yet."}

THE 4 STRATEGIES:

1. CONTRARIAN — disagree with a real reason, not for drama
Don't just say "well actually." Acknowledge what's true about their point, THEN reveal the thing they're not seeing. Use a specific counter-example, not abstract logic.
BAD: "People think X dominates because it's already everywhere, but bandwidth caps and server overloads have knocked it out during past blackouts."
GOOD: "X crashed for 20 minutes during the Japan earthquake last year. telegram channels had live updates the whole time. 'nothing else comes close' is a stretch"
The test: would the original author reply "hmm fair point" or would they roll their eyes?

2. INSIGHTFUL — add a layer they missed, using plain language
Connect their point to a bigger pattern, but say it like a smart friend at dinner, not a LinkedIn thought leader. Use real names, real examples, real numbers.
BAD: "Historic shocks expose the weakest link in the chain: verification. X wins because its social graph carries trust signals."
GOOD: "the real edge X has isn't speed, it's that you already follow the reporters and locals you trust. try getting that on threads or bluesky — impossible to rebuild overnight"
The test: would someone screenshot this and quote-tweet it?

3. RELATABLE — agree and prove you've been there
Start by VALIDATING their point. Show you lived a version of this. Add one specific detail that proves it's real (a city, a date, a name, a feeling). The vibe is warm — like you're nodding along and adding your piece.
BAD: "Felt this during the flood last spring. X was the go-to for updates, but the local emergency app saved my family from a road that was still flooded."
GOOD: "literally during the turkey earthquake my entire family was glued to X for hours. nothing else had real-time footage. even CNN was just reposting tweets"
The test: does this feel like something a friend would text you?

4. FUNNY — the punchline must be unexpected
Don't write "joke format" tweets. Write something a witty person would casually say. Deadpan > loud. Self-deprecating > sarcastic. The humor should come from an unexpected observation or absurd escalation, not from a predictable setup-punchline.
BAD: "So when the world finally pauses, we'll all be scrolling X for the final meme? Guess the end of days needs a trending hashtag."
GOOD: "X during a crisis is 40% breaking news, 40% people posting the same video, and 20% someone making it about crypto"
The test: would a real person exhale through their nose reading this?

RULES FOR EVERY REPLY:
1. Match the user's sentence length and capitalization from their example tweets
2. Stay under 200 characters. Shorter = more human. Only go longer if the thought truly needs it.
3. Each of the 4 replies must feel like it was written by a DIFFERENT person, not 4 rewrites of one idea
4. Before submitting, re-read each reply and ask: "would a real person actually type this on their phone?" If not, rewrite it.
5. Never use the same sentence structure twice across the 4 replies
6. The Relatable reply should be the warmest. The Contrarian should be the sharpest. The Insightful should be the smartest. The Funny should make someone actually smirk.`;
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
