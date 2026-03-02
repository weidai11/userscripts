/**
 * Feature: Rich Reaction Tooltips
 * Implements hover tooltips for reaction chips with detailed info (label, description, users, quotes)
 */

import { escapeHtml } from '../utils/rendering';

let tooltipElement: HTMLElement | null = null;

/**
 * Initialize global reaction tooltip listeners
 */
export const initReactionTooltips = (): void => {
    document.addEventListener('mouseover', (e) => {
        const target = (e.target as HTMLElement).closest('.pr-reaction-chip, .pr-tooltip-target') as HTMLElement;
        if (target) {
            showTooltip(target);
        }
    });

    document.addEventListener('mouseout', (e) => {
        const target = (e.target as HTMLElement).closest('.pr-reaction-chip, .pr-tooltip-target') as HTMLElement;
        if (target) {
            hideTooltip();
        }
    });
};

const showTooltip = (target: HTMLElement): void => {
    if (!tooltipElement) {
        tooltipElement = document.createElement('div');
        tooltipElement.className = 'pr-tooltip-global';
        document.body.appendChild(tooltipElement);
    }

    const label = target.getAttribute('data-tooltip-label') || '';
    const description = target.getAttribute('data-tooltip-description') || '';
    const users = target.getAttribute('data-tooltip-users') || '';

    if (!label && !description && !users) return;

    // Format content
    // Handle both literal newlines and escaped \n sequences
    const format = (text: string) => escapeHtml(text).replace(/\n/g, '<br/>').replace(/\\n/g, '<br/>');

    let content = '';
    if (label) {
        content += `<strong>${format(label)}</strong>`;
    }
    
    if (description) {
        content += `<div style="margin-top: ${label ? '4px' : '0'}; color: #ccc;">${format(description)}</div>`;
    }
    
    if (users) {
        const userList = users.split('\n').filter(Boolean).map(u => `<div>• ${format(u)}</div>`).join('');
        if (userList) {
            content += `<div style="margin-top: 8px; border-top: 1px solid #444; padding-top: 4px; font-size: 0.95em;">${userList}</div>`;
        }
    }

    if (!content) return;

    tooltipElement.innerHTML = content;

    // Position calculation
    tooltipElement.style.visibility = 'hidden';
    tooltipElement.style.display = 'block';
    tooltipElement.style.opacity = '0';

    const rect = target.getBoundingClientRect();
    const tooltipHeight = tooltipElement.offsetHeight;
    const tooltipWidth = tooltipElement.offsetWidth;

    let top = rect.top - tooltipHeight - 8;
    let left = rect.left + (rect.width / 2) - (tooltipWidth / 2);

    const margin = 10;
    const viewportWidth = window.innerWidth;

    if (left < margin) {
        left = margin;
    } else if (left + tooltipWidth > viewportWidth - margin) {
        left = viewportWidth - tooltipWidth - margin;
    }

    if (top < margin) {
        top = rect.bottom + 8;
    }

    tooltipElement.style.top = `${top}px`;
    tooltipElement.style.left = `${left}px`;
    tooltipElement.style.visibility = 'visible';
    tooltipElement.style.opacity = '1';
};

const hideTooltip = (): void => {
    if (tooltipElement) {
        tooltipElement.style.visibility = 'hidden';
        tooltipElement.style.opacity = '0';
    }
};
