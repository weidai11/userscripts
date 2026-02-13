/**
 * Shared body components (Content, Quoted Highlights)
 */

import { sanitizeHtml } from '../../utils/sanitize';
import type { NamesAttachedReactionsScore } from '../../../../shared/graphql/queries';
import { CONFIG } from '../../config';

/**
 * Highlight quotes in the HTML body based on reactions
 */
export const highlightQuotes = (html: string, extendedScore: NamesAttachedReactionsScore | null): string => {
    const safeHtml = sanitizeHtml(html);
    if (!extendedScore || !extendedScore.reacts) return safeHtml;

    // Collect all quotes
    const quotesToHighlight: string[] = [];
    Object.values(extendedScore.reacts).forEach(users => {
        users.forEach(u => {
            if (u.quotes) {
                u.quotes.forEach(q => {
                    if (q.quote && q.quote.trim().length > 0) {
                        quotesToHighlight.push(q.quote);
                    }
                });
            }
        });
    });

    if (quotesToHighlight.length === 0) return safeHtml;

    // Sort quotes by length descending to process longest first
    const uniqueQuotes = [...new Set(quotesToHighlight)].sort((a, b) => b.length - a.length);

    const parser = new DOMParser();
    const doc = parser.parseFromString(safeHtml, 'text/html');

    const replaceTextNode = (node: Text, quote: string): void => {
        const text = node.nodeValue || '';
        if (!text.includes(quote)) return;

        const parts = text.split(quote);
        if (parts.length <= 1) return;

        const fragment = doc.createDocumentFragment();
        parts.forEach((part, index) => {
            if (part) {
                fragment.appendChild(doc.createTextNode(part));
            }
            if (index < parts.length - 1) {
                const span = doc.createElement('span');
                span.className = 'pr-highlight';
                span.title = 'Reacted content';
                span.textContent = quote;
                fragment.appendChild(span);
            }
        });

        node.parentNode?.replaceChild(fragment, node);
    };

    uniqueQuotes.forEach((quote) => {
        const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
        const nodes: Text[] = [];
        let node = walker.nextNode();
        while (node) {
            const textNode = node as Text;
            if (!textNode.parentElement?.classList.contains('pr-highlight')) {
                nodes.push(textNode);
            }
            node = walker.nextNode();
        }

        nodes.forEach(textNode => replaceTextNode(textNode, quote));
    });

    return doc.body.innerHTML;
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
