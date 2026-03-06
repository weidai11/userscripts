/**
 * Shared body components (Content, Quoted Highlights)
 */

import type { NamesAttachedReactionsScore, ReactionUser } from '../../../../shared/graphql/queries';
import { CONFIG } from '../../config';
import { readQuoteText } from '../../utils/rendering';
import { getReactions } from '../../utils/reactions';

interface QuoteTooltipData {
    reactionLabels: Set<string>;
    reactionDescriptions: Set<string>;
    users: Set<string>;
}

interface QuoteReactionAccumulator {
    label: string;
    description: string;
    proCount: number;
    antiCount: number;
    proUsers: Set<string>;
    antiUsers: Set<string>;
}

const fallbackReactionLabel = (reactionName: string): string => {
    const normalized = reactionName.replace(/[-_]+/g, ' ').trim();
    if (!normalized) return 'Reaction';
    return normalized.replace(/\b\w/g, (ch) => ch.toUpperCase());
};

const buildQuoteTooltipData = (extendedScore: NamesAttachedReactionsScore): Map<string, QuoteTooltipData> => {
    const reactionsByQuote = new Map<string, Map<string, QuoteReactionAccumulator>>();
    const reactionByName = new Map(getReactions().map((reaction) => [reaction.name, reaction]));

    Object.entries(extendedScore.reacts || {}).forEach(([reactionName, users]) => {
        const reaction = reactionByName.get(reactionName);
        const reactionLabel = reaction?.label || fallbackReactionLabel(reactionName);
        const reactionDescription = reaction?.description || '';

        (users as ReactionUser[]).forEach((user) => {
            const userName = user.displayName || user.userName || user.username || user.userId;
            const delta = user.reactType === 'disagreed'
                ? -1
                : user.reactType === 'created'
                    ? 1
                    : 0;
            if (!Array.isArray(user.quotes)) return;
            user.quotes.forEach((quoteEntry) => {
                const quoteText = readQuoteText(quoteEntry);
                if (!quoteText) return;

                let quoteReactions = reactionsByQuote.get(quoteText);
                if (!quoteReactions) {
                    quoteReactions = new Map<string, QuoteReactionAccumulator>();
                    reactionsByQuote.set(quoteText, quoteReactions);
                }

                let aggregate = quoteReactions.get(reactionName);
                if (!aggregate) {
                    aggregate = {
                        label: reactionLabel,
                        description: reactionDescription,
                        proCount: 0,
                        antiCount: 0,
                        proUsers: new Set<string>(),
                        antiUsers: new Set<string>(),
                    };
                    quoteReactions.set(reactionName, aggregate);
                }

                if (delta < 0) {
                    aggregate.antiCount += 1;
                    if (userName) {
                        aggregate.antiUsers.add(userName);
                    }
                } else if (delta > 0) {
                    aggregate.proCount += 1;
                    if (userName) {
                        aggregate.proUsers.add(userName);
                    }
                }
            });
        });
    });

    const tooltipByQuote = new Map<string, QuoteTooltipData>();
    reactionsByQuote.forEach((quoteReactions, quoteText) => {
        const tooltipData: QuoteTooltipData = {
            reactionLabels: new Set<string>(),
            reactionDescriptions: new Set<string>(),
            users: new Set<string>(),
        };

        quoteReactions.forEach((aggregate) => {
            const totalReactions = aggregate.proCount + aggregate.antiCount;
            if (totalReactions <= 0) return;
            const net = aggregate.proCount - aggregate.antiCount;
            tooltipData.reactionLabels.add(aggregate.label);
            if (aggregate.antiCount > 0) {
                tooltipData.reactionDescriptions.add(
                    `${aggregate.label}: ${Math.max(net, 0)} total (${aggregate.proCount} reacted, ${aggregate.antiCount} opposed)`
                );
            } else {
                tooltipData.reactionDescriptions.add(`${aggregate.label}: ${aggregate.proCount} reacted`);
            }
            if (aggregate.description) {
                tooltipData.reactionDescriptions.add(`${aggregate.label}: ${aggregate.description}`);
            }
            aggregate.proUsers.forEach((userName) => {
                tooltipData.users.add(`${userName} [${aggregate.label} +]`);
            });
            aggregate.antiUsers.forEach((userName) => {
                tooltipData.users.add(`${userName} [${aggregate.label} -]`);
            });
        });

        if (tooltipData.reactionLabels.size > 0) {
            tooltipByQuote.set(quoteText, tooltipData);
        }
    });

    return tooltipByQuote;
};

/**
 * Highlight quotes in the HTML body based on reactions
 */
export const highlightQuotes = (html: string, extendedScore: NamesAttachedReactionsScore | null): string => {
    const bodyHtml = html;
    if (!extendedScore || !extendedScore.reacts) return bodyHtml;
    const tooltipByQuote = buildQuoteTooltipData(extendedScore);

    const quotesToHighlight = Array.from(tooltipByQuote.keys());

    if (quotesToHighlight.length === 0) return bodyHtml;

    // Keys from Map are unique already; process longest first to avoid nested partial matches.
    const uniqueQuotes = quotesToHighlight.sort((a, b) => b.length - a.length);

    const template = document.createElement('template');
    template.innerHTML = bodyHtml;
    const root = template.content;
    const isNonContentTextNode = (textNode: Text): boolean => {
        const parent = textNode.parentElement;
        if (!parent) return true;
        if (parent.classList.contains('pr-highlight')) return true;
        return Boolean(parent.closest('style, script, noscript, template'));
    };

    const replaceTextNode = (node: Text, quote: string): void => {
        const text = node.nodeValue || '';
        if (!text.includes(quote)) return;

        const parts = text.split(quote);
        if (parts.length <= 1) return;

        const fragment = document.createDocumentFragment();
        parts.forEach((part, index) => {
            if (part) {
                fragment.appendChild(document.createTextNode(part));
            }
            if (index < parts.length - 1) {
                const span = document.createElement('span');
                span.className = 'pr-highlight pr-tooltip-target';
                span.textContent = quote;
                const tooltip = tooltipByQuote.get(quote);
                if (tooltip) {
                    const reactionLabels = Array.from(tooltip.reactionLabels);
                    const reactionDescriptions = Array.from(tooltip.reactionDescriptions);
                    const userLines = Array.from(tooltip.users);

                    const label = reactionLabels.length === 1
                        ? reactionLabels[0]
                        : `Reacted content (${reactionLabels.length} reactions)`;
                    span.setAttribute('data-tooltip-label', label);

                    const descriptionLines: string[] = [];
                    if (reactionLabels.length > 0) {
                        descriptionLines.push(`Reactions: ${reactionLabels.join(', ')}`);
                    }
                    if (reactionDescriptions.length === 1) {
                        descriptionLines.push(reactionDescriptions[0]);
                    }
                    if (descriptionLines.length > 0) {
                        span.setAttribute('data-tooltip-description', descriptionLines.join('\n'));
                    }

                    if (userLines.length > 0) {
                        span.setAttribute('data-tooltip-users', userLines.join('\n'));
                    }
                } else {
                    span.title = 'Reacted content';
                }
                fragment.appendChild(span);
            }
        });

        node.parentNode?.replaceChild(fragment, node);
    };

    uniqueQuotes.forEach((quote) => {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const nodes: Text[] = [];
        let node = walker.nextNode();
        while (node) {
            const textNode = node as Text;
            if (!isNonContentTextNode(textNode)) {
                nodes.push(textNode);
            }
            node = walker.nextNode();
        }

        nodes.forEach(textNode => replaceTextNode(textNode, quote));
    });

    return template.innerHTML;
};

/**
 * Render a comment/post body with highlights
 */
export const renderBody = (html: string, extendedScore: NamesAttachedReactionsScore | null): string => {
    const content = html || '<i>(No content)</i>';
    return highlightQuotes(content, extendedScore);
};

/**
 * Render a post-specific body with truncation logic
 */
export const renderPostBody = (html: string, extendedScore: NamesAttachedReactionsScore | null, isTruncated: boolean): string => {
    const bodyHtml = renderBody(html, extendedScore);
    return `
    <div class="pr-post-body pr-post-body-container ${isTruncated ? 'truncated' : ''}" 
         style="${isTruncated ? `max-height: ${CONFIG.maxPostHeight};` : ''}">
      <div class="pr-post-content">
        ${bodyHtml}
      </div>
      <div class="pr-read-more-overlay" style="${isTruncated ? '' : 'display: none;'}">
        <button class="pr-read-more-btn pr-post-read-more" data-action="read-more" style="${isTruncated ? '' : 'display: none;'}">Read More</button>
      </div>
    </div>
  `;
};
