import { expect, type Page } from '@playwright/test';

export type ArchiveScopeValue = 'authored' | 'all';
export type ArchiveViewValue = 'card' | 'index' | 'thread-full' | 'thread-placeholder';

export const waitForArchiveRenderComplete = async (page: Page, timeout = 15000): Promise<void> => {
  await expect.poll(
    async () => page.evaluate(() => {
      const hasArchiveUi = !!document.getElementById('archive-feed')
        || !!document.querySelector('.pr-archive-container');
      if (!hasArchiveUi) return 100;
      if (document.querySelector('.pr-archive-render-dialog')) return 100;
      const progress = (window as any).__PR_ARCHIVE_RENDER_PROGRESS__;
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
