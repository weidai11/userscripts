export type DescendantLoadDecision = 'load_all' | 'continue_without_loading' | 'cancel';

export const LARGE_DESCENDANT_THRESHOLD = 100;

export const shouldPromptForLargeDescendants = (descendantCount: number): boolean =>
  descendantCount > LARGE_DESCENDANT_THRESHOLD;

interface PromptOptions {
  descendantCount: number;
  subjectLabel: 'post' | 'comment';
}

const OVERLAY_ID = 'pr-descendant-confirm-overlay';

export const promptLargeDescendantConfirmation = async (
  options: PromptOptions
): Promise<DescendantLoadDecision> => {
  const existing = document.getElementById(OVERLAY_ID);
  if (existing) existing.remove();

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(0, 0, 0, 0.5)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '100000';

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

    const cleanup = () => {
      document.removeEventListener('keydown', onKeyDown, true);
      overlay.remove();
    };

    const finalize = (decision: DescendantLoadDecision) => {
      cleanup();
      resolve(decision);
    };

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

    document.addEventListener('keydown', onKeyDown, true);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
  });
};
