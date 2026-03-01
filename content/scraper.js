/* ───────────────────────────────────────────
   content/scraper.js
   Tweet data extraction: text, author, thread context
   ─────────────────────────────────────────── */

/* eslint-disable no-unused-vars */
/* Depends on: content/state.js (no direct references needed) */

function findTweetText(article) {
    const textNode = article.querySelector('[data-testid="tweetText"]');
    if (textNode) {
        const value = textNode.textContent?.trim() || "";
        if (value) {
            return value;
        }
    }

    const fallback = article.innerText?.split("\n").slice(0, 8).join(" ").trim() || "";
    return fallback.slice(0, 4000);
}

function findTweetAuthor(article) {
    const permalink = article.querySelector('a[href*="/status/"]');
    let handle = "";

    if (permalink) {
        try {
            const url = new URL(permalink.href);
            const part = url.pathname.split("/").filter(Boolean)[0] || "";
            handle = part.replace(/^@+/, "");
        } catch {
            handle = "";
        }
    }

    const nameNode = article.querySelector('div[data-testid="User-Name"] span:not([aria-hidden="true"])');
    const name = nameNode?.textContent?.trim() || handle;
    return { handle, name };
}

/**
 * Gathers full thread context by reading ALL preceding tweets in the conversation.
 * When replying to a reply or a thread, this ensures the AI gets complete context
 * rather than just the directly selected tweet.
 *
 * Strategy:
 * - Finds all visible tweet articles on the page
 * - Collects every tweet BEFORE the target article (these are parent/ancestor tweets)
 * - Caps at 10 parents to avoid overloading the LLM context
 * - Joins them with " → " to show the conversation flow clearly
 */
function findThreadContext(article) {
    const all = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
    const idx = all.indexOf(article);
    if (idx <= 0) {
        return "";
    }

    // Gather ALL preceding tweets (up to 10) — these are the thread parents
    const parents = all
        .slice(0, idx)
        .map((node) => findTweetText(node))
        .filter(Boolean)
        .slice(-10);

    if (!parents.length) {
        return "";
    }

    // Use arrow notation to show conversation flow: parent1 → parent2 → ... → target
    return parents.join(" → ");
}

function getActionToolbar(article) {
    const groups = Array.from(article.querySelectorAll('div[role="group"]'));
    if (!groups.length) {
        return null;
    }
    return groups[groups.length - 1];
}
