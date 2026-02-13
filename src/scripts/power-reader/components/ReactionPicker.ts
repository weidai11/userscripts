import {
    getReactions,
    SECTION_DEFINITIONS,
    DEFAULT_FILTER,
    type ReactionMetadata,
} from '../utils/reactions';
import { Logger } from '../utils/logger';
import {
    castReactionVote,
    updateVoteUI,
    type KarmaVote,
    type CurrentUserExtendedVote,
    type VoteResponse
} from '../utils/voting';
import type { Comment } from '../../../shared/graphql/queries';

// Declare GM_setValue/getValue as they are global
declare const GM_setValue: (key: string, value: any) => void;
declare const GM_getValue: (key: string, defaultValue: any) => any;

/**
 * Encapsulated Reaction Picker Component
 */
export class ReactionPicker {
    private commentsGetter: () => Comment[];
    private currentUserPaletteStyle: 'listView' | 'gridView' | null;
    private currentSelection: { text: string; range: Range } | null = null;
    private activeTriggerButton: HTMLElement | null = null;
    private syncCallback: (commentId: string, response: VoteResponse) => void;
    private currentUserId: string | null;

    // State for re-rendering
    private currentCommentId: string | null = null;
    private currentSearch: string = '';
    private viewMode: string = 'grid';
    private tooltipElement: HTMLElement | null = null;

    constructor(
        commentsGetter: () => Comment[],
        paletteStyle: 'listView' | 'gridView' | null,
        syncCallback: (commentId: string, response: VoteResponse) => void,
        currentUserId: string | null
    ) {
        this.commentsGetter = commentsGetter;
        this.currentUserPaletteStyle = paletteStyle;
        this.syncCallback = syncCallback;
        this.currentUserId = currentUserId;
    }

    public setSelection(selection: { text: string; range: Range } | null) {
        this.currentSelection = selection;
    }

    public open(button: HTMLElement, initialSearchText: string = '') {
        const commentId = button.dataset.id;
        if (!commentId) return;

        // Toggle Logic: If clicking the same button, close and return
        const existing = document.getElementById('pr-global-reaction-picker');
        if (existing && this.activeTriggerButton === button) {
            existing.remove();
            this.activeTriggerButton = null;
            return;
        }

        // Remove existing picker if any (from another button)
        if (existing) existing.remove();

        this.activeTriggerButton = button;
        this.currentCommentId = commentId;
        this.currentSearch = initialSearchText;
        this.viewMode = GM_getValue('pickerViewMode', this.currentUserPaletteStyle || 'grid');

        const picker = document.createElement('div');
        picker.id = 'pr-global-reaction-picker';
        picker.className = 'pr-reaction-picker';

        const root = document.getElementById('power-reader-root');
        if (root) {
            root.appendChild(picker);
        } else {
            document.body.appendChild(picker);
        }

        this._render();

        // One-time setup for positioning and global listeners
        this._setupPickerInteractions(picker, button);
    }

    private escapeHtml(unsafe: string): string {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    private _render() {
        const picker = document.getElementById('pr-global-reaction-picker');
        if (!picker || !this.currentCommentId) return;

        const comment = this.commentsGetter().find(c => c._id === this.currentCommentId);
        const userVotes = comment?.currentUserExtendedVote?.reacts || [];
        const allReactions = getReactions();

        const getReactionsFromList = (names: string[] | undefined): ReactionMetadata[] => {
            if (!names) return [];
            return names.map(name => allReactions.find(r => r.name === name)).filter(r => r && !r.deprecated) as ReactionMetadata[];
        };

        const renderSectionTitle = (title: string) => `<div class="pr-picker-section-title">${title}</div>`;

        const renderPickerItem = (reaction: ReactionMetadata, mode: 'grid' | 'list') => {
            const voted = userVotes.some(v => v.react === reaction.name);
            const filter = reaction.filter || DEFAULT_FILTER;
            const imgStyle = `
          filter: opacity(${filter.opacity ?? 1}) saturate(${filter.saturate ?? 1});
          transform: scale(${filter.scale ?? 1}) translate(${filter.translateX ?? 0}px, ${filter.translateY ?? 0}px);
      `;

            const labelAttr = `data-tooltip-label="${this.escapeHtml(reaction.label)}"`;
            const descAttr = `data-tooltip-description="${this.escapeHtml(reaction.description || '')}"`;

            if (mode === 'list') {
                return `
            <div class="pr-reaction-list-item ${voted ? 'active' : ''}" 
                 data-action="reaction-vote" 
                 data-id="${this.currentCommentId}" 
                 data-reaction-name="${reaction.name}"
                 ${labelAttr} ${descAttr}>
              <img src="${reaction.svg}" alt="${reaction.name}" style="${imgStyle}">
              <span class="${reaction.name === 'addc' ? 'small' : ''}">${this.escapeHtml(reaction.label).replace(/\\n/g, '<br/>')}</span>
            </div>
          `;
            }

            // Grid Item
            return `
        <div class="pr-reaction-picker-item ${voted ? 'active' : ''}" 
             data-action="reaction-vote" 
             data-id="${this.currentCommentId}" 
             data-reaction-name="${reaction.name}"
             ${labelAttr} ${descAttr}>
          <img src="${reaction.svg}" alt="${reaction.name}" style="${imgStyle}">
        </div>
      `;
        };

        // Filter reactions if searching
        const normalizedSearch = this.currentSearch.toLowerCase();
        const filtered = allReactions.filter(r => {
            if (!this.currentSearch) return !r.deprecated;
            return r.name.toLowerCase().includes(normalizedSearch) ||
                r.label.toLowerCase().includes(normalizedSearch) ||
                r.searchTerms?.some(t => t.toLowerCase().includes(normalizedSearch));
        });

        const renderGridSection = (list: string[] | undefined) => {
            if (!list) return '';
            return getReactionsFromList(list)
                .map((r) => renderPickerItem(r, 'grid'))
                .join('');
        };

        const header = `
            <div class="pr-picker-search">
               <span class="pr-picker-view-toggle" title="Switch View">${this.viewMode === 'list' ? '▦' : '≣'}</span>
               <input type="text" placeholder="Search reactions..." value="${this.escapeHtml(this.currentSearch)}" id="pr-reaction-search-input">
            </div>
        `;

        let body = '';
        if (this.currentSearch) {
            // Search Results
            body += `<div class="pr-reaction-picker-grid">`;
            filtered.forEach((r) => body += renderPickerItem(r, 'grid'));
            body += `</div>`;
            if (filtered.length === 0) {
                body += `<div style="padding:10px; text-align:center; color:#888">No matching reactions</div>`;
            }
        } else {
            if (this.viewMode === 'list') {
                // List View
                body += `<div class="pr-reaction-picker-grid">`;
                body += renderGridSection(SECTION_DEFINITIONS.listPrimary);
                body += `</div>`;

                const sections = [
                    { title: "Analysis & Agreement", list: SECTION_DEFINITIONS.listViewSectionB },
                    { title: "Feedback & Meta", list: SECTION_DEFINITIONS.listViewSectionC }
                ];

                sections.forEach(s => {
                    if (s.list && s.list.length > 0) {
                        body += renderSectionTitle(s.title);
                        body += `<div class="pr-reaction-picker-list">`;
                        body += getReactionsFromList(s.list).map(r => renderPickerItem(r, 'list')).join('');
                        body += `</div>`;
                    }
                });

                body += renderSectionTitle("Likelihoods");
                body += `<div class="pr-reaction-picker-grid">`;
                body += renderGridSection(SECTION_DEFINITIONS.likelihoods);
                body += `</div>`;
            } else {
                // Grid View
                body += `<div class="pr-reaction-picker-grid">`;
                body += renderGridSection(SECTION_DEFINITIONS.gridPrimary);
                if (SECTION_DEFINITIONS.gridSectionB) {
                    body += `<div class="pr-picker-grid-separator"></div>`;
                    body += renderGridSection(SECTION_DEFINITIONS.gridSectionB);
                }
                if (SECTION_DEFINITIONS.gridSectionC) {
                    body += `<div class="pr-picker-grid-separator"></div>`;
                    body += renderGridSection(SECTION_DEFINITIONS.gridSectionC);
                }
                body += `<div class="pr-picker-grid-separator"></div>`;
                body += renderGridSection(SECTION_DEFINITIONS.likelihoods);
                body += `</div>`;
            }
        }

        // Preserve scroll if re-rendering
        const oldContainer = picker.querySelector('.pr-picker-scroll-container');
        const scrollPos = oldContainer ? oldContainer.scrollTop : 0;

        // Preserve input selection
        const searchInput = picker.querySelector('input');
        const selStart = searchInput?.selectionStart;
        const selEnd = searchInput?.selectionEnd;

        picker.innerHTML = `
            <div class="pr-picker-header">${header}</div>
            <div class="pr-picker-scroll-container">${body}</div>
        `;

        // Restore scroll
        const newContainer = picker.querySelector('.pr-picker-scroll-container');
        if (newContainer) newContainer.scrollTop = scrollPos;

        // Re-bind internal events (like input and toggle)
        const newInput = picker.querySelector('input') as HTMLInputElement;
        if (newInput) {
            newInput.focus(); // Focus might be lost on re-render
            newInput.addEventListener('input', (e) => {
                this.currentSearch = (e.target as HTMLInputElement).value;
                this._render();
            });
            if (typeof selStart === 'number') newInput.setSelectionRange(selStart, selEnd || selStart);
        }

        const toggle = picker.querySelector('.pr-picker-view-toggle');
        if (toggle) {
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                this.viewMode = this.viewMode === 'list' ? 'grid' : 'list';
                GM_setValue('pickerViewMode', this.viewMode);
                this._render();
            });
        }
    }

    private _setupPickerInteractions(picker: HTMLElement, button: HTMLElement) {
        // Event Delegation for items
        // Tooltip delegation
        picker.addEventListener('mouseover', (e) => {
            const target = (e.target as HTMLElement).closest('[data-tooltip-label]') as HTMLElement;
            if (target) {
                this._showTooltip(target);
            }
        });
        picker.addEventListener('mouseout', (e) => {
            const target = (e.target as HTMLElement).closest('[data-tooltip-label]') as HTMLElement;
            if (target) {
                this._hideTooltip();
            }
        });

        picker.addEventListener('click', (e) => {
            e.stopPropagation();
            const target = (e.target as HTMLElement).closest('[data-action="reaction-vote"]') as HTMLElement;
            if (target) {
                const commentId = target.dataset.id;
                const reactionName = target.dataset.reactionName;
                if (commentId && reactionName) {
                    Logger.info(`Picker: Clicked reaction ${reactionName} on comment ${commentId}`);
                    this.handleReactionVote(commentId, reactionName);
                }
            }
        });
        picker.addEventListener('mousedown', (e) => e.stopPropagation());

        // Position logic
        const rect = button.getBoundingClientRect();
        const scrollX = window.scrollX;
        const scrollY = window.scrollY;

        // Measure
        picker.style.visibility = 'hidden';
        picker.style.display = 'flex';
        const pickerHeight = picker.offsetHeight;
        const pickerWidth = picker.offsetWidth;
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const margin = 10;

        const buttonTopDoc = rect.top + scrollY;
        const buttonBottomDoc = rect.bottom + scrollY;
        const buttonLeftDoc = rect.left + scrollX;
        const buttonRightDoc = rect.right + scrollX;

        let top = buttonBottomDoc + 5;
        let left = buttonLeftDoc;

        const pickerBottomViewport = rect.bottom + 5 + pickerHeight;
        const spaceBelow = viewportHeight - rect.bottom;
        const spaceAbove = rect.top;

        if (pickerBottomViewport > viewportHeight - margin && spaceAbove > spaceBelow) {
            top = buttonTopDoc - pickerHeight - 5;
        }

        const minTop = scrollY + margin;
        const maxTop = scrollY + viewportHeight - pickerHeight - margin;
        top = Math.max(minTop, Math.min(top, maxTop));

        const pickerBottom = top + pickerHeight;
        const overlapsVertically = !(pickerBottom <= buttonTopDoc || top >= buttonBottomDoc);

        if (overlapsVertically) {
            const spaceOnRight = viewportWidth - rect.right;
            if (spaceOnRight >= pickerWidth + margin) {
                left = buttonRightDoc + 5;
            } else {
                const spaceOnLeft = rect.left;
                if (spaceOnLeft >= pickerWidth + margin) {
                    left = buttonLeftDoc - pickerWidth - 5;
                }
            }
        }

        const pickerRightViewport = left - scrollX + pickerWidth;
        if (pickerRightViewport > viewportWidth - margin) {
            left = scrollX + viewportWidth - pickerWidth - margin;
        }
        left = Math.max(scrollX + margin, left);

        picker.style.top = `${top}px`;
        picker.style.left = `${left}px`;
        picker.style.visibility = 'visible';
        picker.classList.add('visible');

        // Focus search initially
        const input = picker.querySelector('input');
        if (input) input.focus();

        // Close Handler
        const closeHandler = (e: MouseEvent) => {
            if (!button.contains(e.target as Node)) {
                picker?.classList.remove('visible');
                if (picker) {
                    picker.style.display = 'none';
                    picker.style.visibility = 'hidden';
                }
                this._hideTooltip();
                document.removeEventListener('mousedown', closeHandler);
                this.currentSelection = null;
                this.activeTriggerButton = null;
                this.currentCommentId = null;
            }
        };

        setTimeout(() => {
            document.addEventListener('mousedown', closeHandler);
        }, 50);
    }

    private _showTooltip(target: HTMLElement) {
        if (!this.tooltipElement) {
            this.tooltipElement = document.createElement('div');
            this.tooltipElement.className = 'pr-tooltip-global';
            document.body.appendChild(this.tooltipElement);
        }

        const label = target.dataset.tooltipLabel || '';
        const description = target.dataset.tooltipDescription || '';

        // Escape and then handle literal \n in tooltip content
        const cleanLabel = this.escapeHtml(label).replace(/\\n/g, '<br/>');
        const cleanDescription = this.escapeHtml(description).replace(/\\n/g, '<br/>');

        this.tooltipElement.innerHTML = `
            <strong>${cleanLabel}</strong>
            ${cleanDescription}
        `;

        // Reset opacity/visibility to measure off-screen/invisible
        this.tooltipElement.style.visibility = 'hidden';
        this.tooltipElement.style.display = 'block';
        this.tooltipElement.style.opacity = '0';

        const rect = target.getBoundingClientRect();
        const tooltipHeight = this.tooltipElement.offsetHeight;
        const tooltipWidth = this.tooltipElement.offsetWidth;

        // Position calculation
        // Default: Centered Above
        let top = rect.top - tooltipHeight - 8;
        let left = rect.left + (rect.width / 2) - (tooltipWidth / 2);

        // Viewport constraints
        const margin = 10;
        const viewportWidth = window.innerWidth;

        // Horizontal adjustment
        if (left < margin) {
            left = margin;
        } else if (left + tooltipWidth > viewportWidth - margin) {
            left = viewportWidth - tooltipWidth - margin;
        }

        // Vertical adjustment (Flip to bottom if no space on top)
        if (top < margin) {
            top = rect.bottom + 8;
        }

        this.tooltipElement.style.top = `${top}px`;
        this.tooltipElement.style.left = `${left}px`;
        this.tooltipElement.style.visibility = 'visible';
        this.tooltipElement.style.opacity = '1';
    }

    private _hideTooltip() {
        if (this.tooltipElement) {
            this.tooltipElement.style.visibility = 'hidden';
            this.tooltipElement.style.opacity = '0';
        }
    }

    public async handleReactionVote(commentId: string, reactionName: string) {
        Logger.info(`Handling reaction vote: ${reactionName} for ${commentId}`);
        const comment = this.commentsGetter().find(c => c._id === commentId);
        if (!comment) return;

        // Determine quote context
        let quote: string | null = null;
        if (this.currentSelection && this.currentSelection.range.commonAncestorContainer.parentElement?.closest(`[data-id="${commentId}"]`)) {
            // Only use quote if selection is inside THIS comment
            quote = this.currentSelection.text;
        }

        const res = await castReactionVote(
            commentId,
            reactionName,
            !!this.currentUserId,
            comment.currentUserVote as KarmaVote,
            comment.currentUserExtendedVote as CurrentUserExtendedVote,
            quote
        );

        if (res) {
            updateVoteUI(commentId, res);
            this.syncCallback(commentId, res);

            // Clear selection & UI
            window.getSelection()?.removeAllRanges();
            this.currentSelection = null;
            document.getElementById('pr-inline-react-btn')?.remove();

            // Re-render picker to update active states
            this._render();
        }
    }
}
