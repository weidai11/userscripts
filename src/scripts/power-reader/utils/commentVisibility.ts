export const getStickyViewportTop = (): number => {
    const stickyHeader = document.getElementById('pr-sticky-header');
    if (!stickyHeader) return 0;

    const rect = stickyHeader.getBoundingClientRect();
    const computed = window.getComputedStyle(stickyHeader);
    const isVisible = stickyHeader.classList.contains('visible') || (computed.display !== 'none' && rect.height > 0);
    if (!isVisible) return 0;

    return Math.max(0, rect.bottom);
};

export const getCommentVisibilityTarget = (commentEl: HTMLElement): HTMLElement => {
    const ownBody = commentEl.querySelector(':scope > .pr-comment-body') as HTMLElement | null;
    if (ownBody) return ownBody;

    const ownMeta = commentEl.querySelector(':scope > .pr-comment-meta-wrapper') as HTMLElement | null;
    if (ownMeta) return ownMeta;

    return commentEl;
};
