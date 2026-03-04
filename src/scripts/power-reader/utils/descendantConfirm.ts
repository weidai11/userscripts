import { Z_INDEX_TOP_LAYER } from '../config';

export type DescendantLoadDecision = 'load_all' | 'continue_without_loading' | 'cancel';

export const LARGE_DESCENDANT_THRESHOLD = 100;

export const shouldPromptForLargeDescendants = (descendantCount: number): boolean =>
  descendantCount > LARGE_DESCENDANT_THRESHOLD;

interface PromptOptions {
  descendantCount: number;
  subjectLabel: 'post' | 'comment';
}

const OVERLAY_ID = 'pr-descendant-confirm-overlay';
let activePromptFinalize: ((decision: DescendantLoadDecision) => void) | null = null;

export const promptLargeDescendantConfirmation = async (
  options: PromptOptions,
  signal?: AbortSignal
): Promise<DescendantLoadDecision> => {
  if (signal?.aborted) return 'cancel';
  if (activePromptFinalize) {
    activePromptFinalize('cancel');
    activePromptFinalize = null;
  }

  const existing = document.getElementById(OVERLAY_ID);
  if (existing) existing.remove();

  return new Promise((resolve) => {
    let settled = false;

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(0, 0, 0, 0.5)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = String(Z_INDEX_TOP_LAYER);

    const dialog = document.createElement('div');
    dialog.style.width = 'min(560px, 92vw)';
    dialog.style.background = '#fff';
    dialog.style.border = '1px solid #ddd';
    dialog.style.borderRadius = '10px';
    dialog.style.padding = '16px';
    dialog.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.25)';
    dialog.innerHTML = `
      <h3 style="margin: 0 0 8px 0; font-size: 18px;">Large Descendant Set</h3>
      <p style="margin: 0 0 14px 0; line-height: 1.4;">
        This ${options.subjectLabel} has <strong>${options.descendantCount.toLocaleString()}</strong> descendants.
        Choose how to proceed:
      </p>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button data-choice="load_all" style="padding: 8px 12px; cursor: pointer;">Load all descendants</button>
        <button data-choice="continue_without_loading" style="padding: 8px 12px; cursor: pointer;">Continue without loading</button>
        <button data-choice="cancel" style="padding: 8px 12px; cursor: pointer;">Cancel</button>
      </div>
    `;

    const onAbort = () => {
      finalize('cancel');
    };

    const cleanup = () => {
      document.removeEventListener('keydown', onKeyDown, true);
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
      overlay.remove();
    };

    const finalize = (decision: DescendantLoadDecision) => {
      if (settled) return;
      settled = true;
      if (activePromptFinalize === finalize) {
        activePromptFinalize = null;
      }
      cleanup();
      resolve(decision);
    };

    activePromptFinalize = finalize;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        finalize('cancel');
      }
    };

    dialog.querySelectorAll('button').forEach((button) => {
      button.addEventListener('click', () => {
        const choice = button.getAttribute('data-choice') as DescendantLoadDecision;
        finalize(choice || 'cancel');
      });
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        finalize('cancel');
      }
    });

    if (signal) {
      if (signal.aborted) {
        finalize('cancel');
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
      // Close the race where signal aborts between the check above and listener registration.
      if (signal.aborted) {
        finalize('cancel');
        return;
      }
    }

    document.addEventListener('keydown', onKeyDown, true);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
  });
};
