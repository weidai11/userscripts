/**
 * Resizable view width for Power Reader
 */

import { getViewWidth, setViewWidth } from './storage';

interface ResizeState {
  isDragging: boolean;
  startX: number;
  startWidth: number;
  dragSide: 'left' | 'right' | null;
}

const state: ResizeState = {
  isDragging: false,
  startX: 0,
  startWidth: 0,
  dragSide: null,
};

let rootElement: HTMLElement | null = null;

/**
 * Initialize resize handles
 */
export function initResizeHandles(): void {
  rootElement = document.getElementById('power-reader-root');
  if (!rootElement) return;

  // Create resize handles
  const leftHandle = document.createElement('div');
  leftHandle.className = 'pr-resize-handle left';
  leftHandle.dataset.side = 'left';

  const rightHandle = document.createElement('div');
  rightHandle.className = 'pr-resize-handle right';
  rightHandle.dataset.side = 'right';

  document.body.appendChild(leftHandle);
  document.body.appendChild(rightHandle);

  // Apply saved width
  const savedWidth = getViewWidth();
  applyWidth(savedWidth);

  // Event listeners
  leftHandle.addEventListener('mousedown', startDrag);
  rightHandle.addEventListener('mousedown', startDrag);
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', endDrag);

  // Update handle positions on resize
  window.addEventListener('resize', () => {
    const currentWidth = getViewWidth();
    applyWidth(currentWidth);
  });
}

/**
 * Start drag operation
 */
function startDrag(e: MouseEvent): void {
  const handle = e.target as HTMLElement;
  state.isDragging = true;
  state.startX = e.clientX;
  state.dragSide = handle.dataset.side as 'left' | 'right';
  state.startWidth = rootElement?.offsetWidth || window.innerWidth;

  handle.classList.add('dragging');
  document.body.style.cursor = 'ew-resize';
  document.body.style.userSelect = 'none';

  e.preventDefault();
}

/**
 * Handle drag movement
 */
function onDrag(e: MouseEvent): void {
  if (!state.isDragging || !rootElement) return;

  const deltaX = e.clientX - state.startX;
  
  // Since view is centered, each side affects width by 2x
  let newWidth: number;
  if (state.dragSide === 'left') {
    newWidth = state.startWidth - (deltaX * 2);
  } else {
    newWidth = state.startWidth + (deltaX * 2);
  }

  // Clamp to reasonable bounds
  const minWidth = 400;
  const maxWidth = window.innerWidth;
  newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

  applyWidth(newWidth);
}

/**
 * End drag operation
 */
function endDrag(): void {
  if (!state.isDragging) return;

  state.isDragging = false;
  state.dragSide = null;

  document.querySelectorAll('.pr-resize-handle').forEach(h => {
    h.classList.remove('dragging');
  });

  document.body.style.cursor = '';
  document.body.style.userSelect = '';

  // Save the width
  if (rootElement) {
    const width = rootElement.offsetWidth;
    setViewWidth(width);
  }
}

/**
 * Apply width to root element
 */
function applyWidth(width: number): void {
  if (!rootElement) return;

  // 0 means full width
  if (width <= 0 || width >= window.innerWidth) {
    rootElement.style.maxWidth = '';
    rootElement.style.width = '100%';
  } else {
    rootElement.style.maxWidth = `${width}px`;
    rootElement.style.width = `${width}px`;
  }

  // Update handle positions based on content area
  updateHandlePositions();
}

/**
 * Update resize handle positions
 */
function updateHandlePositions(): void {
  if (!rootElement) return;

  const rect = rootElement.getBoundingClientRect();
  const leftHandle = document.querySelector('.pr-resize-handle.left') as HTMLElement;
  const rightHandle = document.querySelector('.pr-resize-handle.right') as HTMLElement;

  if (leftHandle) {
    leftHandle.style.left = `${Math.max(0, rect.left - 4)}px`;
  }

  if (rightHandle) {
    rightHandle.style.left = `${Math.min(window.innerWidth - 8, rect.right - 4)}px`;
  }
}
