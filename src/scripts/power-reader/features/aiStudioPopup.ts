/**
 * AI Studio integration feature for Power Reader
 * Thin provider wrapper over shared AI popup/send/listener behavior
 */

import { AI_STUDIO_PROMPT_PREFIX } from '../utils/ai-studio-prompt';
import { getAIStudioPrefix } from '../utils/storage';
import { createAIProviderFeature } from './aiProviderPopupCore';

const aiStudioFeature = createAIProviderFeature({
  name: 'AI Studio',
  statusTag: '[AI Studio]',
  openingStatusText: '[AI Studio] Opening AI Studio tab...',
  openUrl: 'https://aistudio.google.com/prompts/new_chat',
  cacheKeyPrefix: 'ai_studio',
  hotkey: 'g',
  requestIdKey: 'ai_studio_request_id',
  promptPayloadKey: 'ai_studio_prompt_payload',
  includeDescendantsKey: 'ai_studio_include_descendants',
  responsePayloadKey: 'ai_studio_response_payload',
  statusKey: 'ai_studio_status',
  getPromptPrefix: getAIStudioPrefix,
  defaultPromptPrefix: AI_STUDIO_PROMPT_PREFIX
});

export const handleSendToAIStudio = aiStudioFeature.handleSend;
export const displayAIPopup = aiStudioFeature.displayPopup;
export const closeAIPopup = aiStudioFeature.closePopup;
export const initAIStudioListener = aiStudioFeature.initListener;
export const setupAIStudioKeyboard = aiStudioFeature.setupKeyboard;
