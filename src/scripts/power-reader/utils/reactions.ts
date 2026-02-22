/**
 * Reactions data ported from ForumMagnum
 * Includes scraping logic to keep reactions up-to-date
 */

import { getKey } from './storage';
import { Logger } from './logger';
import { isEAForumHost } from './forum';

export interface ReactionFilter {
    padding?: number;
    opacity?: number;
    saturate?: number;
    scale?: number;
    translateX?: number;
    translateY?: number;
}

export interface ReactionMetadata {
    name: string;
    label: string;
    svg: string;
    description?: string;
    searchTerms?: string[];
    filter?: ReactionFilter;
    deprecated?: boolean;
}

// Default filter values from ReactionIcon.tsx
export const DEFAULT_FILTER: ReactionFilter = {
    opacity: 1,
    saturate: 1,
    scale: 1,
    translateX: 0,
    translateY: 0
};



// Fallback reactions to use if scraping fails or is incomplete
export const BOOTSTRAP_REACTIONS: ReactionMetadata[] = [
    // Row 1
    { name: "agree", label: "Agreed", svg: "https://www.lesswrong.com/reactionImages/nounproject/check.svg" },
    { name: "disagree", label: "Disagree", svg: "https://www.lesswrong.com/reactionImages/nounproject/x.svg" },
    { name: "important", label: "Important", svg: "https://www.lesswrong.com/reactionImages/nounproject/exclamation.svg" },
    { name: "dontUnderstand", label: "I don't understand", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-question-5771604.svg" },
    { name: "plus", label: "Plus One", svg: "https://www.lesswrong.com/reactionImages/nounproject/Plus.png" },
    { name: "shrug", label: "Shrug", svg: "https://www.lesswrong.com/reactionImages/nounproject/shrug.svg" },
    { name: "thumbs-up", label: "Thumbs Up", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-thumbs-up-1686284.svg" },
    { name: "thumbs-down", label: "Thumbs Down", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-thumbs-down-1686285.svg" },
    { name: "seen", label: "Seen", svg: "https://www.lesswrong.com/reactionImages/nounproject/eyes.svg" },
    { name: "smile", label: "Smile", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-smile-925549.svg" },
    { name: "laugh", label: "Haha!", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-laughing-761845.svg" },
    { name: "sad", label: "Sad", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-sad-1152961.svg" },
    { name: "disappointed", label: "Disappointed", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-sad-5760577.svg" },
    { name: "confused", label: "Confused", svg: "https://www.lesswrong.com/reactionImages/confused2.svg" },
    { name: "thinking", label: "Thinking", svg: "https://www.lesswrong.com/reactionImages/nounproject/thinking-nice-eyebrows.svg" },
    { name: "oops", label: "Oops!", svg: "https://www.lesswrong.com/reactionImages/nounproject/Oops!.png" },
    { name: "surprise", label: "Surprise", svg: "https://www.lesswrong.com/reactionImages/nounproject/surprise.svg" },
    { name: "excitement", label: "Exciting", svg: "https://www.lesswrong.com/reactionImages/nounproject/partypopper.svg" },

    // Row 2
    { name: "changemind", label: "Changed My Mind", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-triangle-305128.svg" },
    { name: "strong-argument", label: "Strong Argument", svg: "https://www.lesswrong.com/reactionImages/nounproject/strong-argument2.svg" },
    { name: "crux", label: "Crux", svg: "https://www.lesswrong.com/reactionImages/nounproject/branchingpath.svg" },
    { name: "hitsTheMark", label: "Hits the Mark", svg: "https://www.lesswrong.com/reactionImages/nounproject/bullseye.svg" },
    { name: "clear", label: "Clearly Written", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-clear-sky-1958882.svg" },
    { name: "concrete", label: "Concrete", svg: "https://www.lesswrong.com/reactionImages/nounproject/concrete.svg" },
    { name: "scout", label: "Scout Mindset", svg: "https://www.lesswrong.com/reactionImages/nounproject/binoculars.svg" },
    { name: "moloch", label: "Moloch", svg: "https://www.lesswrong.com/reactionImages/nounproject/moloch-bw-2.svg" },
    { name: "soldier", label: "Soldier Mindset", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-brackets-1942334-updated.svg" },
    { name: "soldier-alt", label: "Soldier Mindset", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-soldier-5069240.svg" },
    { name: "changed-mind-on-point", label: "Changed Mind on Point", svg: "https://www.lesswrong.com/reactionImages/nounproject/changedmindonpoint.svg" },
    { name: "weak-argument", label: "Weak Argument", svg: "https://www.lesswrong.com/reactionImages/nounproject/weak-argument2.svg" },
    { name: "notacrux", label: "Not a Crux", svg: "https://www.lesswrong.com/reactionImages/nounproject/nonbranchingpath2.svg" },
    { name: "miss", label: "Missed the Point", svg: "https://www.lesswrong.com/reactionImages/nounproject/inaccurate.svg" },
    { name: "muddled", label: "Difficult to Parse", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-fog-1028590.svg" },
    { name: "examples", label: "Examples?", svg: "https://www.lesswrong.com/reactionImages/nounproject/shapes.svg" },
    { name: "paperclip", label: "Paperclip", svg: "https://www.lesswrong.com/reactionImages/nounproject/paperclip.svg" },
    { name: "resolved", label: "Question Answered", svg: "https://www.lesswrong.com/reactionImages/nounproject/resolved.svg" },

    // Row 3
    { name: "heart", label: "Heart", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-heart-1212629.svg" },
    { name: "coveredAlready2", label: "Already Addressed", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-mail-checkmark-5316519.svg" },
    { name: "beautiful", label: "Beautiful!", svg: "https://res.cloudinary.com/lesswrong-2-0/image/upload/v1758861219/Beautiful_ynilb1.svg" },
    { name: "insightful", label: "Insightful", svg: "https://www.lesswrong.com/reactionImages/nounproject/lightbulb.svg" },
    { name: "strawman", label: "Misunderstands?", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-misunderstanding-4936548-updated.svg" },
    { name: "addc", label: "ADDC", svg: "https://www.lesswrong.com/reactionImages/nounproject/ADDC.svg" },
    { name: "llm-smell", label: "Smells like LLM", svg: "https://www.lesswrong.com/reactionImages/nounproject/llm-smell.svg" },
    { name: "scholarship", label: "Nice Scholarship!", svg: "https://www.lesswrong.com/reactionImages/nounproject/scholarship.svg" },
    { name: "unnecessarily-combative", label: "Too Combative?", svg: "https://www.lesswrong.com/reactionImages/nounproject/swords.svg" },
    { name: "thanks", label: "Thanks", svg: "https://www.lesswrong.com/reactionImages/nounproject/thankyou.svg" },
    { name: "hat", label: "Bowing Out", svg: "https://www.lesswrong.com/reactionImages/nounproject/HatInMotion.png" },
    { name: "nitpick", label: "Nitpick", svg: "https://www.lesswrong.com/reactionImages/nounproject/nitpick.svg" },
    { name: "offtopic", label: "Offtopic?", svg: "https://www.lesswrong.com/reactionImages/nounproject/mapandpin.svg" },
    { name: "facilitation", label: "Good Facilitation", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-dialog-2172.svg" },
    { name: "bowels", label: "Bowels", svg: "https://www.lesswrong.com/reactionImages/nounproject/bowels.svg" },
    { name: "typo", label: "Typo", svg: "https://www.lesswrong.com/reactionImages/nounproject/type-text.svg" },
    { name: "bet", label: "Let's Bet!", svg: "https://www.lesswrong.com/reactionImages/nounproject/bet.svg" },
    { name: "sneer", label: "Sneer", svg: "https://www.lesswrong.com/reactionImages/nounproject/NoSneeringThick.png" },

    // Probabilities
    { name: "1percent", label: "1%", svg: "https://www.lesswrong.com/reactionImages/1percent.svg" },
    { name: "10percent", label: "10%", svg: "https://www.lesswrong.com/reactionImages/10percent.svg" },
    { name: "25percent", label: "25%", svg: "https://www.lesswrong.com/reactionImages/25percent.svg" },
    { name: "40percent", label: "40%", svg: "https://www.lesswrong.com/reactionImages/40percent.svg" },
    { name: "50percent", label: "50%", svg: "https://www.lesswrong.com/reactionImages/50percent.svg" },
    { name: "60percent", label: "60%", svg: "https://www.lesswrong.com/reactionImages/60percent.svg" },
    { name: "75percent", label: "75%", svg: "https://www.lesswrong.com/reactionImages/75percent.svg" },
    { name: "90percent", label: "90%", svg: "https://www.lesswrong.com/reactionImages/90percent.svg" },
    { name: "99percent", label: "99%", svg: "https://www.lesswrong.com/reactionImages/99percent.svg" }
];

export const EA_FORUM_BOOTSTRAP_REACTIONS: ReactionMetadata[] = [
    { name: "agree", label: "Agree", svg: "https://www.lesswrong.com/reactionImages/nounproject/check.svg" },
    { name: "disagree", label: "Disagree", svg: "https://www.lesswrong.com/reactionImages/nounproject/x.svg" },
    { name: "love", label: "Heart", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-heart-1212629.svg" },
    { name: "helpful", label: "Helpful", svg: "https://www.lesswrong.com/reactionImages/nounproject/handshake.svg" },
    { name: "insightful", label: "Insightful", svg: "https://www.lesswrong.com/reactionImages/nounproject/lightbulb.svg" },
    { name: "changed-mind", label: "Changed my mind", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-triangle-305128.svg" },
    { name: "laugh", label: "Made me laugh", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-laughing-761845.svg" }
];


// Default sections mirroring modern LessWrong (18-18-18-9 structure)
export const SECTION_DEFINITIONS: Record<string, string[]> = {
    // Grid/List View Consolidated
    gridPrimary: ['agree', 'disagree', 'important', 'dontUnderstand', 'plus', 'shrug', 'thumbs-up', 'thumbs-down', 'seen', 'smile', 'laugh', 'sad', 'disappointed', 'confused', 'thinking', 'oops', 'surprise', 'excitement'],
    gridSectionB: [
        'changemind', 'strong-argument', 'crux', 'hitsTheMark', 'clear', 'concrete', 'scout', 'moloch', 'soldier',
        'changed-mind-on-point', 'weak-argument', 'notacrux', 'miss', 'muddled', 'examples', 'soldier-alt', 'paperclip', 'resolved'
    ],
    gridSectionC: [
        'heart', 'coveredAlready2', 'beautiful', 'insightful', 'strawman', 'addc', 'llm-smell', 'scholarship', 'unnecessarily-combative',
        'thanks', 'hat', 'nitpick', 'offtopic', 'facilitation', 'bowels', 'typo', 'bet', 'sneer'
    ],
    likelihoods: ['1percent', '10percent', '25percent', '40percent', '50percent', '60percent', '75percent', '90percent', '99percent']
};

// Map these back to list view for compatibility (using same logic)
SECTION_DEFINITIONS.listPrimary = SECTION_DEFINITIONS.gridPrimary;
SECTION_DEFINITIONS.listViewSectionB = SECTION_DEFINITIONS.gridSectionB;
SECTION_DEFINITIONS.listViewSectionC = SECTION_DEFINITIONS.gridSectionC;


// --- Scraping & State Management ---

declare const GM_setValue: (key: string, value: any) => void;
declare const GM_getValue: (key: string, defaultValue: any) => any;
declare const GM_xmlhttpRequest: (details: any) => void;

const CACHE_KEY = "power-reader-scraped-reactions";
const CACHE_TIME = 7 * 24 * 60 * 60 * 1000; // 7 days

let reactionsCache: ReactionMetadata[] = [];

/**
 * Returns the current list of reactions.
 * Uses cached scraped data if available, merged with bootstrap defaults.
 */
export function getReactions(): ReactionMetadata[] {
    const isEA = isEAForumHost();
    let finalReactions = [...(isEA ? EA_FORUM_BOOTSTRAP_REACTIONS : BOOTSTRAP_REACTIONS)];

    const getCachedData = () => {
        try {
            const cached = JSON.parse(GM_getValue(getKey(CACHE_KEY), "null"));
            if (cached && cached.timestamp && Date.now() - cached.timestamp < CACHE_TIME) {
                return cached;
            }
        } catch (e) {
            Logger.error("Error loading reactions from cache:", e);
        }
        return null;
    };

    const cached = getCachedData();
    const scraped = cached ? cached.reactions : (reactionsCache.length > 0 ? reactionsCache : []);

    if (scraped.length > 0) {
        // Merge: scraped ones override bootstrap ones by name
        const map = new Map<string, ReactionMetadata>();
        finalReactions.forEach(r => map.set(r.name, r));
        scraped.forEach((r: ReactionMetadata) => map.set(r.name, r));
        finalReactions = Array.from(map.values());
    }

    return finalReactions;
}

/**
 * Get a single reaction by name
 */
export function getReaction(name: string): ReactionMetadata | undefined {
    return getReactions().find(r => r.name === name);
}



const REACTION_REGEX = /{name:"([^"]+)",label:"([^"]+)",(?:searchTerms:\[(.*?)\],)?svg:"([^"]+)"(?:,description:(?:(["'])((?:(?=(\\?))\7.)*?)\5|(?:\([^)]+\)|[\w$]+)=>`[^`]*?(\w+[^`]+)`))?(?:,filter:({[^}]+}))?(?:,deprecated:(!0|!1|true|false))?/g;

/**
 * Parses reaction definitions from source code string.
 * Exported for testing.
 */
export function parseReactionsFromCode(content: string): ReactionMetadata[] {
    const matches: ReactionMetadata[] = [];
    let match;

    // Reset lastIndex to ensure multiple calls work correctly
    REACTION_REGEX.lastIndex = 0;

    while ((match = REACTION_REGEX.exec(content)) !== null) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const [_full, name, label, searchTermsRaw, svg, _quoteChar, descContent, _bs, fnDescContent, filterRaw, deprecatedRaw] = match;


        // Basic reconstruction
        const reaction: ReactionMetadata = { name, label, svg };

        if (searchTermsRaw) {
            reaction.searchTerms = searchTermsRaw.replace(/"/g, '').split(',').map(s => s.trim());
        }

        // Description 
        if (descContent) {
            reaction.description = descContent;
        } else if (fnDescContent) {
            // Function-based description, usually looks like "adds insight" or "is confused"
            // We'll prefix with "This post/comment " for the UI
            reaction.description = `This post/comment ${fnDescContent.trim()}`;
        }

        if (filterRaw) {
            try {
                // filterRaw might be {opacity:.4,scale:1.4} - valid JSON-ish
                // Need to quote keys for JSON.parse
                let jsonFilter = filterRaw.replace(/(\w+):/g, '"$1":');
                // Fix abbreviated decimals (e.g. .5 -> 0.5)
                jsonFilter = jsonFilter.replace(/:(\.\d+)/g, ':0$1');
                reaction.filter = JSON.parse(jsonFilter);
            } catch (e) { }
        }

        if (deprecatedRaw) {
            reaction.deprecated = (deprecatedRaw === '!0' || deprecatedRaw === 'true');
        }

        matches.push(reaction);
    }
    return matches;
}

/**
 * Parses section definitions (e.g. gridPrimary: ["agree", ...]) from code.
 */
function parseSectionsFromCode(content: string): Record<string, string[]> {
    const sections: Record<string, string[]> = {};
    // Matches patterns like gridPrimary:["agree","disagree"...] or gridPrimary=["agree",...]
    // Updated to include list view sections and likelihoods
    const sectionRegex = /(gridPrimary|gridEmotions|gridSectionB|gridSectionC|gridSectionD|listPrimary|listEmotions|listViewSectionB|listViewSectionC|listViewSectionD|likelihoods)[:=](\[[^\]]+\])/g;
    let match;
    while ((match = sectionRegex.exec(content)) !== null) {
        const [_, name, arrayRaw] = match;
        try {
            // arrayRaw looks like ["agree","disagree"]
            const array = JSON.parse(arrayRaw.replace(/'/g, '"').replace(/,\]/, ']'));
            sections[name] = array;
        } catch (e) { }
    }
    return sections;
}
export async function initializeReactions() {
    // 1. Check if we have valid cache
    try {
        const cached = JSON.parse(GM_getValue(getKey(CACHE_KEY), "null"));
        if (cached && cached.timestamp && Date.now() - cached.timestamp < CACHE_TIME) {
            Logger.info("Using cached reactions");
            reactionsCache = cached.reactions;
            if (cached.sectionDefinitions) {
                // Sync static object with cached values
                Object.assign(SECTION_DEFINITIONS, cached.sectionDefinitions);
            }
            return;
        }
    } catch (e) { }

    Logger.info("Reactions cache missing or expired. Starting scrape...");

    // 2. Find script tags
    // LW uses Next.js, so look for chunks. Fall back to all scripts if chunks aren't found.
    let scripts = Array.from(document.querySelectorAll('script[src]'))
        .map(s => (s as HTMLScriptElement).src)
        .filter(src => src.includes('client') || src.includes('/_next/static/chunks/'));

    if (scripts.length === 0) {
        // Absolute fallback: try all same-origin scripts if the above filters failed
        const origin = window.location.origin;
        scripts = Array.from(document.querySelectorAll('script[src]'))
            .map(s => (s as HTMLScriptElement).src)
            .filter(src => src.startsWith(origin));
    }

    if (scripts.length === 0) {
        Logger.warn("No candidate scripts found for scraping. Using bootstrap fallback.");
        const isEA = isEAForumHost();
        reactionsCache = isEA ? EA_FORUM_BOOTSTRAP_REACTIONS : BOOTSTRAP_REACTIONS;
        return;
    }

    // 3. Simple fetching of scripts (one by one to be polite)
    let anySuccess = false;
    for (const src of scripts) {
        try {
            await new Promise<void>(resolve => {
                GM_xmlhttpRequest({
                    method: "GET",
                    url: src,
                    onload: (response: any) => {
                        const content = response.responseText;
                        const matches = parseReactionsFromCode(content);
                        const scrapedSections = parseSectionsFromCode(content);

                        if (matches.length > 20) {
                            Logger.info(`Successfully scraped ${matches.length} reactions from ${src}`);
                            // Filter duplicates
                            const unique = Array.from(new Map(matches.map(item => [item.name, item])).values());

                            // Verify critical ones exist
                            if (unique.find(r => r.name === 'agree') && unique.find(r => r.name === 'insightful')) {

                                if (Object.keys(scrapedSections).length > 2) {
                                    Logger.debug("Found sections in bundle", Object.keys(scrapedSections));
                                    Object.assign(SECTION_DEFINITIONS, scrapedSections);
                                }

                                reactionsCache = unique;
                                GM_setValue(getKey(CACHE_KEY), JSON.stringify({
                                    timestamp: Date.now(),
                                    reactions: unique,
                                    sectionDefinitions: SECTION_DEFINITIONS // Cache these too
                                }));
                                anySuccess = true;
                                resolve();
                                return;
                            }
                        }
                        resolve();
                    },
                    onerror: () => resolve()
                });
            });

            if (anySuccess) break; // Stop if we found them

        } catch (e) {
            Logger.error("Error scraping script:", e);
        }
    }

    if (!anySuccess) {
        Logger.warn("FAILED to scrape reactions from any script bundle. Using bootstrap fallback.");
        const isEA = isEAForumHost();
        reactionsCache = isEA ? EA_FORUM_BOOTSTRAP_REACTIONS : BOOTSTRAP_REACTIONS;
    }
}

