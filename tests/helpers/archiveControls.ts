import { expect, type Page } from '@playwright/test';

export type ArchiveScopeValue = 'authored' | 'all';
export type ArchiveViewValue = 'card' | 'index' | 'thread-full' | 'thread-placeholder';

export const waitForArchiveRenderComplete = async (page: Page, timeout = 15000): Promise<void> => {
  await expect.poll(
    async () => page.evaluate(() => {
      const isVisible = (el: Element | null): boolean => {
        if (!(el instanceof HTMLElement)) return false;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        return el.getClientRects().length > 0;
      };

      const hasArchiveUi = !!document.getElementById('archive-feed')
        || !!document.querySelector('.pr-archive-container');
      if (!hasArchiveUi) {
        const isArchivePath = window.location.pathname === '/archive';
        const hasArchiveUsername = new URLSearchParams(window.location.search).has('username');
        const hasMainReaderUi = !!document.querySelector('#power-reader-root .pr-header');
        if (hasMainReaderUi && (!isArchivePath || !hasArchiveUsername)) return 100;
        return -1;
      }
      if (document.querySelector('.pr-archive-render-dialog')) return 100;

      const feed = document.getElementById('archive-feed');
      const dashboard = document.getElementById('archive-dashboard');
      const hasFeedContent = !!feed?.firstElementChild;
      const dashboardVisible = isVisible(dashboard);
      const progress = (window as any).__PR_ARCHIVE_RENDER_PROGRESS__;

      if (hasFeedContent && !dashboardVisible && (typeof progress !== 'number' || progress >= 100)) {
        return 100;
      }
      return typeof progress === 'number' ? progress : -1;
    }),
    { timeout }
  ).toBe(100);
};

export const selectArchiveScope = async (page: Page, value: ArchiveScopeValue): Promise<void> => {
  const option = page.locator(`#archive-scope [data-value="${value}"]`);
  await option.click();
  await expect(option).toHaveAttribute('aria-checked', 'true');
  await waitForArchiveRenderComplete(page);
};

export const expectArchiveScopeSelected = async (page: Page, value: ArchiveScopeValue): Promise<void> => {
  const active = page.locator('#archive-scope [role="radio"][aria-checked="true"]');
  await expect(active).toHaveCount(1);
  await expect(active.first()).toHaveAttribute('data-value', value);
};

export const selectArchiveView = async (page: Page, value: ArchiveViewValue): Promise<void> => {
  const tab = page.locator(`#archive-view [data-value="${value}"]`);
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  await waitForArchiveRenderComplete(page);
};

export const expectArchiveViewSelected = async (page: Page, value: ArchiveViewValue): Promise<void> => {
  const active = page.locator('#archive-view [role="tab"][aria-selected="true"]');
  await expect(active).toHaveCount(1);
  await expect(active.first()).toHaveAttribute('data-value', value);
};
