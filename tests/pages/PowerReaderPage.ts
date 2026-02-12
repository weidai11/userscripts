import { type Page, type Locator, expect } from '@playwright/test';

export class PowerReaderPage {
    readonly page: Page;
    readonly root: Locator;
    readonly header: Locator;
    readonly posts: Locator;
    readonly comments: Locator;
    readonly unreadCount: Locator;
    readonly stickyHeader: Locator;

    constructor(page: Page) {
        this.page = page;
        this.root = page.locator('#power-reader-root');
        this.header = page.locator('.pr-header h1');
        this.posts = page.locator('.pr-post');
        this.comments = page.locator('.pr-comment');
        this.unreadCount = page.locator('#pr-unread-count');
        this.stickyHeader = page.locator('#pr-sticky-header');
    }

    async waitForReady() {
        await this.page.waitForSelector('#lw-power-reader-ready-signal', { state: 'attached', timeout: 15000 });
    }

    getComment(index: number) {
        return this.comments.nth(index);
    }

    async getAuthor(commentIndex: number) {
        return this.getComment(commentIndex).locator('.pr-author').innerText();
    }

    async getBody(commentIndex: number) {
        return this.getComment(commentIndex).locator('.pr-comment-body').innerText();
    }
}
