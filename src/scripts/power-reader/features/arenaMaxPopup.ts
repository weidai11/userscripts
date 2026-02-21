/**
 * Arena Max integration feature for Power Reader
 * Thin provider wrapper over shared AI popup/send/listener behavior
 */

import { AI_STUDIO_PROMPT_PREFIX } from '../utils/ai-studio-prompt';
import { getAIStudioPrefix } from '../utils/storage';
import { createAIProviderFeature } from './aiProviderPopupCore';

const arenaMaxFeature = createAIProviderFeature({
  name: 'Arena Max',
  statusTag: '[Arena]',
  openingStatusText: '[Arena Max] Opening Arena tab...',
  openUrl: 'https://arena.ai/max',
  cacheKeyPrefix: 'arena_max',
  hotkey: 'm',
  requestIdKey: 'arena_max_request_id',
  promptPayloadKey: 'arena_max_prompt_payload',
  includeDescendantsKey: 'arena_max_include_descendants',
  responsePayloadKey: 'arena_max_response_payload',
  statusKey: 'arena_max_status',
  // Intentional: Arena and AI Studio currently share one configurable prompt prefix.
  // Keeps a single user-facing setting until we add provider-specific prompt controls.
  getPromptPrefix: getAIStudioPrefix,
  defaultPromptPrefix: AI_STUDIO_PROMPT_PREFIX
});

export const handleSendToArenaMax = arenaMaxFeature.handleSend;
export const displayArenaMaxPopup = arenaMaxFeature.displayPopup;
export const closeArenaMaxPopup = arenaMaxFeature.closePopup;
export const initArenaMaxListener = arenaMaxFeature.initListener;
export const setupArenaMaxKeyboard = arenaMaxFeature.setupKeyboard;
