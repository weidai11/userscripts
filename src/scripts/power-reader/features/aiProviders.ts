/**
 * AI provider send actions for Power Reader.
 */

import { AI_STUDIO_PROMPT_PREFIX } from '../utils/ai-studio-prompt';
import { getAIStudioPrefix } from '../utils/storage';
import { createAIProviderFeature } from './aiProviderPopupCore';

const aiStudioFeature = createAIProviderFeature({
  name: 'AI Studio',
  statusTag: '[AI Studio]',
  openingStatusText: '[AI Studio] Opening AI Studio tab...',
  openUrl: 'https://aistudio.google.com/prompts/new_chat',
  promptPayloadKey: 'ai_studio_prompt_payload',
  getPromptPrefix: getAIStudioPrefix,
  defaultPromptPrefix: AI_STUDIO_PROMPT_PREFIX
});

const arenaMaxFeature = createAIProviderFeature({
  name: 'Arena Max',
  statusTag: '[Arena]',
  openingStatusText: '[Arena Max] Opening Arena tab...',
  openUrl: 'https://arena.ai/max',
  promptPayloadKey: 'arena_max_prompt_payload',
  // Intentional: Arena and AI Studio currently share one configurable prompt prefix.
  // Keeps a single user-facing setting until we add provider-specific prompt controls.
  getPromptPrefix: getAIStudioPrefix,
  defaultPromptPrefix: AI_STUDIO_PROMPT_PREFIX
});

export const handleSendToAIStudio = aiStudioFeature.handleSend;
export const handleSendToArenaMax = arenaMaxFeature.handleSend;
