// ==UserScript==
// @name       LW Power Reader
// @namespace  npm/vite-plugin-monkey
// @version    1.2.538
// @author     Wei Dai
// @match      https://www.lesswrong.com/*
// @match      https://forum.effectivealtruism.org/*
// @match      https://www.greaterwrong.com/*
// @match      https://aistudio.google.com/*
// @connect    lesswrong.com
// @connect    forum.effectivealtruism.org
// @connect    greaterwrong.com
// @grant      GM_addStyle
// @grant      GM_addValueChangeListener
// @grant      GM_deleteValue
// @grant      GM_getValue
// @grant      GM_log
// @grant      GM_openInTab
// @grant      GM_setValue
// @grant      GM_xmlhttpRequest
// @grant      window.close
// @grant      window.focus
// @run-at     document-start
// ==/UserScript==

(function () {
  'use strict';

  const PREFIX = "[LW Power Reader]";
  const Logger = {
reset: () => {
    },
    debug: (msg, ...args) => {
      console.debug(`${PREFIX} 🐛 ${msg}`, ...args);
    },
    info: (msg, ...args) => {
      console.info(`${PREFIX} ℹ️ ${msg}`, ...args);
    },
    warn: (msg, ...args) => {
      console.warn(`${PREFIX} ⚠️ ${msg}`, ...args);
    },
    error: (msg, ...args) => {
      console.error(`${PREFIX} ❌ ${msg}`, ...args);
    }
  };
  const sleep$1 = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function handleAIStudio() {
    const payload = GM_getValue("ai_studio_prompt_payload");
    if (!payload) {
      Logger.debug("AI Studio: No payload found in GM storage, skipping automation.");
      return;
    }
    Logger.info("AI Studio: Automation triggered.");
    try {
      GM_setValue("ai_studio_status", "Configuring AI model...");
      await automateModelSelection();
      await automateDisableSearch();
      await automateEnableUrlContext();
      GM_setValue("ai_studio_status", "Injecting metadata thread...");
      const requestId = GM_getValue("ai_studio_request_id");
      await injectPrompt(payload);
      await sleep$1(500);
      GM_setValue("ai_studio_status", "Submitting prompt...");
      await automateRun();
      const responseText = await waitForResponse();
      GM_setValue("ai_studio_status", "Response received!");
      GM_setValue("ai_studio_response_payload", {
        text: responseText,
        requestId,
        includeDescendants: GM_getValue("ai_studio_include_descendants", false),
        timestamp: Date.now()
      });
      GM_deleteValue("ai_studio_prompt_payload");
      GM_deleteValue("ai_studio_request_id");
      GM_deleteValue("ai_studio_include_descendants");
      GM_deleteValue("ai_studio_status");
      Logger.info("AI Studio: Response sent. Tab will close in 5m if no interaction.");
      let hasInteracted = false;
      const markInteracted = () => {
        if (!hasInteracted) {
          hasInteracted = true;
          Logger.info("AI Studio: User returned to tab. Auto-close canceled.");
        }
      };
      window.addEventListener("blur", () => {
        window.addEventListener("mousedown", markInteracted, { once: true, capture: true });
        window.addEventListener("keydown", markInteracted, { once: true, capture: true });
        window.addEventListener("mousemove", markInteracted, { once: true, capture: true });
      }, { once: true });
      setTimeout(() => {
        if (!hasInteracted && document.visibilityState !== "visible") {
          Logger.info("AI Studio: Idle and backgrounded. Closing tab.");
          window.close();
        } else if (!hasInteracted) {
          Logger.info("AI Studio: 5m reached but tab is currently visible. Postponing close.");
        }
      }, 5 * 60 * 1e3);
    } catch (error) {
      Logger.error("AI Studio: Automation failed", error);
      GM_setValue("ai_studio_status", `Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  async function waitForElement(selector, timeout = 3e4) {
    return new Promise((resolve, reject) => {
      const check = () => {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) return elements[0];
        return null;
      };
      const existing = check();
      if (existing) return resolve(existing);
      if (window.location.href.includes("accounts.google.com") || document.body?.innerText.includes("Sign in")) {
        return reject(new Error("Login Required"));
      }
      const observer = new MutationObserver((_, obs) => {
        const el = check();
        if (el) {
          obs.disconnect();
          resolve(el);
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Timeout waiting for element: ${selector}`));
      }, timeout);
    });
  }
  async function automateModelSelection() {
    const modelCard = await waitForElement("button.model-selector-card");
    if (modelCard.innerText.includes("Flash 3") || modelCard.innerText.includes("Gemini 3 Flash")) {
      return;
    }
    modelCard.click();
    const flash3Btn = await waitForElement('button[id*="gemini-3-flash-preview"]');
    flash3Btn.click();
  }
  async function automateDisableSearch() {
    const searchToggle = await waitForElement("button[aria-label='Grounding with Google Search']");
    if (searchToggle.classList.contains("mdc-switch--checked")) {
      searchToggle.click();
    }
  }
  async function automateEnableUrlContext() {
    Logger.debug("AI Studio: Searching for URL context toggle...");
    const urlToggle = await waitForElement(
      "button[aria-label='URL context'], button[aria-label='URL Context'], button[aria-label='Browse the url context'], button[aria-label='URL tool'], button[aria-label='URL Tool']",
      5e3
    ).catch(() => null);
    if (urlToggle) {
      if (urlToggle.classList.contains("mdc-switch--unselected")) {
        Logger.info("AI Studio: Enabling URL context tool.");
        urlToggle.click();
      } else {
        Logger.debug("AI Studio: URL context tool already enabled.");
      }
    } else {
      Logger.warn("AI Studio: URL context toggle not found.");
    }
  }
  async function injectPrompt(payload) {
    const textarea = await waitForElement("textarea[aria-label='Enter a prompt']");
    textarea.value = payload;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.focus();
    textarea.setSelectionRange(0, 0);
  }
  async function automateRun() {
    const runBtn = await waitForElement("ms-run-button button");
    runBtn.focus();
    runBtn.click();
  }
  async function waitForResponse(timeoutMs = 18e4) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let generationStarted = false;
      let hasRetried = false;
      const checkCompletion = () => {
        const elapsed = Date.now() - startTime;
        if (elapsed > timeoutMs) return reject(new Error("Timeout"));
        const stopBtn = document.querySelector('button[aria-label="Stop generation"], .ms-button-spinner, mat-icon[data-icon-name="stop"], mat-icon[data-icon-name="progress_activity"]');
        const runBtn = document.querySelector("ms-run-button button");
        const hasResponseNodes = document.querySelector("ms-cmark-node") !== null;
        const hasError = document.querySelector(".model-error") !== null;
        if (stopBtn || hasResponseNodes || hasError) {
          if (!generationStarted) {
            generationStarted = true;
            GM_setValue("ai_studio_status", "AI is thinking...");
          }
        }
        if (generationStarted && !stopBtn && runBtn && runBtn.textContent?.includes("Run")) {
          const turnList = document.querySelectorAll("ms-chat-turn");
          const lastTurn = turnList[turnList.length - 1];
          if (!lastTurn) return setTimeout(checkCompletion, 1e3);
          const errorEl = lastTurn.querySelector(".model-error");
          if (errorEl) {
            if (!hasRetried) {
              const rerunBtn = document.querySelector('button[name="rerun-button"], .rerun-button');
              if (rerunBtn) {
                GM_setValue("ai_studio_status", "Retrying...");
                hasRetried = true;
                generationStarted = false;
                rerunBtn.click();
                return setTimeout(checkCompletion, 2e3);
              }
            }
            return resolve(`<div class="pr-ai-error">Error: ${errorEl.textContent}</div>`);
          }
          const editIcon = Array.from(lastTurn.querySelectorAll(".material-symbols-outlined")).find((el) => el.textContent?.trim() === "edit");
          if (!editIcon) return setTimeout(checkCompletion, 1e3);
          const container = lastTurn.querySelector("div.model-response-content, .message-content, .turn-content") || lastTurn;
          const cleanHtml = container.innerHTML.replace(/<button[^>]*>.*?<\/button>/g, "").replace(/<ms-help-buttons[^>]*>.*?<\/ms-help-buttons>/g, "");
          if (cleanHtml.length > 10) return resolve(cleanHtml);
        }
        setTimeout(checkCompletion, 1e3);
      };
      checkCompletion();
    });
  }
  const getRoute = () => {
    const host = window.location.hostname;
    const pathname = window.location.pathname;
    if (host === "aistudio.google.com") {
      if (!pathname.startsWith("/prompts")) {
        Logger.debug(`AI Studio Router: Skipping non-prompt path: ${pathname}`);
        return { type: "skip" };
      }
      if (window.self !== window.top) {
        Logger.debug("AI Studio Router: Skipping iframe");
        return { type: "skip" };
      }
      return { type: "ai-studio" };
    }
    const isForumDomain = host.includes("lesswrong.com") || host.includes("forum.effectivealtruism.org") || host.includes("greaterwrong.com");
    if (!isForumDomain) {
      return { type: "skip" };
    }
    if (!pathname.startsWith("/reader")) {
      return { type: "forum-injection" };
    }
    if (pathname === "/reader/reset") {
      return { type: "reader", path: "reset" };
    }
    return { type: "reader", path: "main" };
  };
  const runAIStudioMode = async () => {
    Logger.info("AI Studio: Main domain detected, initializing automation...");
    await handleAIStudio();
  };
  const STYLES = `
  html, body {
    margin: 0;
    padding: 0;
    background: #FFFFFF;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #000;
    min-height: 100%;
    line-height: 1.35;
  }

  p {
    margin-block-start: .6em;
    margin-block-end: .6em;
  }

  #power-reader-root {
    margin: 0 auto;
    padding: 20px;
    position: relative;
    box-sizing: border-box;
  }

  /* Resize handles */
  .pr-resize-handle {
    position: fixed;
    top: 0;
    bottom: 0;
    width: 8px;
    cursor: ew-resize;
    z-index: 1000;
    opacity: 0;
    transition: opacity 0.2s;
    background: linear-gradient(to right, transparent, rgba(0,0,0,0.1), transparent);
  }

  .pr-resize-handle:hover,
  .pr-resize-handle.dragging {
    opacity: 1;
    background: linear-gradient(to right, transparent, rgba(0,120,255,0.3), transparent);
  }

  .pr-resize-handle.left {
    left: 0;
  }

  .pr-resize-handle.right {
    right: 0;
  }

  .pr-header {
    margin-bottom: 20px;
    padding-bottom: 10px;
    border-bottom: 1px solid #ddd;
  }

  .pr-header h1 {
    margin: 0 0 10px 0;
  }

  .pr-status {
    color: #666;
    font-size: 0.9em;
  }

  /* Sticky AI status indicator */
  .pr-sticky-ai-status {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: rgba(40, 167, 69, 0.9);
    color: white;
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 0.85em;
    font-weight: bold;
    z-index: 6000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    display: none; /* Hidden by default */
    pointer-events: none;
    transition: opacity 0.3s;
  }

  .pr-sticky-ai-status.visible {
    display: block;
  }

  @keyframes parentHighlight {
    0% { background-color: #ffe066; }
    100% { background-color: transparent; }
  }

  /* Navigation flash (animation) */
  .pr-highlight-parent {
    animation: parentHighlight 2s ease-out forwards;
  }
  .pr-post-header.pr-highlight-parent {
    background: #ffe066 !important;
    animation: parentHighlight 2s ease-out forwards;
  }



  /* Highlight for inline reactions */
  .pr-highlight {
    background-color: #fffacd;
    border-bottom: 2px solid #ffd700;
    cursor: help;
  }

  .pr-warning {
    background: #fff3cd;
    border: 1px solid #ffc107;
    color: #856404;
    padding: 12px 16px;
    border-radius: 4px;
    margin-bottom: 20px;
  }

  .pr-setup {
    max-width: 500px;
    margin: 40px auto;
    padding: 30px;
    background: #f9f9f9;
    border-radius: 8px;
    border: 1px solid #ddd;
  }

  .pr-setup p {
    margin: 0 0 20px 0;
    color: #444;
  }

  .pr-setup-form {
    margin-bottom: 20px;
  }

  .pr-setup-form label {
    display: block;
    margin-bottom: 8px;
    font-weight: 500;
  }

  .pr-setup-form input[type="date"] {
    width: 100%;
    padding: 10px;
    font-size: 16px;
    border: 1px solid #ccc;
    border-radius: 4px;
    box-sizing: border-box;
  }

  .pr-btn {
    display: inline-block;
    padding: 12px 24px;
    background: #0078ff;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 16px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .pr-btn:hover {
    background: #0056cc;
  }

  /* Animation for newly revealed context */
  @keyframes pr-fade-in-glow {
    0% { background-color: #fff3e0; } /* Material Orange 50 */
    100% { background-color: transparent; }
  }

  .pr-just-revealed {
    animation: pr-fade-in-glow 2s ease-out;
  }

  .pr-help {
    background: #f9f9f9;
    margin-bottom: 20px;
    border-radius: 4px;
    font-size: 0.85em;
    border: 1px solid #e0e0e0;
  }

  .pr-help summary {
    padding: 10px 15px;
    cursor: pointer;
    background: #f0f0f0;
    border-radius: 4px 4px 0 0;
    font-weight: bold;
    user-select: none;
  }

  .pr-help summary:hover {
    background: #e8e8e8;
  }

  /* When collapsed, keep bottom rounded */
  .pr-help:not([open]) summary {
    border-radius: 4px;
  }

  .pr-help-content {
    padding: 15px;
    border-top: 1px solid #e0e0e0;
  }

  .pr-help-columns {
    column-count: 3;
    column-gap: 20px;
  }

  @media (max-width: 1200px) {
    .pr-help-columns { column-count: 2; }
  }

  @media (max-width: 800px) {
    .pr-help-columns { column-count: 1; }
  }

  .pr-help-section {
    break-inside: avoid;
    margin-bottom: 8px;
  }


  .pr-help ul {
    margin: 0;
    padding-left: 20px;
  }

  .pr-help li {
    margin: 4px 0;
  }

  .pr-help h4 {
    margin: 12px 0 6px 0;
    font-size: 1em;
  }

  .pr-help h4:first-child {
    margin-top: 0;
  }

  /* Post containers */
  .pr-post {
    margin-bottom: 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: #fafafa;
  }

  .pr-post-header {
    padding: 10px 15px;
    background: #f0f0f0;
    border-bottom: 1px solid #ddd;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .pr-post-header h2 {
    margin: 0;
    flex: 1;
    min-width: 0; /* Allow title to shrink if needed */
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 1.2em;
  }

  .pr-post-meta {
    margin-bottom: 0 !important;
    gap: 8px !important;
    flex-shrink: 0; /* Keep metadata from shrinking */
  }

  .pr-post-header.header-clickable {
    cursor: pointer;
  }

  .pr-post-header.header-clickable:hover {
    background: #e8e8e8;
  }

  .pr-post-header h2 .pr-post-title {
    color: #000;
    text-decoration: none;
  }

  .pr-post-header h2 .pr-post-title:hover {
    text-decoration: underline;
  }

  .pr-post-actions {
    display: inline-flex;
    gap: 2px;
    margin-right: 6px;
  }

  /* Shared Text Button Style */
  .text-btn {
    cursor: pointer;
    opacity: 0.8;
    transition: opacity 0.2s;
    user-select: none;
    padding: 0 2px;
    font-size: 13px !important;
    font-family: monospace;
    color: #333;
  }

  .text-btn:hover:not(.disabled) {
    opacity: 1;
    color: #000;
  }

  .text-btn.disabled {
    opacity: 0.15 !important;
    cursor: not-allowed;
  }

  .pr-post-toggle {
    /* Styles now handled by .text-btn */
  }

  .pr-post-comments {
    padding: 10px;
  }

  .pr-post-comments.collapsed, .pr-post-content.collapsed {
    display: none;
  }

  /* Post body (full content) */
  .pr-post-body-container {
    padding: 15px 20px;
    background: #fff;
    border-bottom: 1px solid #eee;
    font-family: serif;
    line-height: 1.3;
    overflow-wrap: break-word;
    position: relative;
  }

  .pr-post-body-container.truncated {
    overflow: hidden;
    /* max-height is set dynamically from CONFIG */
    padding-bottom: 50px; /* Space for overlay */
  }

  .pr-post-body {
  }

  .pr-post-body img {
    max-width: min(50vw, 100%);
    height: auto;
  }

  .pr-read-more-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 100px;
    background: linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,1) 80%);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: 15px;
    pointer-events: none;
  }

  .pr-read-more-btn {
    background: #0078ff;
    color: #fff;
    border: none;
    padding: 8px 24px;
    border-radius: 20px;
    font-size: 14px;
    font-weight: bold;
    cursor: pointer;
    pointer-events: auto;
    box-shadow: 0 2px 8px rgba(0,120,255,0.3);
  }

  .pr-read-more-btn:hover {
    background: #0056cc;
  }

  /* Shared pr-item class for read tracking */
  .pr-item.read .pr-post-header h2 .pr-post-title {
    color: #707070;
  }

  .pr-item.read .pr-post-body-container {
    opacity: 0.8;
  }

  /* Comment styling */
  .pr-comment {
    margin: 4px 0;
    padding: 0px 10px;
    border: 1px solid black;
    border-radius: 4px;
    background: #fff;
    position: relative; /* Context for absolute positioning */
  }

  .pr-comment.pr-missing-parent {
    min-height: 6px;
    padding-top: 2px;
    padding-bottom: 2px;
  }

  .pr-comment.reply-to-you {
    border: 2px solid #0F0;
  }

  .pr-comment.reply-to-you.read {
    border-width: 1px;
    border-color: #0F0; /* Override general .read border-color */
  }

  .pr-comment.being-summarized, .pr-post.being-summarized {
    border: 2px solid #007bff !important;
    box-shadow: 0 0 8px rgba(0,123,255,0.3);
  }

  .pr-comment.read .pr-comment-body {
    color: #707070;
  }

  .pr-comment.read {
    border-color: #eee;
  }

  .pr-comment.rejected {
    border: 1px solid red;
  }

  .pr-comment-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
    min-height: 24px;
  }

  .pr-author-controls {
    cursor: pointer;
    user-select: none;
    margin: 0 4px;
    display: inline-flex;
    align-items: center;
  }

  .pr-author-controls span {
    margin-right: 2px;
    padding: 0 4px;
    border-radius: 2px;
    font-size: 0.9em;
  }

  .pr-author-controls span:hover {
    background: #e0e0e0;
  }

  .pr-author-controls span.active-up {
    font-weight: bold;
    color: green !important;
  }

  .pr-author-controls span.active-down {
    font-weight: bold;
    color: red !important;
  }

  .pr-author {
    font-weight: bold;
    color: inherit;
    text-decoration: none;
  }

  .pr-author:hover {
    text-decoration: underline;
  }

  .pr-score {
    color: #666;
  }

  .pr-timestamp {
    color: #666;
  }

  .pr-timestamp a {
    color: #666;
    text-decoration: none;
  }

  .pr-timestamp a:hover {
    text-decoration: underline;
  }

  .pr-comment-controls {
    cursor: pointer;
    user-select: none;
    margin-left: auto;
  }

  .pr-comment-action {
    /* Styles now handled by .text-btn */
  }

  .pr-comment-controls span:hover {
    /* Hover color handled by .text-btn */
  }

  .pr-comment-body {
    margin: 4px 0;
    overflow-wrap: break-word;
    line-height: 1.3;
  }

  .pr-comment-body img {
    max-width: min(50vw, 100%);
    height: auto;
  }

  .pr-comment-body blockquote {
    border-left: solid 3px #e0e0e0;
    padding-left: 10px;
    margin: 8px 0 8px 10px;
    color: #555;
  }

  /* Inline Highlights */
  .pr-highlight {
    background-color: #fff9c4; /* Material Yellow 100 */
    cursor: pointer;
    border-bottom: 2px solid #fbc02d; /* Material Yellow 700 */
  }

  .pr-highlight:hover {
    background-color: #fff59d; /* Material Yellow 200 */
  }

  /* Floating Inline Reaction Button */
  .pr-inline-react-btn {
    position: absolute;
    z-index: 1000;
    background: #333;
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    transform: translateX(-50%);
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    pointer-events: auto;
  }

  .pr-inline-react-btn:hover {
    background: #000;
  }

  .pr-inline-react-btn::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    margin-left: -5px;
    border-width: 5px;
    border-style: solid;
    border-color: #333 transparent transparent transparent;
  }



  /* Nested comments */
  .pr-replies {
    margin-left: 20px;
    padding-left: 10px;
    position: relative;
  }

  /* [PR-NEST-05] Visual Indentation Line + 24px Hit Area */
  .pr-replies::before {
    content: '';
    position: absolute;
    left: -11px; /* Centered on the x=0 edge of the container */
    top: 0;
    bottom: 0;
    width: 24px;
    /* 2px solid visual line centered within the 24px hit area */
    background: linear-gradient(to right, transparent 11px, #eee 11px, #eee 13px, transparent 13px);
    cursor: pointer;
    transition: background 0.2s;
    z-index: 1; /* Below content but above container background */
  }

  .pr-replies::before:hover {
    /* Darken line and show subtle background highlight */
    background: linear-gradient(to right, rgba(0,0,0,0.03) 0, rgba(0,0,0,0.03) 11px, #bbb 11px, #bbb 13px, rgba(0,0,0,0.03) 13px, rgba(0,0,0,0.03) 24px);
  }

  /* Collapsed comment preview */
  .pr-comment.collapsed > .pr-comment-body,
  .pr-comment.collapsed > .pr-replies {
    display: none;
  }

  .pr-comment.collapsed > .pr-comment-meta .pr-expand {
    display: inline !important;
  }

  .pr-comment:not(.collapsed) > .pr-comment-meta .pr-expand {
    display: none !important;
  }

  .pr-comment:not(.collapsed) > .pr-comment-meta .pr-collapse {
    display: inline;
  }

  .pr-comment.collapsed > .pr-comment-meta .pr-collapse {
    display: none;
  }

  /* Parent highlight */
  .pr-comment.pr-highlight-parent > .pr-comment-body {
    background-color: yellow !important;
  }

  /* First-time setup */
  .pr-setup {
    max-width: 600px;
    margin: 50px auto;
    padding: 20px;
    background: #f9f9f9;
    border-radius: 8px;
  }

  .pr-setup input[type="text"] {
    width: 100%;
    padding: 8px;
    margin: 10px 0;
    border: 1px solid #ddd;
    border-radius: 4px;
    box-sizing: border-box;
  }

  .pr-setup button {
    padding: 8px 16px;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  .pr-setup button:hover {
    background: #0056b3;
  }

  /* Loading state */
  .pr-loading {
    text-align: center;
    padding: 40px;
    color: #666;
  }

  /* Error state */
  .pr-error {
    color: red;
    padding: 20px;
    text-align: center;
  }

  /* Voting buttons */
  .pr-vote-controls {
    display: inline-flex;
    gap: 2px;
    margin-right: 8px;
    align-items: center;
  }

  .pr-vote-btn {
    cursor: pointer;
    padding: 0 4px;
    border-radius: 2px;
    user-select: none;
    font-size: 0.9em;
  }

  .pr-vote-btn:hover {
    background: #e0e0e0;
  }

  .pr-vote-btn.active-up {
    color: #0a0;
    font-weight: bold;
  }

  .pr-vote-btn.active-down {
    color: #a00;
    font-weight: bold;
  }

  .pr-vote-btn.agree-active {
    color: #090;
    font-weight: bold;
  }

  .pr-vote-btn.disagree-active {
    color: #900;
    font-weight: bold;
  }

  .pr-karma-score {
    font-weight: bold;
    margin: 0 2px;
    min-width: 1.2em;
    text-align: center;
  }

  .pr-agreement-score {
    color: #666;
    min-width: 1.2em;
    text-align: center;
  }

  /* Reactions */
  .pr-reactions-container {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    margin-left: 8px;
    vertical-align: middle;
  }

  .pr-reaction-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
    border: 1px solid #ddd;
    border-radius: 12px;
    background: #f8f8f8;
    font-size: 0.85em;
    cursor: pointer;
    user-select: none;
    transition: all 0.2s;
  }

  .pr-reaction-chip:hover {
    background: #eee;
    border-color: #ccc;
  }

  .pr-reaction-chip.voted {
    background: #e3f2fd;
    border-color: #2196f3;
  }

  .pr-reaction-icon {
    width: 1.1em;
    height: 1.1em;
    display: inline-block;
  }

  .pr-reaction-icon img {
    width: 100%;
    height: 100%;
    vertical-align: top;
  }

  .pr-add-reaction-btn {
    cursor: pointer;
    padding: 2px 6px;
    color: #888;
    font-size: 1.1em;
    line-height: 1;
    user-select: none;
    transition: color 0.2s;
  }

  .pr-add-reaction-btn:hover {
    color: #333;
  }

  .pr-add-reaction-btn svg {
    display: inline-block;
    vertical-align: middle;
    pointer-events: none; /* Let the click fall through to the button */
    width: 1em;
    height: 1em;
  }

  /* Reaction Picker */
  .pr-reaction-picker {
    position: absolute;
    z-index: 3000;
    background: white;
    border: 1px solid #ccc;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    padding: 0;
    width: fit-content;
    max-width: 95vw;
    height: auto;
    display: none;
    box-sizing: border-box;
    flex-direction: column;
    overflow: visible;
  }

  .pr-reaction-picker.visible {
    display: flex;
  }

  .pr-picker-header {
    padding: 8px 12px 0 12px;
    flex-shrink: 0;
  }

  .pr-picker-scroll-container {
    padding: 0 12px 12px 12px;
    overflow-y: auto;
    overflow-x: hidden;
    flex-grow: 1;
    scrollbar-width: thin;
  }

  .pr-reaction-picker * {
    box-sizing: border-box;
  }

  .pr-picker-search {
    margin-bottom: 8px;
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .pr-picker-search input {
    flex: 1;
    padding: 6px 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
  }

  .pr-picker-section-title {
    font-size: 0.75em;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 8px 0 4px 0;
    padding-bottom: 2px;
    border-bottom: 1px solid #eee;
  }
  
  .pr-picker-section-title:first-child {
    margin-top: 0;
  }

  .pr-picker-grid-separator {
    grid-column: 1 / -1;
    height: 1px;
    background: #bbb;
    margin: 8px 0;
  }

  .pr-reaction-picker-grid {
    display: grid;
    grid-template-columns: repeat(9, 38px);
    gap: 4px;
    width: 100%;
  }

  .pr-reaction-picker-item {
    width: 38px;
    height: 38px;
    padding: 0;
    cursor: pointer;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.1s;
    position: relative; /* CRITICAL for tooltips */
  }

  .pr-reaction-picker-item:hover {
    background: #f0f0f0;
  }
  
  .pr-reaction-picker-item.active {
    background: #e3f2fd;
    border: 1px solid #2196f3;
  }

  .pr-reaction-picker-item img {
    width: 24px;
    height: 24px;
  }

  .pr-tooltip-global {
    position: fixed;
    z-index: 9999;
    background: #222;
    color: white;
    padding: 6px 10px;
    border-radius: 4px;
    font-size: 11px;
    white-space: normal;
    min-width: 100px;
    max-width: 180px;
    text-align: left;
    pointer-events: none;
    line-height: 1.4;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    border: 1px solid #444;
    visibility: hidden;
    opacity: 0;
    transition: opacity 0.1s;
  }

  .pr-tooltip-global strong {
    display: block;
    margin-bottom: 2px;
    font-size: 1.1em;
    color: #fff;
  }

  /* Hover preview */
  .pr-preview-overlay {
    position: fixed;
    z-index: 2000;
    background: #fff;
    border: 2px solid #333;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    max-height: 80vh;
    overflow-y: auto;
    padding: 16px;
    pointer-events: auto;
  }

  .pr-preview-overlay.post-preview {
    max-width: 80vw;
    width: 800px;
  }

  .pr-preview-overlay.comment-preview {
    max-width: 600px;
  }

  .pr-preview-overlay.author-preview {
    max-width: 500px;
    border-color: #0078ff;
  }

  .pr-preview-overlay .pr-preview-header {
    font-weight: bold;
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid #ddd;
  }

  .pr-preview-overlay .pr-preview-content {
    line-height: 1.6;
    font-family: serif;
  }

  .pr-preview-overlay .pr-preview-content img {
    max-width: 100%;
  }

  .pr-preview-loading {
    text-align: center;
    color: #666;
    padding: 20px;
  }

  /* Sticky post header */
  .pr-sticky-header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1500;
    display: none;
  }

  .pr-sticky-header.visible {
    display: block;
  }

  .pr-sticky-header .pr-post-header {
    margin: 0 auto;
    border-bottom: 2px solid #333;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    cursor: pointer;
  }

  .pr-sticky-header .pr-post-header h2 .pr-post-title {
    cursor: pointer;
  }

  /* List View Styles */
  .pr-picker-view-toggle {
    float: right;
    cursor: pointer;
    color: #888;
    font-size: 18px;
    user-select: none;
    padding: 0 4px;
  }
  .pr-picker-view-toggle:hover {
    color: #333;
  }

  .pr-reaction-picker-list {
    display: flex;
    flex-wrap: wrap;
    width: 0;
    min-width: 100%;
  }

  /* List Item (Icon + Label) */
  .pr-reaction-list-item {
    width: 50%;
    max-width: 50%;
    height: 32px;
    box-sizing: border-box;
    padding: 2px 4px;
    display: flex;
    align-items: center;
    cursor: pointer;
    border-radius: 4px;
    transition: background 0.2s;
  }
  .pr-reaction-list-item:hover {
    background: #f0f0f0;
  }
  .pr-reaction-list-item.active {
    background: #e3f2fd;
    border: 1px solid #2196f3;
  }
  .pr-reaction-list-item img {
    width: 20px;
    height: 20px;
    margin-right: 8px;
    flex-shrink: 0;
  }
  .pr-reaction-list-item span {
    font-size: 13px;
    white-space: pre-wrap; /* Allows 
 to break lines */
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .pr-reaction-list-item span.small {
    font-size: 11px;
  }

  .pr-debug-btn {
    padding: 6px 12px;
    background: #6c757d;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9em;
    margin-right: 8px;
  }

  .pr-debug-btn:hover {
    background: #5a6268;
  }

  /* Bottom message */
  .pr-bottom-message {
    margin: 10px auto;
    padding: 15px 20px;
    text-align: center;
    border: 2px dashed #ccc;
    border-radius: 8px;
    color: #666;
    cursor: pointer;
    transition: all 0.2s;
    max-width: 600px;
  }

  .pr-bottom-message:hover {
    background: #f0f0f0;
    border-color: #999;
    color: #333;
  }

  .pr-bottom-message.has-more {
    background: #e3f2fd;
    border-color: #2196f3;
    color: #0d47a1;
    border-style: solid;
  }


  /* AI Studio Response Popup */
  .pr-ai-popup {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    max-width: 100%;
    max-height: 50vh;
    background: white;
    border-bottom: 2px solid #007bff;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    z-index: 5000;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .pr-ai-popup-header {
    background: #f0f7ff;
    padding: 6px 15px;
    border-bottom: 1px solid #cce5ff;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .pr-ai-popup-header h3 {
    margin: 0;
    font-size: 0.9em;
    color: #004085;
  }

  .pr-ai-popup-content {
    padding: 12px 15px;
    overflow-y: auto;
    font-family: inherit;
    font-size: 0.95em;
    line-height: 1.4;
    color: #333;
  }

  .pr-ai-popup-content p { margin-bottom: 0.5em; }
  .pr-ai-popup-content ul, .pr-ai-popup-content ol { margin-bottom: 0.5em; padding-left: 1.5em; }
  .pr-ai-popup-content li { margin-bottom: 0.3em; }
  
  .pr-ai-popup-content h1, 
  .pr-ai-popup-content h2, 
  .pr-ai-popup-content h3 {
    margin-top: 0.8em;
    margin-bottom: 0.3em;
    font-size: 1.1em;
    border-bottom: 1px solid #eee;
    color: #111;
  }

  .pr-ai-popup-content code {
    background: #f8f9fa;
    padding: 2px 4px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.9em;
    border: 1px solid #ddd;
  }

  .pr-ai-popup-content pre {
    background: #f8f9fa;
    padding: 10px;
    border-radius: 6px;
    overflow-x: auto;
    border: 1px solid #ddd;
    margin-bottom: 0.6em;
  }

  /* Math/KaTeX Support from AI Studio */
  .pr-ai-popup-content .inline {
    display: inline-block;
    vertical-align: middle;
  }
  
  .pr-ai-popup-content .display {
    display: block;
    text-align: center;
    margin: 1em 0;
  }

  /* Reset pre styles when inside math containers or containing KaTeX to stay inline/clean */
  .pr-ai-popup-content .inline pre,
  .pr-ai-popup-content .display pre,
  .pr-ai-popup-content pre:has(.katex),
  .pr-ai-popup-content pre:has(.rendered) {
    display: inline-flex;
    flex-direction: column;
    background: transparent;
    padding: 0;
    margin: 0;
    border: none;
    border-radius: 0;
    overflow: visible;
    vertical-align: middle;
  }

  .pr-ai-popup-content blockquote {
    border-left: 4px solid #ddd;
    padding-left: 15px;
    margin: 1em 0;
    color: #666;
    font-style: italic;
  }

  /* Support for AI Studio's custom tags - must be inline to avoid breaking sentences */
  ms-cmark-node { display: inline; }

  .pr-ai-popup-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .pr-ai-popup-close, .pr-ai-popup-regen {
    color: white;
    border: none;
    padding: 4px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
    font-size: 0.85em;
    transition: background 0.2s;
  }

  .pr-ai-popup-close {
    background: #6c757d;
  }

  .pr-ai-popup-close:hover {
    background: #5a6268;
  }

  .pr-ai-popup-regen {
    background: #28a745;
  }

  .pr-ai-popup-regen:hover {
    background: #218838;
  }

  .pr-ai-popup-content hr {
    border: 0;
    border-top: 1px solid #ccc;
    margin: 10px 0;
  }
  /* Footnote styling: force inline display */
  /* Footnote styling: force inline display */
  .footnote, .footnote-content {
    display: inline !important;
    margin-left: 4px;
  }
  .footnote p, .footnote-content p {
    display: inline !important;
    margin: 0 !important;
  }

  /* Recency highlight via CSS custom property (overridable by .pr-parent-hover) */
  .pr-comment[style*="--pr-recency-color"] {
    background-color: var(--pr-recency-color);
  }

  /* Hover state (static) - higher specificity to override recency */
  .pr-comment.pr-parent-hover,
  .pr-post-header.pr-parent-hover,
  .pr-post-body-container.pr-parent-hover {
    background-color: #ffe066 !important;
    outline: 2px solid orange !important;
    transition: background-color 0.2s;
  }
`;
  const createInitialState = () => ({
    currentUsername: null,
    currentUserId: null,
    currentUserPaletteStyle: null,
    comments: [],
    posts: [],
    commentById: new Map(),
    postById: new Map(),
    childrenByParentId: new Map(),
    subscribedAuthorIds: new Set(),
    moreCommentsAvailable: false,
    primaryPostsCount: 0,
    initialBatchNewestDate: null,
    currentSelection: null,
    lastMousePos: { x: 0, y: 0 },
    currentAIRequestId: null,
    activeAIPopup: null,
    sessionAICache: {}
  });
  const rebuildIndexes = (state2) => {
    state2.commentById.clear();
    state2.comments.forEach((c) => state2.commentById.set(c._id, c));
    state2.postById.clear();
    state2.posts.forEach((p) => state2.postById.set(p._id, p));
    state2.childrenByParentId.clear();
    state2.comments.forEach((c) => {
      const parentId = c.parentCommentId || "";
      if (!state2.childrenByParentId.has(parentId)) {
        state2.childrenByParentId.set(parentId, []);
      }
      state2.childrenByParentId.get(parentId).push(c);
    });
    state2.childrenByParentId.forEach((children) => {
      children.sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
    });
  };
  const syncCommentInState = (state2, commentId, updates) => {
    const comment = state2.commentById.get(commentId);
    if (comment) {
      Object.assign(comment, updates);
    }
  };
  let globalState = null;
  const getState = () => {
    if (!globalState) {
      globalState = createInitialState();
    }
    return globalState;
  };
  const executeTakeover = () => {
    window.getState = getState;
    window.stop();
    const originalCreateElement = document.createElement.bind(document);
    document.createElement = function(tagName, options) {
      if (tagName.toLowerCase() === "script") {
        Logger.warn("Blocking script creation attempt");
        return originalCreateElement("div");
      }
      return originalCreateElement(tagName, options);
    };
    const scriptObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLScriptElement) {
            node.remove();
          }
        });
      });
    });
    scriptObserver.observe(document.documentElement, { childList: true, subtree: true });
    Logger.info("Initializing...");
    const protectionObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          const root = document.getElementById("power-reader-root");
          if (document.body && !root && !document.querySelector(".pr-loading")) {
            Logger.warn("UI cleared by site code! Re-injecting...");
            rebuildDocument();
          }
        }
      }
    });
    protectionObserver.observe(document.documentElement, { childList: true, subtree: true });
  };
  const rebuildDocument = () => {
    const html = `
    <head>
      <meta charset="UTF-8">
      <title>Less Wrong: Power Reader v${"1.2.538"}</title>
      <style>${STYLES}</style>
    </head>
    <body>
      <div id="power-reader-root">
        <div class="pr-loading">Loading Power Reader...</div>
      </div>
      <div id="pr-sticky-header" class="pr-sticky-header"></div>
      <div id="lw-power-reader-ready-signal" style="display: none;"></div>
    </body>
  `;
    if (document.documentElement) {
      document.documentElement.innerHTML = html;
    } else {
      Logger.warn("document.documentElement is missing, attempting fallback write");
      document.write(html);
      document.close();
    }
  };
  const signalReady = () => {
    const signal = document.getElementById("lw-power-reader-ready-signal");
    if (signal) {
      signal.style.display = "block";
    }
    window.__LW_POWER_READER_READY__ = true;
  };
  const getRoot = () => {
    return document.getElementById("power-reader-root");
  };
  function getGraphQLEndpoint() {
    const hostname = window.location.hostname;
    if (hostname === "forum.effectivealtruism.org") {
      return "https://forum.effectivealtruism.org/graphql";
    }
    return "https://www.lesswrong.com/graphql";
  }
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  function makeRequest(url, data) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "POST",
        url,
        headers: { "Content-Type": "application/json" },
        data,
        timeout: 3e4,
        onload: (response) => resolve(response),
        onerror: (err) => reject(err),
        ontimeout: () => reject(new Error("Request timed out"))
      });
    });
  }
  async function queryGraphQL(query, variables = {}) {
    const url = getGraphQLEndpoint();
    const data = JSON.stringify({ query, variables });
    const maxAttempts = 3;
    const delays = [1e3, 2e3];
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await makeRequest(url, data);
        if (response.status === 429 || response.status >= 500) {
          if (attempt < maxAttempts - 1) {
            await sleep(delays[attempt]);
            continue;
          }
          throw new Error(`HTTP ${response.status} after ${maxAttempts} attempts`);
        }
        const res = JSON.parse(response.responseText);
        if (res.errors) {
          throw new Error(res.errors[0].message);
        }
        return res.data;
      } catch (err) {
        const isRetryable = err instanceof Error && (err.message === "Request timed out" || err.message.startsWith("HTTP "));
        if (isRetryable && attempt < maxAttempts - 1) {
          await sleep(delays[attempt]);
          continue;
        }
        if (err instanceof Error && err.message.startsWith("HTTP ")) {
          throw err;
        }
        if (attempt < maxAttempts - 1 && !(err instanceof Error)) {
          await sleep(delays[attempt]);
          continue;
        }
        throw err;
      }
    }
    throw new Error("Failed to execute GraphQL query");
  }
  const GET_CURRENT_USER = (
`
  query GetCurrentUser {
    currentUser {
      _id
      username
      slug
      karma
      reactPaletteStyle
    }
  }
`
  );
  const GET_SUBSCRIPTIONS = (
`
  query GetSubscriptions($userId: String!) {
    subscriptions(selector: { subscriptionState: { userId: $userId, collectionName: "Users" } }) {
      results {
        documentId
      }
    }
  }
`
  );
  const POST_FIELDS_LITE = (
`
  fragment PostFieldsLite on Post {
    _id
    title
    slug
    pageUrl
    postedAt
    baseScore
    voteCount
    commentCount
    wordCount
    user {
      _id
      username
      displayName
      slug
      karma
    }
    extendedScore
    afExtendedScore
    currentUserVote
    currentUserExtendedVote
  }
`
  );
  const POST_FIELDS_FULL = (
`
  fragment PostFieldsFull on Post {
    ...PostFieldsLite
    htmlBody
    contents { markdown }
  }
  ${POST_FIELDS_LITE}
`
  );
  const COMMENT_FIELDS_CORE = (
`
  fragment CommentFieldsCore on Comment {
    _id
    postedAt
    htmlBody
    baseScore
    voteCount
    descendentCount
    directChildrenCount
    pageUrl
    author
    rejected
    topLevelCommentId
    user {
      _id
      username
      displayName
      slug
      karma
      htmlBio
    }
    postId
    parentCommentId
    parentComment {
      _id
      parentCommentId
      parentComment {
        _id
        parentCommentId
        parentComment {
          _id
          parentCommentId
          parentComment {
            _id
            parentCommentId
            parentComment {
              _id
              parentCommentId
            }
          }
        }
      }
      user {
        _id
        username
        displayName
      }
    }
    extendedScore
    afExtendedScore
    currentUserVote
    currentUserExtendedVote
  }
`
  );
  const COMMENT_FIELDS_LITE = (
`
  fragment CommentFieldsLite on Comment {
    ...CommentFieldsCore
    post {
      ...PostFieldsLite
    }
  }
  ${COMMENT_FIELDS_CORE}
  ${POST_FIELDS_LITE}
`
  );
  const COMMENT_FIELDS = (
`
  fragment CommentFieldsFull on Comment {
    ...CommentFieldsCore
    contents { markdown }
    post {
      ...PostFieldsFull
    }
    latestChildren {
      _id
      postedAt
      htmlBody
      baseScore
      voteCount
      descendentCount
      directChildrenCount
      pageUrl
      author
      rejected
      topLevelCommentId
      postId
      parentCommentId
    }
  }
  ${COMMENT_FIELDS_CORE}
  ${POST_FIELDS_FULL}
`
  );
  const GET_ALL_RECENT_COMMENTS_LITE = (
`
  query GetAllRecentCommentsLite($limit: Int, $after: String, $before: String, $offset: Int, $sortBy: String) {
    comments(
      selector: {
        allRecentComments: {
          after: $after,
          before: $before,
          sortBy: $sortBy
        }
      },
      limit: $limit,
      offset: $offset
    ) {
      results {
        ...CommentFieldsLite
      }
    }
  }
  ${COMMENT_FIELDS_LITE}
`
  );
  const GET_ALL_RECENT_COMMENTS = (
`
  query GetAllRecentComments($limit: Int, $after: String, $before: String, $offset: Int, $sortBy: String) {
    comments(
      selector: {
        allRecentComments: {
          after: $after,
          before: $before,
          sortBy: $sortBy
        }
      },
      limit: $limit,
      offset: $offset
    ) {
      results {
        ...CommentFieldsFull
      }
    }
  }
  ${COMMENT_FIELDS}
`
  );
  const GET_COMMENTS_BY_IDS = (
`
  query GetCommentsByIds($commentIds: [String!]) {
    comments(
      selector: {
        default: {
          commentIds: $commentIds
        }
      }
    ) {
      results {
        ...CommentFieldsFull
      }
    }
  }
  ${COMMENT_FIELDS}
`
  );
  const VOTE_MUTATION = (
`
  mutation Vote($documentId: String!, $voteType: String!, $extendedVote: JSON) {
    performVoteComment(documentId: $documentId, voteType: $voteType, extendedVote: $extendedVote) {
      document {
        _id
        baseScore
        voteCount
        extendedScore
        afExtendedScore
        currentUserVote
        currentUserExtendedVote
        contents { markdown }
      }
    }
  }
`
  );
  const GET_POST = (
`
  query GetPost($id: String!) {
    post(selector: { _id: $id }) {
      result {
        ...PostFieldsFull
      }
    }
  }
  ${POST_FIELDS_FULL}
`
  );
  const GET_NEW_POSTS_FULL = (
`
  query GetNewPostsFull($limit: Int, $after: String, $before: String) {
    posts(
      selector: {
        new: {
          after: $after,
          before: $before
        }
      },
      limit: $limit
    ) {
      results {
        ...PostFieldsFull
      }
    }
  }
  ${POST_FIELDS_FULL}
`
  );
  const GET_POST_COMMENTS = (
`
  query GetPostComments($postId: String!, $limit: Int) {
    comments(
      selector: {
        postCommentsNew: {
          postId: $postId
        }
      },
      limit: $limit
    ) {
      results {
        ...CommentFieldsFull
      }
    }
  }
  ${COMMENT_FIELDS}
`
  );
  const GET_THREAD_COMMENTS = (
`
  query GetThreadComments($topLevelCommentId: String!, $limit: Int) {
    comments(
      selector: {
        repliesToCommentThreadIncludingRoot: {
          topLevelCommentId: $topLevelCommentId
        }
      },
      limit: $limit
    ) {
      results {
        ...CommentFieldsFull
      }
    }
  }
  ${COMMENT_FIELDS}
`
  );
  const GET_USER = (
`
  query GetUser($id: String!) {
    user(selector: { _id: $id }) {
      result {
        _id
        username
        displayName
        slug
        karma
        htmlBio
      }
    }
  }
`
  );
  const GET_USER_BY_SLUG = (
`
  query GetUserBySlug($slug: String!) {
    user: GetUserBySlug(slug: $slug) {
      _id
      username
      displayName
      slug
      karma
      htmlBio
    }
  }
`
  );
  const GET_POST_BY_ID = GET_POST;
  const GET_COMMENT = (
`
  query GetComment($id: String!) {
    comment(selector: { _id: $id }) {
      result {
        ...CommentFieldsFull
      }
    }
  }
  ${COMMENT_FIELDS}
`
  );
  const STORAGE_KEYS = {
    READ: "power-reader-read",
    READ_FROM: "power-reader-read-from",
    AUTHOR_PREFS: "power-reader-author-prefs",
    VIEW_WIDTH: "power-reader-view-width",
    AI_STUDIO_PREFIX: "power-reader-ai-studio-prefix"
  };
  function getKey(baseKey) {
    const hostname = window.location.hostname;
    if (hostname.includes("effectivealtruism.org")) {
      return `ea-${baseKey}`;
    }
    return baseKey;
  }
  let cachedReadState = null;
  let lastReadStateFetch = 0;
  let cachedLoadFrom = null;
  let lastLoadFromFetch = 0;
  function getReadState() {
    const now = Date.now();
    if (cachedReadState && now - lastReadStateFetch < 100) {
      return cachedReadState;
    }
    try {
      const raw = GM_getValue(getKey(STORAGE_KEYS.READ), "{}");
      cachedReadState = JSON.parse(raw);
      lastReadStateFetch = now;
      return cachedReadState;
    } catch {
      return {};
    }
  }
  function setReadState(state2) {
    cachedReadState = state2;
    lastReadStateFetch = Date.now();
    GM_setValue(getKey(STORAGE_KEYS.READ), JSON.stringify(state2));
  }
  function isRead(id, state2, postedAt) {
    const readMap = state2 || getReadState();
    if (readMap[id] === 1) return true;
    if (postedAt) {
      const cutoff = getLoadFrom();
      if (cutoff && cutoff.includes("T")) {
        const postTime = new Date(postedAt).getTime();
        const cutoffTime = new Date(cutoff).getTime();
        if (!isNaN(postTime) && !isNaN(cutoffTime) && postTime < cutoffTime) {
          return true;
        }
      }
    }
    return false;
  }
  function markAsRead(target) {
    const state2 = getReadState();
    if (typeof target === "string") {
      state2[target] = 1;
    } else {
      Object.assign(state2, target);
    }
    setReadState(state2);
  }
  function getLoadFrom() {
    const now = Date.now();
    if (cachedLoadFrom && now - lastLoadFromFetch < 100) {
      return cachedLoadFrom;
    }
    const raw = GM_getValue(getKey(STORAGE_KEYS.READ_FROM), "");
    cachedLoadFrom = raw;
    lastLoadFromFetch = now;
    return raw;
  }
  function setLoadFrom(isoDatetime) {
    cachedLoadFrom = isoDatetime;
    lastLoadFromFetch = Date.now();
    GM_setValue(getKey(STORAGE_KEYS.READ_FROM), isoDatetime);
  }
  function getAuthorPreferences() {
    try {
      const raw = GM_getValue(getKey(STORAGE_KEYS.AUTHOR_PREFS), "{}");
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  function setAuthorPreferences(prefs) {
    GM_setValue(getKey(STORAGE_KEYS.AUTHOR_PREFS), JSON.stringify(prefs));
  }
  function toggleAuthorPreference(author, direction) {
    const prefs = getAuthorPreferences();
    const current = prefs[author] || 0;
    let newValue;
    if (direction === "up") {
      newValue = current > 0 ? 0 : 1;
    } else {
      newValue = current < 0 ? 0 : -1;
    }
    prefs[author] = newValue;
    setAuthorPreferences(prefs);
    return newValue;
  }
  function clearAllStorage() {
    GM_setValue(getKey(STORAGE_KEYS.READ), "{}");
    GM_setValue(getKey(STORAGE_KEYS.READ_FROM), "");
    GM_setValue(getKey(STORAGE_KEYS.AUTHOR_PREFS), "{}");
    GM_setValue(getKey(STORAGE_KEYS.VIEW_WIDTH), "0");
  }
  function getViewWidth() {
    const raw = GM_getValue(getKey(STORAGE_KEYS.VIEW_WIDTH), "0");
    return parseInt(raw, 10) || 0;
  }
  function setViewWidth(width) {
    GM_setValue(getKey(STORAGE_KEYS.VIEW_WIDTH), String(width));
  }
  function getAIStudioPrefix() {
    return GM_getValue(getKey(STORAGE_KEYS.AI_STUDIO_PREFIX), "");
  }
  function setAIStudioPrefix(prefix) {
    GM_setValue(getKey(STORAGE_KEYS.AI_STUDIO_PREFIX), prefix);
  }
  async function exportState() {
    const exportData = {};
    for (const key of Object.values(STORAGE_KEYS)) {
      const namespacedKey = getKey(key);
      exportData[namespacedKey] = GM_getValue(namespacedKey, "");
    }
    const json = JSON.stringify(exportData, null, 2);
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(json);
        alert("Power Reader state copied to clipboard!");
      } catch (e) {
        Logger.error("Clipboard write failed:", e);
        alert("Failed to write to clipboard. Check console.");
      }
    } else {
      Logger.info("Exported State:", json);
      alert("Clipboard API not available. State logged to console.");
    }
  }
  const CONFIG = {
    loadMax: window.PR_TEST_LIMIT || 800,
    highlightLastN: 33,
    scrollMarkDelay: window.PR_TEST_SCROLL_DELAY ?? 5e3,
hoverDelay: 300,
    maxPostHeight: "50vh"
  };
  const loadInitial = async () => {
    const injection = window.__PR_TEST_STATE_INJECTION__;
    if (injection) {
      Logger.info("Using injected test state");
      return {
        comments: injection.comments || [],
        posts: injection.posts || [],
        currentUsername: injection.currentUsername || null,
        currentUserId: injection.currentUserId || null,
        currentUserPaletteStyle: injection.currentUserPaletteStyle || null
      };
    }
    const loadFrom = getLoadFrom();
    const afterDate = loadFrom === "__LOAD_RECENT__" ? void 0 : loadFrom;
    Logger.info(`Initial fetch: after=${afterDate}`);
    const start = performance.now();
    const [userRes, commentsRes] = await Promise.all([
      queryGraphQL(GET_CURRENT_USER),
      queryGraphQL(GET_ALL_RECENT_COMMENTS_LITE, {
        after: afterDate,
        limit: CONFIG.loadMax,
        sortBy: afterDate ? "oldest" : "newest"
      })
    ]);
    const networkTime = performance.now() - start;
    Logger.info(`Initial fetch network request took ${networkTime.toFixed(2)}ms`);
    const comments = commentsRes?.comments?.results || [];
    let currentUsername = null;
    let currentUserId = null;
    let currentUserPaletteStyle = null;
    if (userRes?.currentUser) {
      currentUsername = userRes.currentUser.username || "";
      currentUserId = userRes.currentUser._id;
      currentUserPaletteStyle = userRes.currentUser.reactPaletteStyle || null;
    }
    const posts = [];
    const seenPostIds = new Set();
    comments.forEach((c) => {
      if (c && c.post) {
        const postId = c.post._id;
        if (!seenPostIds.has(postId)) {
          seenPostIds.add(postId);
          posts.push(c.post);
        }
      }
    });
    const result = {
      comments,
      posts,
      currentUsername,
      currentUserId,
      currentUserPaletteStyle,
      lastInitialCommentDate: comments.length > 0 ? comments[comments.length - 1].postedAt : void 0
    };
    const totalTime = performance.now() - start;
    Logger.info(`Initial load completed in ${totalTime.toFixed(2)}ms (processing: ${(totalTime - networkTime).toFixed(2)}ms)`);
    return result;
  };
  const fetchRepliesBatch = async (parentIds) => {
    const start = performance.now();
    if (parentIds.length === 0) return [];
    const CHUNK_SIZE = 30;
    const allResults = [];
    for (let i = 0; i < parentIds.length; i += CHUNK_SIZE) {
      const chunk = parentIds.slice(i, i + CHUNK_SIZE);
      const query = `
      query GetRepliesBatch(${chunk.map((_, j) => `$id${j}: String!`).join(", ")}) {
        ${chunk.map((_, j) => `
          r${j}: comments(selector: { commentReplies: { parentCommentId: $id${j} } }) {
            results {
              ${COMMENT_FIELDS}
            }
          }
        `).join("\n")}
      }
    `;
      const variables = {};
      chunk.forEach((id, j) => variables[`id${j}`] = id);
      try {
        const res = await queryGraphQL(query, variables);
        if (!res) continue;
        chunk.forEach((_, j) => {
          const results = res[`r${j}`]?.results || [];
          allResults.push(...results);
        });
      } catch (e) {
        Logger.error(`Batch reply fetch failed for chunk starting at ${i}`, e);
      }
    }
    Logger.info(`Batch reply fetch for ${parentIds.length} parents took ${(performance.now() - start).toFixed(2)}ms`);
    return allResults;
  };
  const fetchThreadsBatch = async (threadIds) => {
    const start = performance.now();
    if (threadIds.length === 0) return [];
    const CHUNK_SIZE = 15;
    const allResults = [];
    for (let i = 0; i < threadIds.length; i += CHUNK_SIZE) {
      const chunk = threadIds.slice(i, i + CHUNK_SIZE);
      const query = `
      query GetThreadsBatch(${chunk.map((_, j) => `$id${j}: String!`).join(", ")}) {
        ${chunk.map((_, j) => `
          t${j}: comments(selector: { repliesToCommentThreadIncludingRoot: { topLevelCommentId: $id${j} } }, limit: 100) {
            results {
              ${COMMENT_FIELDS}
            }
          }
        `).join("\n")}
      }
    `;
      const variables = {};
      chunk.forEach((id, j) => variables[`id${j}`] = id);
      try {
        const res = await queryGraphQL(query, variables);
        if (!res) continue;
        chunk.forEach((_, j) => {
          const results = res[`t${j}`]?.results || [];
          allResults.push(...results);
        });
      } catch (e) {
        Logger.error(`Batch thread fetch failed for chunk starting at ${i}`, e);
      }
    }
    Logger.info(`Batch thread fetch for ${threadIds.length} threads took ${(performance.now() - start).toFixed(2)}ms`);
    return allResults;
  };
  const enrichInBackground = async (state2) => {
    const start = performance.now();
    const injection = window.__PR_TEST_STATE_INJECTION__;
    if (injection && injection.posts) {
      return {
        posts: injection.posts,
        comments: injection.comments || state2.comments,
        subscribedAuthorIds: new Set(),
        moreCommentsAvailable: false,
        primaryPostsCount: injection.posts.length
      };
    }
    const currentUserId = state2.currentUserId;
    const allComments = [...state2.comments];
    const subsPromise = currentUserId ? queryGraphQL(GET_SUBSCRIPTIONS, { userId: currentUserId }) : Promise.resolve(null);
    const loadFrom = getLoadFrom();
    const isLoadRecent = loadFrom === "__LOAD_RECENT__";
    const afterDate = isLoadRecent ? void 0 : loadFrom;
    let startDate = afterDate;
    let endDate = void 0;
    if (allComments.length > 0) {
      const commentDates = allComments.map((c) => c && c.postedAt).filter((d) => !!d).sort();
      const oldestCommentDate = commentDates[0];
      const newestCommentDate = commentDates[commentDates.length - 1];
      if (isLoadRecent) {
        startDate = oldestCommentDate;
      } else if (allComments.length >= CONFIG.loadMax) {
        endDate = newestCommentDate;
      }
    }
    const [postsRes, subsRes] = await Promise.all([
      queryGraphQL(GET_NEW_POSTS_FULL, {
        after: startDate,
        before: endDate,
        limit: CONFIG.loadMax
      }),
      subsPromise
    ]);
    const fetchTime = performance.now() - start;
    Logger.info(`Enrichment posts/subs fetch took ${fetchTime.toFixed(2)}ms`);
    const batchPosts = postsRes?.posts?.results || [];
    const primaryPostsCount = batchPosts.length;
    const subscribedAuthorIds = new Set();
    if (subsRes?.subscriptions?.results) {
      subsRes.subscriptions.results.forEach((r) => {
        if (r.documentId) subscribedAuthorIds.add(r.documentId);
      });
    }
    const updatedPosts = [...batchPosts];
    const postIdSet = new Set(batchPosts.map((p) => p._id));
    allComments.forEach((c) => {
      if (c && c.post) {
        const postId = c.post._id;
        if (!postIdSet.has(postId)) {
          postIdSet.add(postId);
          updatedPosts.push(c.post);
        }
      }
    });
    const loadFromValue = getLoadFrom();
    const moreCommentsAvailable = loadFromValue !== "__LOAD_RECENT__" && allComments.length >= CONFIG.loadMax;
    const result = {
      posts: updatedPosts,
      comments: allComments,
      subscribedAuthorIds,
      moreCommentsAvailable,
      primaryPostsCount
    };
    Logger.info(`Enrichment completed in ${(performance.now() - start).toFixed(2)}ms`);
    return result;
  };
  const runSmartLoading = async (state2, readState) => {
    const allComments = [...state2.comments];
    const moreCommentsAvailable = state2.moreCommentsAvailable;
    const forceSmartLoading = window.PR_TEST_FORCE_SMART_LOADING === true;
    const unreadComments = allComments.filter((c) => !readState[c._id]);
    if (!moreCommentsAvailable && !forceSmartLoading || unreadComments.length === 0) {
      return null;
    }
    const start = performance.now();
    Logger.info(`Smart Loading: Processing ${unreadComments.length} unread comments...`);
    const commentMap = new Map();
    allComments.forEach((c) => commentMap.set(c._id, c));
    const unreadByThread = new Map();
    unreadComments.forEach((c) => {
      const threadId = c.topLevelCommentId || c.postId || c._id;
      if (!unreadByThread.has(threadId)) {
        unreadByThread.set(threadId, []);
      }
      unreadByThread.get(threadId).push(c);
    });
    const mergeComment = (comment) => {
      if (!commentMap.has(comment._id)) {
        allComments.push(comment);
        commentMap.set(comment._id, comment);
        return true;
      } else {
        const existing = commentMap.get(comment._id);
        if (existing.isPlaceholder) {
          const idx = allComments.findIndex((c) => c._id === comment._id);
          if (idx !== -1) {
            allComments[idx] = comment;
            commentMap.set(comment._id, comment);
            return true;
          }
        }
      }
      return false;
    };
    const threadIdsToFetchFull = new Set();
    const commentIdsToFetchReplies = new Set();
    const childrenByParent = state2.childrenByParentId;
    const hasMissingChildren = (commentId, directChildrenCount) => {
      if (directChildrenCount <= 0) return false;
      const loadedChildren = childrenByParent.get(commentId);
      return !loadedChildren || loadedChildren.length < directChildrenCount;
    };
    unreadByThread.forEach((threadUnread, threadId) => {
      const commentsWithMissingChildren = threadUnread.filter((c) => {
        const directCount = c.directChildrenCount ?? 0;
        return hasMissingChildren(c._id, directCount);
      });
      if (commentsWithMissingChildren.length >= 3) {
        threadIdsToFetchFull.add(threadId);
        return;
      }
      commentsWithMissingChildren.forEach((target) => {
        commentIdsToFetchReplies.add(target._id);
      });
    });
    const fetchPromises = [];
    if (threadIdsToFetchFull.size > 0) {
      Logger.info(`Smart Loading: Fetching ${threadIdsToFetchFull.size} full threads in batch...`);
      fetchPromises.push(
        fetchThreadsBatch(Array.from(threadIdsToFetchFull)).then((results) => {
          results.forEach(mergeComment);
        })
      );
    }
    if (commentIdsToFetchReplies.size > 0) {
      Logger.info(`Smart Loading: Fetching replies for ${commentIdsToFetchReplies.size} comments in batch...`);
      fetchPromises.push(
        fetchRepliesBatch(Array.from(commentIdsToFetchReplies)).then(async (replyResults) => {
          const newThreadIdsToFetch = new Set();
          const parentToChildrenCount = new Map();
          let anyNewData = false;
          replyResults.forEach((c) => {
            if (mergeComment(c)) anyNewData = true;
            if (c.parentCommentId) {
              parentToChildrenCount.set(c.parentCommentId, (parentToChildrenCount.get(c.parentCommentId) || 0) + 1);
            }
          });
          if (!anyNewData && replyResults.length > 0) return;
          parentToChildrenCount.forEach((count, parentId) => {
            if (count > 1) {
              const parent = commentMap.get(parentId);
              const threadId = parent?.topLevelCommentId || parent?.postId || parentId;
              if (!threadIdsToFetchFull.has(threadId)) {
                newThreadIdsToFetch.add(threadId);
              }
            }
          });
          if (newThreadIdsToFetch.size > 0) {
            Logger.info(`Smart Loading: Dynamic Switch triggered for ${newThreadIdsToFetch.size} threads`);
            const extraResults = await fetchThreadsBatch(Array.from(newThreadIdsToFetch));
            extraResults.forEach(mergeComment);
          }
        })
      );
    }
    await Promise.all(fetchPromises);
    const newCount = allComments.length - state2.comments.length;
    Logger.info(`Smart Loading completed in ${(performance.now() - start).toFixed(2)}ms (${newCount} new comments)`);
    return { comments: allComments };
  };
  const applyEnrichment = (state2, result) => {
    state2.posts = result.posts;
    state2.comments = result.comments;
    state2.subscribedAuthorIds = result.subscribedAuthorIds;
    state2.moreCommentsAvailable = result.moreCommentsAvailable;
    state2.primaryPostsCount = result.primaryPostsCount;
    rebuildIndexes(state2);
  };
  const applySmartLoad = (state2, result) => {
    state2.comments = result.comments;
    rebuildIndexes(state2);
  };
  const applyInitialLoad = (state2, result) => {
    state2.comments = result.comments;
    state2.posts = result.posts;
    state2.currentUsername = result.currentUsername;
    state2.currentUserId = result.currentUserId;
    state2.currentUserPaletteStyle = result.currentUserPaletteStyle;
    state2.primaryPostsCount = 0;
    rebuildIndexes(state2);
    if (state2.comments.length > 0) {
      const validComments = state2.comments.filter((c) => c.postedAt && !isNaN(new Date(c.postedAt).getTime()));
      if (validComments.length > 0) {
        const sorted = [...validComments].sort((a, b) => new Date(a.postedAt).getTime() - new Date(b.postedAt).getTime());
        const oldestDate = sorted[0].postedAt;
        setLoadFrom(oldestDate);
        Logger.info(`loader: Initial loadFrom snapshot set to ${oldestDate}`);
      }
    }
  };
  const AI_STUDIO_PROMPT_PREFIX = `* summarize the focal post or comment in this thread at 1/3 length or 5 sentences, whichever is shorter (required, no heading)
* explain any context for the focal post or comment not already explained in the summary (optional, heading: Context)
* explain obscure terms or references, inside jokes, etc., but assume familiarity with basic LessWrong/EA knowledge (optional, heading: Clarifications)
* what are the most serious potential errors in the focal post or comment? (optional, heading: Potential Errors)
* if there are 2 or more comments in the thread, summarize the whole thread and highlight the most interesting parts (optional, heading: Thread Summary)
* note that paragraphs prefixed by > are quotes from the previous comment
`;
  const state$1 = {
    isDragging: false,
    startX: 0,
    startWidth: 0,
    dragSide: null
  };
  let rootElement = null;
  function initResizeHandles() {
    rootElement = document.getElementById("power-reader-root");
    if (!rootElement) return;
    const leftHandle = document.createElement("div");
    leftHandle.className = "pr-resize-handle left";
    leftHandle.dataset.side = "left";
    const rightHandle = document.createElement("div");
    rightHandle.className = "pr-resize-handle right";
    rightHandle.dataset.side = "right";
    document.body.appendChild(leftHandle);
    document.body.appendChild(rightHandle);
    const savedWidth = getViewWidth();
    applyWidth(savedWidth);
    leftHandle.addEventListener("mousedown", startDrag);
    rightHandle.addEventListener("mousedown", startDrag);
    document.addEventListener("mousemove", onDrag);
    document.addEventListener("mouseup", endDrag);
    window.addEventListener("resize", () => {
      const currentWidth = getViewWidth();
      applyWidth(currentWidth);
    });
  }
  function startDrag(e) {
    const handle = e.target;
    state$1.isDragging = true;
    state$1.startX = e.clientX;
    state$1.dragSide = handle.dataset.side;
    state$1.startWidth = rootElement?.offsetWidth || window.innerWidth;
    handle.classList.add("dragging");
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    e.preventDefault();
  }
  function onDrag(e) {
    if (!state$1.isDragging || !rootElement) return;
    const deltaX = e.clientX - state$1.startX;
    let newWidth;
    if (state$1.dragSide === "left") {
      newWidth = state$1.startWidth - deltaX * 2;
    } else {
      newWidth = state$1.startWidth + deltaX * 2;
    }
    const minWidth = 400;
    const maxWidth = window.innerWidth;
    newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
    applyWidth(newWidth);
  }
  function endDrag() {
    if (!state$1.isDragging) return;
    state$1.isDragging = false;
    state$1.dragSide = null;
    document.querySelectorAll(".pr-resize-handle").forEach((h) => {
      h.classList.remove("dragging");
    });
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    if (rootElement) {
      const width = rootElement.offsetWidth;
      setViewWidth(width);
    }
  }
  function applyWidth(width) {
    if (!rootElement) return;
    if (width <= 0 || width >= window.innerWidth) {
      rootElement.style.maxWidth = "";
      rootElement.style.width = "100%";
    } else {
      rootElement.style.maxWidth = `${width}px`;
      rootElement.style.width = `${width}px`;
    }
    updateHandlePositions();
  }
  function updateHandlePositions() {
    if (!rootElement) return;
    const rect = rootElement.getBoundingClientRect();
    const leftHandle = document.querySelector(".pr-resize-handle.left");
    const rightHandle = document.querySelector(".pr-resize-handle.right");
    if (leftHandle) {
      leftHandle.style.left = `${Math.max(0, rect.left - 4)}px`;
    }
    if (rightHandle) {
      rightHandle.style.left = `${Math.min(window.innerWidth - 8, rect.right - 4)}px`;
    }
  }
  const HOVER_DELAY = 300;
  const state = {
    activePreview: null,
    triggerRect: null,
    hoverTimeout: null,
    currentTrigger: null
  };
  let lastScrollTime = 0;
  let lastMouseMoveTime = 0;
  let lastKnownMousePos = { x: -1, y: -1 };
  let listenersAdded = false;
  function initPreviewSystem() {
    if (listenersAdded) return;
    Logger.debug("initPreviewSystem: adding global listeners");
    document.addEventListener("mousemove", (e) => {
      trackMousePos(e);
      handleGlobalMouseMove(e);
    });
    document.addEventListener("click", handleGlobalClick, true);
    document.addEventListener("mousedown", () => dismissPreview(), true);
    window.addEventListener("scroll", () => {
      lastScrollTime = Date.now();
      dismissPreview();
    }, { passive: true });
    listenersAdded = true;
  }
  function trackMousePos(e) {
    if (e.clientX === lastKnownMousePos.x && e.clientY === lastKnownMousePos.y) return;
    lastKnownMousePos = { x: e.clientX, y: e.clientY };
    lastMouseMoveTime = Date.now();
  }
  function isIntentionalHover() {
    const now = Date.now();
    if (now - lastScrollTime < 300) {
      return false;
    }
    if (now - lastMouseMoveTime > 500) {
      return false;
    }
    if (lastScrollTime > lastMouseMoveTime) {
      return false;
    }
    return true;
  }
  function handleGlobalMouseMove(e) {
    if (!state.activePreview || !state.triggerRect) return;
    const inTrigger = isPointInRect(e.clientX, e.clientY, state.triggerRect);
    if (!inTrigger) {
      dismissPreview();
    }
  }
  function handleGlobalClick(e) {
    if (!state.activePreview || !state.triggerRect || !state.currentTrigger) return;
    const inTrigger = isPointInRect(e.clientX, e.clientY, state.triggerRect);
    if (inTrigger) {
      const isMiddleClick = e.button === 1;
      if (state.currentTrigger.dataset.action === "load-post") {
        dismissPreview();
        return;
      }
      const href = state.currentTrigger.getAttribute("href") || state.currentTrigger.dataset.href;
      const target = state.currentTrigger.getAttribute("target");
      if (href) {
        if (e.ctrlKey || e.metaKey || isMiddleClick || target === "_blank") {
          e.preventDefault();
          e.stopPropagation();
          window.open(href, "_blank");
        } else {
          e.preventDefault();
          e.stopPropagation();
          window.location.href = href;
        }
        dismissPreview();
      }
    }
  }
  function isPointInRect(x, y, rect) {
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }
  function cancelHoverTimeout() {
    if (state.hoverTimeout) {
      Logger.debug("cancelHoverTimeout: clearing timeout", state.hoverTimeout);
      clearTimeout(state.hoverTimeout);
      state.hoverTimeout = null;
    }
  }
  function dismissPreview() {
    Logger.debug("dismissPreview called");
    cancelHoverTimeout();
    if (state.activePreview) {
      Logger.debug("dismissPreview: removing active preview");
      state.activePreview.remove();
      state.activePreview = null;
    }
    state.triggerRect = null;
    state.currentTrigger = null;
  }
  function setupHoverPreview(trigger, fetchContent, options) {
    if (trigger.dataset.previewAttached) return;
    trigger.dataset.previewAttached = "1";
    trigger.addEventListener("mouseenter", (e) => {
      trackMousePos(e);
      Logger.debug("Preview mouseenter: trigger=", trigger.tagName, trigger.className, "dataset=", JSON.stringify(trigger.dataset));
      if (!isIntentionalHover()) {
        return;
      }
      Logger.debug("setupHoverPreview: clearing pending timeout", state.hoverTimeout);
      if (options.targetGetter) {
        const result = options.targetGetter();
        if (result) {
          const targets = Array.isArray(result) ? result : [result];
          if (targets.length > 0) {
            console.info(`[setupHoverPreview] Adding pr-parent-hover to ${targets.length} targets`);
            targets.forEach((t) => t.classList.add("pr-parent-hover"));
            const removeHighlight = () => {
              console.info(`[setupHoverPreview] Removing pr-parent-hover from ${targets.length} targets`);
              targets.forEach((t) => t.classList.remove("pr-parent-hover"));
              trigger.removeEventListener("mouseleave", removeHighlight);
            };
            trigger.addEventListener("mouseleave", removeHighlight);
          }
          const allFullyVisible = targets.every((t) => {
            const isSticky = !!t.closest(".pr-sticky-header");
            if (isSticky) return false;
            return isElementFullyVisible(t);
          });
          if (allFullyVisible) {
            return;
          }
        }
      }
      state.hoverTimeout = window.setTimeout(async () => {
        state.hoverTimeout = null;
        Logger.debug("Preview timer triggered for", options.type);
        state.triggerRect = trigger.getBoundingClientRect();
        state.currentTrigger = trigger;
        if (options.href) {
          trigger.dataset.href = options.href;
        }
        try {
          const content = await fetchContent();
          if (state.currentTrigger !== trigger) {
            Logger.debug("Preview aborted: trigger changed during fetch");
            return;
          }
          Logger.debug("Preview content fetched", content.length);
          showPreview(content, options.type, options.position || "auto");
        } catch (e2) {
          Logger.error("Preview fetch failed:", e2);
        }
      }, HOVER_DELAY);
    });
    trigger.addEventListener("mouseleave", () => {
      Logger.debug("Preview mouseleave: trigger=", trigger.tagName, trigger.className);
      if (state.hoverTimeout) {
        clearTimeout(state.hoverTimeout);
        state.hoverTimeout = null;
      }
    });
  }
  function manualPreview(trigger, fetchContent, options) {
    if (!isIntentionalHover()) return;
    if (state.hoverTimeout) {
      clearTimeout(state.hoverTimeout);
    }
    state.hoverTimeout = window.setTimeout(async () => {
      state.hoverTimeout = null;
      Logger.debug("Manual Preview triggered");
      state.triggerRect = trigger.getBoundingClientRect();
      state.currentTrigger = trigger;
      if (options.href) {
        trigger.dataset.href = options.href;
      }
      try {
        const content = await fetchContent();
        if (state.currentTrigger !== trigger) {
          Logger.debug("Manual Preview aborted: trigger changed during fetch");
          return;
        }
        Logger.debug("Manual Preview content fetched", content.length);
        showPreview(content, options.type, options.position || "auto");
      } catch (e) {
        Logger.error("Preview fetch failed:", e);
      }
    }, HOVER_DELAY);
  }
  function showPreview(content, type, position) {
    Logger.debug("showPreview: start");
    const savedTriggerRect = state.triggerRect;
    const savedCurrentTrigger = state.currentTrigger;
    dismissPreview();
    state.triggerRect = savedTriggerRect;
    state.currentTrigger = savedCurrentTrigger;
    const preview = document.createElement("div");
    preview.className = `pr-preview-overlay ${type}-preview`;
    preview.innerHTML = content;
    document.body.appendChild(preview);
    state.activePreview = preview;
    positionPreview(preview, position);
    adaptPreviewWidth(preview, position);
    Logger.debug("showPreview: end, activePreview visible=", !!document.querySelector(".pr-preview-overlay"));
  }
  function adaptPreviewWidth(preview, position) {
    const maxWidth = window.innerWidth * 0.9;
    let currentWidth = preview.offsetWidth;
    for (let i = 0; i < 10; i++) {
      if (preview.scrollHeight <= preview.clientHeight + 2) {
        break;
      }
      currentWidth = Math.min(currentWidth + 150, maxWidth);
      preview.style.width = `${currentWidth}px`;
      preview.style.maxWidth = `${currentWidth}px`;
      positionPreview(preview, position);
      if (currentWidth >= maxWidth) {
        break;
      }
    }
  }
  function positionPreview(preview, position) {
    if (!state.triggerRect) return;
    const previewRect = preview.getBoundingClientRect();
    const h = previewRect.height;
    const w = previewRect.width;
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const tr = state.triggerRect;
    let finalTop;
    let finalLeft;
    finalLeft = tr.left + tr.width / 2 - w / 2;
    finalLeft = Math.max(10, Math.min(finalLeft, vw - w - 10));
    let side = position;
    if (side === "auto") {
      const spaceAbove = tr.top;
      const spaceBelow = vh - tr.bottom;
      side = spaceAbove > spaceBelow ? "above" : "below";
    }
    if (side === "above") {
      finalTop = tr.top - h - 10;
      if (finalTop < 10) {
        finalTop = 10;
        if (finalTop + h > tr.top - 5) {
          const belowTop = tr.bottom + 10;
          if (belowTop + h < vh - 10) {
            finalTop = belowTop;
            side = "below";
          } else {
            if (vh - tr.bottom > tr.top) {
              finalTop = Math.max(10, vh - h - 10);
              side = "below";
            } else {
              finalTop = 10;
              side = "above";
            }
          }
        }
      }
    } else {
      finalTop = tr.bottom + 10;
      if (finalTop + h > vh - 10) {
        finalTop = Math.max(10, vh - h - 10);
        if (finalTop < tr.bottom + 5) {
          const aboveTop = tr.top - h - 10;
          if (aboveTop > 10) {
            finalTop = aboveTop;
            side = "above";
          } else {
            if (tr.top > vh - tr.bottom) {
              finalTop = 10;
              side = "above";
            }
          }
        }
      }
    }
    const verticalOverlap = finalTop < tr.bottom + 5 && finalTop + h > tr.top - 5;
    const horizontalOverlap = finalLeft < tr.right + 5 && finalLeft + w > tr.left - 5;
    const wasClamped = finalLeft <= 15 || finalLeft >= vw - w - 15;
    if (verticalOverlap && horizontalOverlap || wasClamped && horizontalOverlap) {
      if (tr.left > vw / 2) {
        finalLeft = tr.left - w - 20;
      } else {
        finalLeft = tr.right + 20;
      }
      finalLeft = Math.max(10, Math.min(finalLeft, vw - w - 10));
      if (finalLeft + w < tr.left || finalLeft > tr.right) {
        finalTop = tr.top + tr.height / 2 - h / 2;
        finalTop = Math.max(10, Math.min(finalTop, vh - h - 10));
      }
    }
    Logger.debug(`positionPreview: finalTop=${finalTop}, finalLeft=${finalLeft}, vw=${vw}, vh=${vh}`);
    preview.style.left = `${finalLeft}px`;
    preview.style.top = `${finalTop}px`;
  }
  function createPostPreviewFetcher(postId) {
    return async () => {
      const response = await queryGraphQL(GET_POST, { id: postId });
      const post = response.post?.result;
      if (!post) {
        return '<div class="pr-preview-loading">Post not found</div>';
      }
      return `
      <div class="pr-preview-header">
        <strong>${escapeHtml$1(post.title || "")}</strong>
        <span style="color: #666; margin-left: 10px;">
          by ${escapeHtml$1(post.user?.username || "Unknown")} · ${post.baseScore} points
        </span>
      </div>
      <div class="pr-preview-content">
        ${post.htmlBody || "<i>(No content)</i>"}
      </div>
    `;
    };
  }
  function createCommentPreviewFetcher(commentId, localComments) {
    return async () => {
      const local = localComments.find((c) => c._id === commentId);
      if (local) {
        return formatCommentPreview(local);
      }
      const response = await queryGraphQL(GET_COMMENT, { id: commentId });
      const comment = response.comment?.result;
      if (!comment) {
        return '<div class="pr-preview-loading">Comment not found</div>';
      }
      return formatCommentPreview(comment);
    };
  }
  function formatCommentPreview(comment) {
    const date = new Date(comment.postedAt);
    const timeStr = date.toLocaleString().replace(/ ?GMT.*/, "");
    return `
    <div class="pr-preview-header">
      <strong>${escapeHtml$1(comment.user?.username || "Unknown")}</strong>
      <span style="color: #666; margin-left: 10px;">
        ${comment.baseScore} points · ${timeStr}
      </span>
    </div>
    <div class="pr-preview-content">
      ${comment.htmlBody || ""}
    </div>
  `;
  }
  function isElementFullyVisible(el) {
    if (el.closest(".pr-sticky-header")) return false;
    if (el.classList.contains("pr-missing-parent") || el.dataset.placeholder === "1") return false;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const inViewport = rect.top >= 0 && rect.left >= 0 && rect.bottom <= vh && rect.right <= vw;
    if (!inViewport) return false;
    const points = [
      { x: rect.left + 2, y: rect.top + 2 },
      { x: rect.right - 2, y: rect.top + 2 },
      { x: rect.left + 2, y: rect.bottom - 2 },
      { x: rect.right - 2, y: rect.bottom - 2 }
    ];
    for (const p of points) {
      const found = document.elementFromPoint(p.x, p.y);
      if (!found || !(el === found || el.contains(found) || found.closest(".pr-preview-overlay"))) {
        Logger.debug(`isElementFullyVisible: obscured at (${p.x}, ${p.y}) by`, found);
        return false;
      }
    }
    return true;
  }
  function escapeHtml$1(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
  function parseUrl(raw) {
    try {
      return new URL(raw, window.location.origin);
    } catch {
      return null;
    }
  }
  function isAllowedForumHostname(hostname) {
    const host = hostname.toLowerCase();
    return host === "lesswrong.com" || host.endsWith(".lesswrong.com") || host === "forum.effectivealtruism.org" || host.endsWith(".forum.effectivealtruism.org") || host === "greaterwrong.com" || host.endsWith(".greaterwrong.com");
  }
  function parseForumUrl(raw) {
    const u = parseUrl(raw);
    if (!u) return null;
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!isAllowedForumHostname(u.hostname)) return null;
    return u;
  }
  function extractCommentIdFromUrl(url) {
    const parsed = parseUrl(url);
    if (!parsed) return null;
    const queryId = parsed.searchParams.get("commentId");
    if (queryId && /^[a-zA-Z0-9_-]+$/.test(queryId)) return queryId;
    const hash = parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash;
    if (hash && /^[a-zA-Z0-9_-]+$/.test(hash)) return hash;
    return null;
  }
  function isCommentUrl(url) {
    const parsed = parseForumUrl(url);
    if (!parsed) return false;
    const hasCommentParam = parsed.searchParams.has("commentId");
    const hash = parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash;
    const hasCommentHash = /^[a-zA-Z0-9_-]{10,}$/.test(hash);
    return hasCommentParam || hasCommentHash;
  }
  function isPostUrl(url) {
    const parsed = parseForumUrl(url);
    if (!parsed) return false;
    const hasPostPath = /\/posts\/[a-zA-Z0-9_-]+(?:\/|$)/.test(parsed.pathname);
    if (!hasPostPath) return false;
    return !isCommentUrl(url);
  }
  function isWikiUrl(url) {
    const parsed = parseForumUrl(url);
    if (!parsed) return false;
    const hasWikiPath = /\/(tag|wiki)\/[a-zA-Z0-9-]+(?:\/|$)/.test(parsed.pathname);
    if (!hasWikiPath) return false;
    return true;
  }
  function isAuthorUrl(url) {
    const parsed = parseForumUrl(url);
    if (!parsed) return false;
    const hasUserPath = /\/users\/[a-zA-Z0-9_-]+(?:\/|$)/.test(parsed.pathname);
    if (!hasUserPath) return false;
    return true;
  }
  function extractPostIdFromUrl(url) {
    const parsed = parseUrl(url);
    if (!parsed) return null;
    const match = parsed.pathname.match(/\/posts\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }
  function extractAuthorSlugFromUrl(url) {
    const parsed = parseUrl(url);
    if (!parsed) return null;
    const match = parsed.pathname.match(/\/users\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }
  function extractWikiSlugFromUrl(url) {
    const parsed = parseUrl(url);
    if (!parsed) return null;
    const match = parsed.pathname.match(/\/(tag|wiki)\/([a-zA-Z0-9-]+)/);
    return match ? match[2] : null;
  }
  function createWikiPreviewFetcher(slug) {
    return async () => {
      const forumOrigin = parseForumUrl(window.location.href)?.origin || "https://www.lesswrong.com";
      const url = new URL(`/tag/${slug}`, forumOrigin).toString();
      try {
        const response = await fetch(url);
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const contentEl = doc.querySelector(".TagPage-description, .ContentStyles-base, .tagDescription");
        const titleEl = doc.querySelector("h1, .TagPage-title");
        const title = titleEl?.textContent || slug;
        const content = contentEl?.innerHTML || "<i>(Unable to load wiki content)</i>";
        return `
        <div class="pr-preview-header">
          <strong>Wiki: ${escapeHtml$1(title)}</strong>
        </div>
        <div class="pr-preview-content">
          ${content}
        </div>
      `;
      } catch (e) {
        Logger.error("Wiki fetch failed:", e);
        return `<i>Failed to load wiki page for: ${escapeHtml$1(slug)}</i>`;
      }
    };
  }
  function createAuthorPreviewFetcher(userId) {
    return async () => {
      const response = await queryGraphQL(GET_USER, { id: userId });
      const user = response.user?.result;
      if (!user) {
        return '<div class="pr-preview-loading">User not found</div>';
      }
      return renderUserPreview(user);
    };
  }
  function createAuthorBySlugPreviewFetcher(slug) {
    return async () => {
      const response = await queryGraphQL(GET_USER_BY_SLUG, { slug });
      const user = response.user;
      if (!user) {
        return '<div class="pr-preview-loading">User not found</div>';
      }
      return renderUserPreview(user);
    };
  }
  function renderUserPreview(user) {
    return `
    <div class="pr-preview-header">
      <strong>${escapeHtml$1(user.displayName || user.username || "Unknown")}</strong>
      <span style="color: #666; margin-left: 10px;">
        ${Math.round(user.karma)} karma · @${escapeHtml$1(user.username || "")}
      </span>
    </div>
    <div class="pr-preview-content">
      ${user.htmlBio || "<i>(No bio provided)</i>"}
    </div>
  `;
  }
  const LOGIN_URL = `${window.location.origin}/auth/auth0`;
  async function castKarmaVote(commentId, voteType, isLoggedIn, currentAgreement = null) {
    Logger.debug(`castKarmaVote: commentId=${commentId}, isLoggedIn=${isLoggedIn}`);
    if (!isLoggedIn) {
      Logger.info("Not logged in, opening auth page");
      window.open(LOGIN_URL, "_blank");
      return null;
    }
    try {
      const response = await queryGraphQL(VOTE_MUTATION, {
        documentId: commentId,
        voteType,
        extendedVote: currentAgreement
      });
      return response;
    } catch (e) {
      Logger.error("Vote failed:", e);
      return null;
    }
  }
  async function castAgreementVote(commentId, voteType, isLoggedIn, currentKarma = "neutral") {
    if (!isLoggedIn) {
      window.open(LOGIN_URL, "_blank");
      return null;
    }
    const agreementValue = voteType === "agree" ? "smallUpvote" : voteType === "disagree" ? "smallDownvote" : "neutral";
    try {
      const response = await queryGraphQL(VOTE_MUTATION, {
        documentId: commentId,
        voteType: currentKarma || "neutral",
        extendedVote: { agreement: agreementValue }
      });
      return response;
    } catch (e) {
      Logger.error("Agreement vote failed:", e);
      return null;
    }
  }
  async function castReactionVote(commentId, reactionName, isLoggedIn, currentKarma = "neutral", currentExtendedVote = {}, quote = null) {
    if (!isLoggedIn) {
      window.open(LOGIN_URL, "_blank");
      return null;
    }
    const existingReacts = currentExtendedVote?.reacts || [];
    const newReacts = JSON.parse(JSON.stringify(existingReacts));
    const existingReactionIndex = newReacts.findIndex((r) => r.react === reactionName);
    if (existingReactionIndex >= 0) {
      const reaction = newReacts[existingReactionIndex];
      if (quote) {
        const quotes = reaction.quotes || [];
        if (quotes.includes(quote)) {
          reaction.quotes = quotes.filter((q) => q !== quote);
          if (reaction.quotes.length === 0) {
            newReacts.splice(existingReactionIndex, 1);
          }
        } else {
          reaction.quotes = [...quotes, quote];
        }
      } else {
        newReacts.splice(existingReactionIndex, 1);
      }
    } else {
      const newReaction = {
        react: reactionName,
        vote: "created"
};
      if (quote) {
        newReaction.quotes = [quote];
      }
      newReacts.push(newReaction);
    }
    const extendedVotePayload = {
      agreement: currentExtendedVote?.agreement,
      reacts: newReacts
    };
    try {
      const response = await queryGraphQL(VOTE_MUTATION, {
        documentId: commentId,
        voteType: currentKarma || "neutral",
extendedVote: extendedVotePayload
      });
      return response;
    } catch (e) {
      Logger.error("Reaction vote failed:", e);
      return null;
    }
  }
  function calculateNextVoteState(currentVote, direction, isHold) {
    const isUp = direction === "up" || direction === "agree";
    const small = isUp ? direction === "agree" ? "agree" : "smallUpvote" : direction === "disagree" ? "disagree" : "smallDownvote";
    const big = isUp ? "bigUpvote" : "bigDownvote";
    const neutral = "neutral";
    const currentIsBig = currentVote === big;
    const currentIsSmall = currentVote === small || direction === "agree" && currentVote === "smallUpvote" || direction === "disagree" && currentVote === "smallDownvote";
    if (isHold) {
      if (currentIsBig) return neutral;
      return big;
    } else {
      if (currentIsBig) return small;
      if (currentIsSmall) return neutral;
      return small;
    }
  }
  function renderVoteButtons(commentId, karmaScore, currentKarmaVote, currentAgreement, agreementScore = 0, voteCount = 0, agreementVoteCount = 0, showAgreement = true, showButtons = true) {
    const isUpvoted = currentKarmaVote === "smallUpvote" || currentKarmaVote === "bigUpvote" || currentKarmaVote === 1;
    const isDownvoted = currentKarmaVote === "smallDownvote" || currentKarmaVote === "bigDownvote" || currentKarmaVote === -1;
    const agreeVote = currentAgreement?.agreement;
    const isAgreed = agreeVote === "smallUpvote" || agreeVote === "bigUpvote" || agreeVote === "agree";
    const isDisagreed = agreeVote === "smallDownvote" || agreeVote === "bigDownvote" || agreeVote === "disagree";
    const agreementHtml = showAgreement ? `
    <span class="pr-vote-controls">
      ${showButtons ? `
      <span class="pr-vote-btn ${isDisagreed ? "disagree-active" : ""} ${agreeVote === "bigDownvote" ? "strong-vote" : ""}" 
            data-action="disagree" 
            data-comment-id="${commentId}"
            title="Disagree">✗</span>
      ` : ""}
      <span class="pr-agreement-score" title="Agreement votes: ${agreementVoteCount}">${agreementScore}</span>
      ${showButtons ? `
      <span class="pr-vote-btn ${isAgreed ? "agree-active" : ""} ${agreeVote === "bigUpvote" ? "strong-vote" : ""}" 
            data-action="agree" 
            data-comment-id="${commentId}"
            title="Agree">✓</span>
      ` : ""}
    </span>` : "";
    return `
    <span class="pr-vote-controls">
      ${showButtons ? `
      <span class="pr-vote-btn ${isDownvoted ? "active-down" : ""} ${currentKarmaVote === "bigDownvote" ? "strong-vote" : ""}" 
            data-action="karma-down" 
            data-comment-id="${commentId}"
            title="Downvote">▼</span>
      ` : ""}
      <span class="pr-karma-score" title="Total votes: ${voteCount}">${karmaScore}</span>
      ${showButtons ? `
      <span class="pr-vote-btn ${isUpvoted ? "active-up" : ""} ${currentKarmaVote === "bigUpvote" ? "strong-vote" : ""}" 
            data-action="karma-up" 
            data-comment-id="${commentId}"
            title="Upvote">▲</span>
      ` : ""}
    </span>
    ${agreementHtml}
    <span class="pr-reactions-container" data-comment-id="${commentId}">
      <!-- Reactions will be injected here during main render or update -->
    </span>
  `;
  }
  function updateVoteUI(commentId, response) {
    const comment = document.querySelector(`[data-id="${commentId}"]`);
    if (!comment || !response.performVoteComment?.document) return;
    const doc = response.performVoteComment.document;
    const scoreEl = comment.querySelector(".pr-karma-score");
    if (scoreEl) {
      scoreEl.textContent = String(doc.baseScore);
    }
    const agreeScoreEl = comment.querySelector(".pr-agreement-score");
    if (agreeScoreEl && doc.afExtendedScore?.agreement !== void 0) {
      agreeScoreEl.textContent = String(doc.afExtendedScore.agreement);
    }
    const upBtn = comment.querySelector('[data-action="karma-up"]');
    const downBtn = comment.querySelector('[data-action="karma-down"]');
    const vote = doc.currentUserVote;
    upBtn?.classList.toggle("active-up", vote === "smallUpvote" || vote === "bigUpvote");
    upBtn?.classList.toggle("strong-vote", vote === "bigUpvote");
    downBtn?.classList.toggle("active-down", vote === "smallDownvote" || vote === "bigDownvote");
    downBtn?.classList.toggle("strong-vote", vote === "bigDownvote");
    const agreeBtn = comment.querySelector('[data-action="agree"]');
    const disagreeBtn = comment.querySelector('[data-action="disagree"]');
    const extVote = doc.currentUserExtendedVote;
    const agreeState = extVote?.agreement;
    agreeBtn?.classList.toggle("agree-active", agreeState === "smallUpvote" || agreeState === "bigUpvote" || agreeState === "agree");
    agreeBtn?.classList.toggle("strong-vote", agreeState === "bigUpvote");
    disagreeBtn?.classList.toggle("disagree-active", agreeState === "smallDownvote" || agreeState === "bigDownvote" || agreeState === "disagree");
    disagreeBtn?.classList.toggle("strong-vote", agreeState === "bigDownvote");
  }
  const DEFAULT_FILTER = {
    opacity: 1,
    saturate: 1,
    scale: 1,
    translateX: 0,
    translateY: 0
  };
  const BOOTSTRAP_REACTIONS = [
{ name: "agree", label: "Agreed", svg: "https://www.lesswrong.com/reactionImages/nounproject/check.svg" },
    { name: "disagree", label: "Disagree", svg: "https://www.lesswrong.com/reactionImages/nounproject/x.svg" },
    { name: "important", label: "Important", svg: "https://www.lesswrong.com/reactionImages/nounproject/exclamation.svg" },
    { name: "dontUnderstand", label: "I don't understand", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-question-5771604.svg" },
    { name: "plus", label: "Plus One", svg: "https://www.lesswrong.com/reactionImages/nounproject/Plus.png" },
    { name: "shrug", label: "Shrug", svg: "https://www.lesswrong.com/reactionImages/nounproject/shrug.svg" },
    { name: "thumbs-up", label: "Thumbs Up", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-thumbs-up-1686284.svg" },
    { name: "thumbs-down", label: "Thumbs Down", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-thumbs-down-1686285.svg" },
    { name: "seen", label: "Seen", svg: "https://www.lesswrong.com/reactionImages/nounproject/eyes.svg" },
    { name: "smile", label: "Smile", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-smile-925549.svg" },
    { name: "laugh", label: "Haha!", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-laughing-761845.svg" },
    { name: "sad", label: "Sad", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-sad-1152961.svg" },
    { name: "disappointed", label: "Disappointed", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-sad-5760577.svg" },
    { name: "confused", label: "Confused", svg: "https://www.lesswrong.com/reactionImages/confused2.svg" },
    { name: "thinking", label: "Thinking", svg: "https://www.lesswrong.com/reactionImages/nounproject/thinking-nice-eyebrows.svg" },
    { name: "oops", label: "Oops!", svg: "https://www.lesswrong.com/reactionImages/nounproject/Oops!.png" },
    { name: "surprise", label: "Surprise", svg: "https://www.lesswrong.com/reactionImages/nounproject/surprise.svg" },
    { name: "excitement", label: "Exciting", svg: "https://www.lesswrong.com/reactionImages/nounproject/partypopper.svg" },
{ name: "changemind", label: "Changed My Mind", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-triangle-305128.svg" },
    { name: "strong-argument", label: "Strong Argument", svg: "https://www.lesswrong.com/reactionImages/nounproject/strong-argument2.svg" },
    { name: "crux", label: "Crux", svg: "https://www.lesswrong.com/reactionImages/nounproject/branchingpath.svg" },
    { name: "hitsTheMark", label: "Hits the Mark", svg: "https://www.lesswrong.com/reactionImages/nounproject/bullseye.svg" },
    { name: "clear", label: "Clearly Written", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-clear-sky-1958882.svg" },
    { name: "concrete", label: "Concrete", svg: "https://www.lesswrong.com/reactionImages/nounproject/concrete.svg" },
    { name: "scout", label: "Scout Mindset", svg: "https://www.lesswrong.com/reactionImages/nounproject/binoculars.svg" },
    { name: "moloch", label: "Moloch", svg: "https://www.lesswrong.com/reactionImages/nounproject/moloch-bw-2.svg" },
    { name: "soldier", label: "Soldier Mindset", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-brackets-1942334-updated.svg" },
    { name: "soldier-alt", label: "Soldier Mindset", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-soldier-5069240.svg" },
    { name: "changed-mind-on-point", label: "Changed Mind on Point", svg: "https://www.lesswrong.com/reactionImages/nounproject/changedmindonpoint.svg" },
    { name: "weak-argument", label: "Weak Argument", svg: "https://www.lesswrong.com/reactionImages/nounproject/weak-argument2.svg" },
    { name: "notacrux", label: "Not a Crux", svg: "https://www.lesswrong.com/reactionImages/nounproject/nonbranchingpath2.svg" },
    { name: "miss", label: "Missed the Point", svg: "https://www.lesswrong.com/reactionImages/nounproject/inaccurate.svg" },
    { name: "muddled", label: "Difficult to Parse", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-fog-1028590.svg" },
    { name: "examples", label: "Examples?", svg: "https://www.lesswrong.com/reactionImages/nounproject/shapes.svg" },
    { name: "paperclip", label: "Paperclip", svg: "https://www.lesswrong.com/reactionImages/nounproject/paperclip.svg" },
    { name: "resolved", label: "Question Answered", svg: "https://www.lesswrong.com/reactionImages/nounproject/resolved.svg" },
{ name: "heart", label: "Heart", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-heart-1212629.svg" },
    { name: "coveredAlready2", label: "Already Addressed", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-mail-checkmark-5316519.svg" },
    { name: "beautiful", label: "Beautiful!", svg: "https://res.cloudinary.com/lesswrong-2-0/image/upload/v1758861219/Beautiful_ynilb1.svg" },
    { name: "insightful", label: "Insightful", svg: "https://www.lesswrong.com/reactionImages/nounproject/lightbulb.svg" },
    { name: "strawman", label: "Misunderstands?", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-misunderstanding-4936548-updated.svg" },
    { name: "addc", label: "ADDC", svg: "https://www.lesswrong.com/reactionImages/nounproject/ADDC.svg" },
    { name: "llm-smell", label: "Smells like LLM", svg: "https://www.lesswrong.com/reactionImages/nounproject/llm-smell.svg" },
    { name: "scholarship", label: "Nice Scholarship!", svg: "https://www.lesswrong.com/reactionImages/nounproject/scholarship.svg" },
    { name: "unnecessarily-combative", label: "Too Combative?", svg: "https://www.lesswrong.com/reactionImages/nounproject/swords.svg" },
    { name: "thanks", label: "Thanks", svg: "https://www.lesswrong.com/reactionImages/nounproject/thankyou.svg" },
    { name: "hat", label: "Bowing Out", svg: "https://www.lesswrong.com/reactionImages/nounproject/HatInMotion.png" },
    { name: "nitpick", label: "Nitpick", svg: "https://www.lesswrong.com/reactionImages/nounproject/nitpick.svg" },
    { name: "offtopic", label: "Offtopic?", svg: "https://www.lesswrong.com/reactionImages/nounproject/mapandpin.svg" },
    { name: "facilitation", label: "Good Facilitation", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-dialog-2172.svg" },
    { name: "bowels", label: "Bowels", svg: "https://www.lesswrong.com/reactionImages/nounproject/bowels.svg" },
    { name: "typo", label: "Typo", svg: "https://www.lesswrong.com/reactionImages/nounproject/type-text.svg" },
    { name: "bet", label: "Let's Bet!", svg: "https://www.lesswrong.com/reactionImages/nounproject/bet.svg" },
    { name: "sneer", label: "Sneer", svg: "https://www.lesswrong.com/reactionImages/nounproject/NoSneeringThick.png" },
{ name: "1percent", label: "1%", svg: "https://www.lesswrong.com/reactionImages/1percent.svg" },
    { name: "10percent", label: "10%", svg: "https://www.lesswrong.com/reactionImages/10percent.svg" },
    { name: "25percent", label: "25%", svg: "https://www.lesswrong.com/reactionImages/25percent.svg" },
    { name: "40percent", label: "40%", svg: "https://www.lesswrong.com/reactionImages/40percent.svg" },
    { name: "50percent", label: "50%", svg: "https://www.lesswrong.com/reactionImages/50percent.svg" },
    { name: "60percent", label: "60%", svg: "https://www.lesswrong.com/reactionImages/60percent.svg" },
    { name: "75percent", label: "75%", svg: "https://www.lesswrong.com/reactionImages/75percent.svg" },
    { name: "90percent", label: "90%", svg: "https://www.lesswrong.com/reactionImages/90percent.svg" },
    { name: "99percent", label: "99%", svg: "https://www.lesswrong.com/reactionImages/99percent.svg" }
  ];
  const EA_FORUM_BOOTSTRAP_REACTIONS = [
    { name: "agree", label: "Agree", svg: "https://www.lesswrong.com/reactionImages/nounproject/check.svg" },
    { name: "disagree", label: "Disagree", svg: "https://www.lesswrong.com/reactionImages/nounproject/x.svg" },
    { name: "love", label: "Heart", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-heart-1212629.svg" },
    { name: "helpful", label: "Helpful", svg: "https://www.lesswrong.com/reactionImages/nounproject/handshake.svg" },
    { name: "insightful", label: "Insightful", svg: "https://www.lesswrong.com/reactionImages/nounproject/lightbulb.svg" },
    { name: "changed-mind", label: "Changed my mind", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-triangle-305128.svg" },
    { name: "laugh", label: "Made me laugh", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-laughing-761845.svg" }
  ];
  const SECTION_DEFINITIONS = {
gridPrimary: ["agree", "disagree", "important", "dontUnderstand", "plus", "shrug", "thumbs-up", "thumbs-down", "seen", "smile", "laugh", "sad", "disappointed", "confused", "thinking", "oops", "surprise", "excitement"],
    gridSectionB: [
      "changemind",
      "strong-argument",
      "crux",
      "hitsTheMark",
      "clear",
      "concrete",
      "scout",
      "moloch",
      "soldier",
      "changed-mind-on-point",
      "weak-argument",
      "notacrux",
      "miss",
      "muddled",
      "examples",
      "soldier-alt",
      "paperclip",
      "resolved"
    ],
    gridSectionC: [
      "heart",
      "coveredAlready2",
      "beautiful",
      "insightful",
      "strawman",
      "addc",
      "llm-smell",
      "scholarship",
      "unnecessarily-combative",
      "thanks",
      "hat",
      "nitpick",
      "offtopic",
      "facilitation",
      "bowels",
      "typo",
      "bet",
      "sneer"
    ],
    likelihoods: ["1percent", "10percent", "25percent", "40percent", "50percent", "60percent", "75percent", "90percent", "99percent"]
  };
  SECTION_DEFINITIONS.listPrimary = SECTION_DEFINITIONS.gridPrimary;
  SECTION_DEFINITIONS.listViewSectionB = SECTION_DEFINITIONS.gridSectionB;
  SECTION_DEFINITIONS.listViewSectionC = SECTION_DEFINITIONS.gridSectionC;
  const CACHE_KEY = "power-reader-scraped-reactions";
  const CACHE_TIME = 7 * 24 * 60 * 60 * 1e3;
  let reactionsCache = [];
  function getReactions() {
    const isEA = window.location.hostname.includes("effectivealtruism.org");
    let finalReactions = [...isEA ? EA_FORUM_BOOTSTRAP_REACTIONS : BOOTSTRAP_REACTIONS];
    const getCachedData = () => {
      try {
        const cached2 = JSON.parse(GM_getValue(getKey(CACHE_KEY), "null"));
        if (cached2 && cached2.timestamp && Date.now() - cached2.timestamp < CACHE_TIME) {
          return cached2;
        }
      } catch (e) {
        Logger.error("Error loading reactions from cache:", e);
      }
      return null;
    };
    const cached = getCachedData();
    const scraped = cached ? cached.reactions : reactionsCache.length > 0 ? reactionsCache : [];
    if (scraped.length > 0) {
      const map = new Map();
      finalReactions.forEach((r) => map.set(r.name, r));
      scraped.forEach((r) => map.set(r.name, r));
      finalReactions = Array.from(map.values());
    }
    return finalReactions;
  }
  const REACTION_REGEX = /{name:"([^"]+)",label:"([^"]+)",(?:searchTerms:\[(.*?)\],)?svg:"([^"]+)"(?:,description:(?:(["'])((?:(?=(\\?))\7.)*?)\5|(?:\([^)]+\)|[\w$]+)=>`[^`]*?(\w+[^`]+)`))?(?:,filter:({[^}]+}))?(?:,deprecated:(!0|!1|true|false))?/g;
  function parseReactionsFromCode(content) {
    const matches = [];
    let match;
    REACTION_REGEX.lastIndex = 0;
    while ((match = REACTION_REGEX.exec(content)) !== null) {
      const [_full, name, label, searchTermsRaw, svg, _quoteChar, descContent, _bs, fnDescContent, filterRaw, deprecatedRaw] = match;
      const reaction = { name, label, svg };
      if (searchTermsRaw) {
        reaction.searchTerms = searchTermsRaw.replace(/"/g, "").split(",").map((s) => s.trim());
      }
      if (descContent) {
        reaction.description = descContent;
      } else if (fnDescContent) {
        reaction.description = `This post/comment ${fnDescContent.trim()}`;
      }
      if (filterRaw) {
        try {
          let jsonFilter = filterRaw.replace(/(\w+):/g, '"$1":');
          jsonFilter = jsonFilter.replace(/:(\.\d+)/g, ":0$1");
          reaction.filter = JSON.parse(jsonFilter);
        } catch (e) {
        }
      }
      if (deprecatedRaw) {
        reaction.deprecated = deprecatedRaw === "!0" || deprecatedRaw === "true";
      }
      matches.push(reaction);
    }
    return matches;
  }
  function parseSectionsFromCode(content) {
    const sections = {};
    const sectionRegex = /(gridPrimary|gridEmotions|gridSectionB|gridSectionC|gridSectionD|listPrimary|listEmotions|listViewSectionB|listViewSectionC|listViewSectionD|likelihoods)[:=](\[[^\]]+\])/g;
    let match;
    while ((match = sectionRegex.exec(content)) !== null) {
      const [_, name, arrayRaw] = match;
      try {
        const array = JSON.parse(arrayRaw.replace(/'/g, '"').replace(/,\]/, "]"));
        sections[name] = array;
      } catch (e) {
      }
    }
    return sections;
  }
  async function initializeReactions() {
    try {
      const cached = JSON.parse(GM_getValue(getKey(CACHE_KEY), "null"));
      if (cached && cached.timestamp && Date.now() - cached.timestamp < CACHE_TIME) {
        Logger.info("Using cached reactions");
        reactionsCache = cached.reactions;
        if (cached.sectionDefinitions) {
          Object.assign(SECTION_DEFINITIONS, cached.sectionDefinitions);
        }
        return;
      }
    } catch (e) {
    }
    Logger.info("Reactions cache missing or expired. Starting scrape...");
    let scripts = Array.from(document.querySelectorAll("script[src]")).map((s) => s.src).filter((src) => src.includes("client") || src.includes("/_next/static/chunks/"));
    if (scripts.length === 0) {
      const origin = window.location.origin;
      scripts = Array.from(document.querySelectorAll("script[src]")).map((s) => s.src).filter((src) => src.startsWith(origin));
    }
    if (scripts.length === 0) {
      Logger.warn("No candidate scripts found for scraping. Using bootstrap fallback.");
      const isEA = window.location.hostname.includes("effectivealtruism.org");
      reactionsCache = isEA ? EA_FORUM_BOOTSTRAP_REACTIONS : BOOTSTRAP_REACTIONS;
      return;
    }
    let anySuccess = false;
    for (const src of scripts) {
      try {
        await new Promise((resolve) => {
          GM_xmlhttpRequest({
            method: "GET",
            url: src,
            onload: (response) => {
              const content = response.responseText;
              const matches = parseReactionsFromCode(content);
              const scrapedSections = parseSectionsFromCode(content);
              if (matches.length > 20) {
                Logger.info(`Successfully scraped ${matches.length} reactions from ${src}`);
                const unique = Array.from(new Map(matches.map((item) => [item.name, item])).values());
                if (unique.find((r) => r.name === "agree") && unique.find((r) => r.name === "insightful")) {
                  if (Object.keys(scrapedSections).length > 2) {
                    Logger.debug("Found sections in bundle", Object.keys(scrapedSections));
                    Object.assign(SECTION_DEFINITIONS, scrapedSections);
                  }
                  reactionsCache = unique;
                  GM_setValue(getKey(CACHE_KEY), JSON.stringify({
                    timestamp: Date.now(),
                    reactions: unique,
                    sectionDefinitions: SECTION_DEFINITIONS
}));
                  anySuccess = true;
                  resolve();
                  return;
                }
              }
              resolve();
            },
            onerror: () => resolve()
          });
        });
        if (anySuccess) break;
      } catch (e) {
        Logger.error("Error scraping script:", e);
      }
    }
    if (!anySuccess) {
      Logger.warn("FAILED to scrape reactions from any script bundle. Using bootstrap fallback.");
      const isEA = window.location.hostname.includes("effectivealtruism.org");
      reactionsCache = isEA ? EA_FORUM_BOOTSTRAP_REACTIONS : BOOTSTRAP_REACTIONS;
    }
  }
  function hexToRgb(hex) {
    hex = hex.replace(/^#/, "");
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    const num = parseInt(hex, 16);
    return [num >> 16 & 255, num >> 8 & 255, num & 255];
  }
  function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map((x) => {
      const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    }).join("");
  }
  function interpolateColors(color1, color2, weight1, weight2) {
    const c1 = hexToRgb(color1);
    const c2 = hexToRgb(color2);
    const total = weight1 + weight2;
    if (total === 0) return color1;
    const r = Math.round((weight1 * c1[0] + weight2 * c2[0]) / total);
    const g = Math.round((weight1 * c1[1] + weight2 * c2[1]) / total);
    const b = Math.round((weight1 * c1[2] + weight2 * c2[2]) / total);
    return rgbToHex(r, g, b);
  }
  function getScoreColor(normalized) {
    return interpolateColors("#FFFFFF", "#FFDDDD", 1 - normalized, normalized);
  }
  function getPostScoreColor(normalized) {
    return interpolateColors("#F0F0F0", "#E0D0FF", 1 - normalized, normalized);
  }
  function getRecencyColor(order, maxOrder) {
    if (order <= 0 || order > maxOrder) return "";
    return interpolateColors("#FFFFFE", "#FFFFE0", order, maxOrder - order);
  }
  function getAgeInHours(postedAt) {
    const posted = new Date(postedAt).getTime();
    const now = Date.now();
    return (now - posted) / (1e3 * 60 * 60);
  }
  function getExpectedPoints(ageHours, isPost = false) {
    const base = 5 + 2 * Math.sqrt(ageHours);
    return isPost ? base * 6.7 : base;
  }
  function getAuthorVotingPower(karma) {
    return karma >= 1e3 ? 2 : 1;
  }
  function calculateNormalizedScore(points, ageHours, authorName, authorKarma = 0, isPost = false) {
    const pub = getExpectedPoints(ageHours, isPost);
    const plb = getAuthorVotingPower(authorKarma);
    const authorPrefs = getAuthorPreferences();
    let normalized = (points - plb) / (pub - plb);
    if (authorPrefs[authorName]) {
      normalized += authorPrefs[authorName] * 0.52;
    }
    return normalized;
  }
  function shouldAutoHide(normalizedScore) {
    return normalizedScore < -0.51;
  }
  function getFontSizePercent(points, isPost = false) {
    if (isPost) {
      const cappedPoints = Math.min(points, 200);
      return Math.round((cappedPoints / 200 + 1) * 100);
    } else {
      const cappedPoints = Math.min(points, 20);
      return Math.round((cappedPoints / 40 + 1) * 100);
    }
  }
  function clampScore(normalized) {
    return Math.max(0, Math.min(1, normalized));
  }
  function calculateTreeKarma(id, baseScore, isRead2, children, readState, childrenByParentId, cutoffDate) {
    let hasUnread = !isRead2;
    const initialScore = Number(baseScore) || 0;
    let maxKarma = isRead2 ? -Infinity : initialScore;
    const queue = [...children];
    const visited = new Set([id]);
    while (queue.length > 0) {
      const current = queue.shift();
      if (visited.has(current._id)) continue;
      visited.add(current._id);
      let currentIsRead = readState[current._id] === 1;
      if (!currentIsRead && cutoffDate && cutoffDate !== "__LOAD_RECENT__" && current.postedAt < cutoffDate) {
        currentIsRead = true;
      }
      if (!currentIsRead) {
        hasUnread = true;
        const score = Number(current.baseScore) || 0;
        if (score > maxKarma) {
          maxKarma = score;
        }
      }
      const descendants = childrenByParentId.get(current._id);
      if (descendants) {
        for (const d of descendants) {
          queue.push(d);
        }
      }
    }
    if (!hasUnread) {
      return -Infinity;
    }
    return maxKarma;
  }
  const escapeHtml = (unsafe) => {
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  };
  const renderReactions = (commentId, extendedScore, currentUserExtendedVote) => {
    let html = '<span class="pr-reactions-inner">';
    const reacts = extendedScore?.reacts || {};
    const userReacts = currentUserExtendedVote?.reacts || [];
    const allReactions = getReactions();
    const reactionCounts = {};
    Object.entries(reacts).forEach(([reactName, users]) => {
      let score = 0;
      users.forEach((u) => {
        if (u.reactType === "disagreed") score -= 1;
        else score += 1;
      });
      if (score > 0) {
        reactionCounts[reactName] = score;
      }
    });
    allReactions.forEach((reaction) => {
      const count = reactionCounts[reaction.name] || 0;
      const userVoted = userReacts.some((r) => r.react === reaction.name);
      if (count > 0 || userVoted) {
        const filter = reaction.filter || DEFAULT_FILTER;
        const opacity = filter.opacity ?? 1;
        const saturate = filter.saturate ?? 1;
        const scale = filter.scale ?? 1;
        const tx = filter.translateX ?? 0;
        const ty = filter.translateY ?? 0;
        const padding = filter.padding ?? 0;
        const imgStyle = `
        filter: opacity(${opacity}) saturate(${saturate});
        transform: scale(${scale}) translate(${tx}px, ${ty}px);
        padding: ${padding}px;
      `;
        const title = `${reaction.label}${reaction.description ? "\\n" + reaction.description : ""}`;
        html += `
        <span class="pr-reaction-chip ${userVoted ? "voted" : ""}" 
              data-action="reaction-vote" 
              data-comment-id="${commentId}" 
              data-reaction-name="${reaction.name}"
              title="${escapeHtml(title)}">
          <span class="pr-reaction-icon" style="overflow:visible">
             <img src="${reaction.svg}" alt="${reaction.name}" style="${imgStyle}">
          </span>
          <span class="pr-reaction-count">${count > 0 ? count : ""}</span>
        </span>
      `;
      }
    });
    html += `
    <span class="pr-add-reaction-btn" data-action="open-picker" data-comment-id="${commentId}" title="Add reaction">
      <svg height="16" viewBox="0 0 16 16" width="16"><g fill="currentColor"><path d="m13 7c0-3.31371-2.6863-6-6-6-3.31371 0-6 2.68629-6 6 0 3.3137 2.68629 6 6 6 .08516 0 .1699-.0018.25419-.0053-.11154-.3168-.18862-.6499-.22673-.9948l-.02746.0001c-2.76142 0-5-2.23858-5-5s2.23858-5 5-5 5 2.23858 5 5l-.0001.02746c.3449.03811.678.11519.9948.22673.0035-.08429.0053-.16903.0053-.25419z"></path><path d="m7.11191 10.4982c.08367-.368.21246-.71893.38025-1.04657-.15911.03174-.32368.04837-.49216.04837-.74037 0-1.40506-.3212-1.86354-.83346-.18417-.20576-.50026-.22327-.70603-.03911-.20576.18417-.22327.50026-.03911.70603.64016.71524 1.57205 1.16654 2.60868 1.16654.03744 0 .07475-.0006.11191-.0018z"></path><path d="m6 6c0 .41421-.33579.75-.75.75s-.75-.33579-.75-.75.33579-.75.75-.75.75.33579.75.75z"></path><path d="m8.75 6.75c.41421 0 .75-.33579.75-.75s-.33579-.75-.75-.75-.75.33579-.75.75.33579.75.75.75z"></path><path d="m15 11.5c0 1.933-1.567 3.5-3.5 3.5s-3.5-1.567-3.5-3.5 1.567-3.5 3.5-3.5 3.5 1.567 3.5 3.5zm-3-2c0-.27614-.2239-.5-.5-.5s-.5.22386-.5.5v1.5h-1.5c-.27614 0-.5.2239-.5.5s.22386.5.5.5h1.5v1.5c0 .2761.2239.5.5.5s.5-.2239.5-.5v-1.5h1.5c.2761 0 .5-.2239.5-.5s-.2239-.5-.5-.5h-1.5z"></path></g></svg>
    </span>
  `;
    html += "</span>";
    return html;
  };
  const calculatePostHeaderStyle = (post) => {
    if (!post.htmlBody) return "";
    const authorName = post.user?.username || "Unknown Author";
    const authorKarma = post.user?.karma || 0;
    const postedAt = post.postedAt || ( new Date()).toISOString();
    const ageHours = getAgeInHours(postedAt);
    const score = post.baseScore || 0;
    const normalized = calculateNormalizedScore(score, ageHours, authorName, authorKarma, true);
    const clampedScore = clampScore(normalized);
    const scoreColor = normalized > 0 ? getPostScoreColor(clampedScore) : "";
    const fontSize = getFontSizePercent(score, true);
    let style = "";
    if (scoreColor) style += `background-color: ${scoreColor};`;
    style += ` font-size: ${fontSize}%;`;
    return style;
  };
  const renderPostMetadata = (post, state2, isFullPost = true) => {
    const authorHandle = post.user?.username || "Unknown Author";
    const authorName = post.user?.displayName || authorHandle;
    const voteButtonsHtml = renderVoteButtons(
      post._id,
      post.baseScore || 0,
      post.currentUserVote ?? null,
      post.currentUserExtendedVote ?? null,
      post.afExtendedScore?.agreement ?? 0,
      post.voteCount || 0,
      0,
      window.location.hostname.includes("effectivealtruism.org"),
      isFullPost
    );
    const reactionsHtml = renderReactions(
      post._id,
      post.extendedScore,
      post.currentUserExtendedVote
    );
    const authorPrefs = getAuthorPreferences();
    let authorPref = authorPrefs[authorHandle];
    if (authorPref === void 0 && post.user?._id && state2?.subscribedAuthorIds.has(post.user._id)) {
      authorPref = 1;
    }
    authorPref = authorPref || 0;
    const postedAt = post.postedAt || ( new Date()).toISOString();
    const date = new Date(postedAt);
    const timeStr = date.toLocaleString().replace(/ ?GMT.*/, "");
    const authorSlug = post.user?.slug;
    const authorLink = authorSlug ? `/users/${authorSlug}` : "#";
    return `
    <div class="pr-comment-meta pr-post-meta">
      ${voteButtonsHtml}
      ${reactionsHtml}
      <span class="pr-author-controls">
        <span class="pr-author-down ${authorPref < 0 ? "active-down" : ""}" data-action="author-down" title="Mark author as disliked (auto-hide their future comments)">↓</span>
      </span>
      <a href="${authorLink}" target="_blank" class="pr-author" data-author-id="${post.user?._id || ""}">${escapeHtml(authorName)}</a>
      <span class="pr-author-controls">
        <span class="pr-author-up ${authorPref > 0 ? "active-up" : ""}" data-action="author-up" title="Mark author as preferred (highlight their future comments)">↑</span>
      </span>
      <span class="pr-timestamp">
        <a href="${post.pageUrl}" target="_blank">${timeStr}</a>
      </span>
    </div>
  `;
  };
  const renderPostHeader = (post, options = {}) => {
    const { isSticky = false, isFullPost = false, state: state2 } = options;
    const metadataHtml = renderPostMetadata(post, state2, isFullPost);
    const headerStyle = calculatePostHeaderStyle(post);
    const escapedTitle = escapeHtml(post.title);
    const classes = [
      "pr-post-header",
      !isFullPost ? "header-clickable" : "",
      isSticky ? "pr-sticky-header-content" : ""
].filter(Boolean).join(" ");
    const commentCount = post.commentCount || 0;
    let loadedCount = 0;
    let isLastPost = false;
    if (state2) {
      loadedCount = state2.comments.filter((c) => c.postId === post._id).length;
      isLastPost = state2.posts.length > 0 && state2.posts[state2.posts.length - 1]._id === post._id;
    }
    const eTooltip = isFullPost ? "Collapse post body" : "Expand/load post body";
    const aDisabled = commentCount === 0 || commentCount > 0 && loadedCount >= commentCount;
    const aTooltip = commentCount === 0 ? "No comments to load" : aDisabled ? `All ${commentCount} comments already loaded` : `Load all ${commentCount} comments for this post`;
    const cDisabled = commentCount === 0;
    const cTooltip = cDisabled ? "No comments to scroll to" : "Scroll to first comment";
    const nDisabled = isLastPost;
    const nTooltip = nDisabled ? "No more posts in current feed" : "Scroll to next post";
    return `
    <div class="${classes}" data-action="scroll-to-post-top" style="${headerStyle}" data-post-id="${post._id}">
      ${metadataHtml}
      <h2><span class="pr-post-title" data-post-id="${post._id}"${!isFullPost ? ' data-action="load-post"' : ""}>${escapedTitle}</span></h2>
      <span class="pr-post-actions">
        <span class="pr-post-action text-btn" data-action="send-to-ai-studio" title="Send thread to AI Studio (Shortkey: g, Shift-G to include descendants)">[g]</span>
        <span class="pr-post-action text-btn ${""}" data-action="toggle-post-body" title="${eTooltip}">[e]</span>
        <span class="pr-post-action text-btn ${aDisabled ? "disabled" : ""}" data-action="load-all-comments" title="${aTooltip}">[a]</span>
        <span class="pr-post-action text-btn ${cDisabled ? "disabled" : ""}" data-action="scroll-to-comments" title="${cTooltip}">[c]</span>
        <span class="pr-post-action text-btn ${nDisabled ? "disabled" : ""}" data-action="scroll-to-next-post" title="${nTooltip}">[n]</span>
      </span>
      <span class="pr-post-toggle text-btn" data-action="collapse" title="${isSticky ? "Collapse current threads" : "Collapse post and comments"}">[−]</span>
      <span class="pr-post-toggle text-btn" data-action="expand" style="display:none" title="${isSticky ? "Expand current threads" : "Expand post and comments"}">[+]</span>
    </div>
  `;
  };
  const highlightQuotes = (html, extendedScore) => {
    if (!extendedScore || !extendedScore.reacts) return html;
    const quotesToHighlight = [];
    Object.values(extendedScore.reacts).forEach((users) => {
      users.forEach((u) => {
        if (u.quotes) {
          u.quotes.forEach((q) => {
            if (q.quote && q.quote.trim().length > 0) {
              quotesToHighlight.push(q.quote);
            }
          });
        }
      });
    });
    if (quotesToHighlight.length === 0) return html;
    const uniqueQuotes = [...new Set(quotesToHighlight)].sort((a, b) => b.length - a.length);
    let processedHtml = html;
    uniqueQuotes.forEach((quote) => {
      const escaped = quote.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      try {
        const regex = new RegExp(`(${escaped})`, "g");
        processedHtml = processedHtml.replace(regex, (match) => {
          return `<span class="pr-highlight" title="Reacted content">${match}</span>`;
        });
      } catch {
      }
    });
    return processedHtml;
  };
  const isPlaceholderComment = (comment) => {
    return comment.isPlaceholder === true;
  };
  const renderMissingParentPlaceholder = (comment, repliesHtml = "") => {
    const postId = comment.postId || "";
    return `
    <div class="pr-comment pr-item read pr-missing-parent"
         data-id="${comment._id}"
         data-post-id="${postId}"
         data-parent-id=""
         data-placeholder="1">${repliesHtml}</div>
  `;
  };
  const renderCommentTree = (comment, state2, allComments, allCommentIds, childrenByParentId) => {
    const idSet = allCommentIds ?? new Set(allComments.map((c) => c._id));
    const childrenIndex = childrenByParentId ?? state2.childrenByParentId;
    const replies = childrenIndex.get(comment._id) ?? [];
    const visibleReplies = replies.filter((r) => idSet.has(r._id));
    const cutoff = getLoadFrom();
    const isImplicitlyRead = (item) => {
      return !!(cutoff && cutoff !== "__LOAD_RECENT__" && cutoff.includes("T") && item.postedAt && item.postedAt < cutoff);
    };
    if (visibleReplies.length > 0) {
      const readState = getReadState();
      visibleReplies.forEach((r) => {
        r.treeKarma = calculateTreeKarma(
          r._id,
          r.baseScore || 0,
          readState[r._id] === 1 || isImplicitlyRead(r),
          childrenIndex.get(r._id) || [],
          readState,
          childrenIndex,
          cutoff
        );
      });
      visibleReplies.sort((a, b) => {
        const tkA = a.treeKarma || -Infinity;
        const tkB = b.treeKarma || -Infinity;
        if (tkA !== tkB) return tkB - tkA;
        return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
      });
    }
    const repliesHtml = visibleReplies.length > 0 ? `<div class="pr-replies">${visibleReplies.map((r) => renderCommentTree(r, state2, allComments, idSet, childrenIndex)).join("")}</div>` : "";
    return renderComment(comment, state2, repliesHtml);
  };
  const hasAllDescendantsLoaded = (commentId, state2) => {
    const stack = [commentId];
    while (stack.length > 0) {
      const id = stack.pop();
      const comment = state2.commentById.get(id);
      const directChildrenCount = comment ? comment.directChildrenCount || 0 : 0;
      if (directChildrenCount <= 0) continue;
      const loadedChildren = state2.childrenByParentId.get(id) || [];
      if (loadedChildren.length < directChildrenCount) return false;
      for (const child of loadedChildren) {
        stack.push(child._id);
      }
    }
    return true;
  };
  const getUnreadDescendantCount = (commentId, state2, readState) => {
    let count = 0;
    const stack = [commentId];
    while (stack.length > 0) {
      const currentId = stack.pop();
      const children = state2.childrenByParentId.get(currentId) || [];
      for (const child of children) {
        if (!isRead(child._id, readState, child.postedAt)) {
          count++;
        }
        stack.push(child._id);
      }
    }
    return count;
  };
  const renderComment = (comment, state2, repliesHtml = "") => {
    if (isPlaceholderComment(comment)) {
      return renderMissingParentPlaceholder(comment, repliesHtml);
    }
    const readState = getReadState();
    const isLocallyRead = isRead(comment._id, readState, comment.postedAt);
    const commentIsRead = comment.isContext || isLocallyRead;
    const unreadDescendantCount = getUnreadDescendantCount(comment._id, state2, readState);
    const showAsPlaceholder = isLocallyRead && unreadDescendantCount < 2 && !comment.forceVisible;
    if (showAsPlaceholder) {
      return `
      <div class="pr-comment pr-item read pr-comment-placeholder" 
           data-id="${comment._id}" 
           data-parent-id="${comment.parentCommentId || ""}"
           data-post-id="${comment.postId}">
        <div class="pr-placeholder-bar" title="Ancestor Context (Click to expand)" data-action="expand-placeholder"></div>
        <div class="pr-replies-placeholder"></div> 
        ${repliesHtml}
      </div>
    `;
    }
    const authorHandle = comment.user?.username || comment.author || "Unknown Author";
    const authorName = comment.user?.displayName || authorHandle;
    const authorKarma = comment.user?.karma || 0;
    const postedAt = comment.postedAt || ( new Date()).toISOString();
    const ageHours = getAgeInHours(postedAt);
    const score = comment.baseScore || 0;
    const normalized = calculateNormalizedScore(score, ageHours, authorHandle, authorKarma, false);
    const order = comment._order || 0;
    const isContext = comment.isContext;
    const isReplyToYou = !!(state2.currentUsername && comment.parentComment?.user?.username === state2.currentUsername);
    const autoHide = shouldAutoHide(normalized) && !commentIsRead && !isContext;
    if (autoHide) {
      Logger.debug(`Auto-hiding comment ${comment._id} (score=${normalized.toFixed(2)})`);
    }
    const clampedScore = clampScore(normalized);
    const scoreColor = normalized > 0 ? getScoreColor(clampedScore) : "";
    const recencyColor = order > 0 ? getRecencyColor(order, CONFIG.highlightLastN) : "";
    const fontSize = getFontSizePercent(score, false);
    const authorPrefs = getAuthorPreferences();
    let authorPref = authorPrefs[authorHandle];
    if (authorPref === void 0 && comment.user?._id && state2.subscribedAuthorIds.has(comment.user._id)) {
      authorPref = 1;
    }
    authorPref = authorPref || 0;
    const date = new Date(comment.postedAt);
    const timeStr = date.toLocaleString().replace(/ ?GMT.*/, "");
    const classes = [
      "pr-comment",
      "pr-item",
      commentIsRead ? "read" : "",
      comment.rejected ? "rejected" : "",
      isContext ? "context" : "",
      isReplyToYou ? "reply-to-you" : "",
      autoHide || comment.rejected ? "collapsed" : "",
      comment.justRevealed ? "pr-just-revealed" : ""
    ].filter(Boolean).join(" ");
    const metaStyle = scoreColor ? `background-color: ${scoreColor};` : "";
    const bodyStyle = recencyColor ? `--pr-recency-color: ${recencyColor};` : "";
    const fontStyle = `font-size: ${fontSize}%;`;
    const voteButtonsHtml = renderVoteButtons(
      comment._id,
      comment.baseScore || 0,
      comment.currentUserVote ?? null,
      comment.currentUserExtendedVote ?? null,
      comment.afExtendedScore?.agreement ?? 0,
      0,
0,
true
);
    const reactionsHtml = renderReactions(
      comment._id,
      comment.extendedScore,
      comment.currentUserExtendedVote
    );
    let bodyContent = comment.htmlBody || "<i>(No content)</i>";
    bodyContent = highlightQuotes(bodyContent, comment.extendedScore);
    const authorSlug = comment.user?.slug;
    const authorLink = authorSlug ? `/users/${authorSlug}` : "#";
    const hasParent = !!comment.parentCommentId;
    const totalChildren = comment.directChildrenCount || 0;
    let rDisabled;
    let rTooltip;
    if (totalChildren <= 0) {
      rDisabled = true;
      rTooltip = "No replies to load";
    } else if (hasAllDescendantsLoaded(comment._id, state2)) {
      rDisabled = true;
      rTooltip = "All replies already loaded in current feed";
    } else {
      rDisabled = false;
      rTooltip = "Load all replies from server (Shortkey: r)";
    }
    const tDisabled = !hasParent;
    const tTooltip = tDisabled ? "Already at top level" : "Load parents and scroll to root (Shortkey: t)";
    return `
    <div class="${classes}" 
         data-id="${comment._id}" 
         data-author="${escapeHtml(authorHandle)}"
         data-parent-id="${comment.parentCommentId || ""}"
         data-post-id="${comment.postId}"
         style="${bodyStyle}">
      <div class="pr-comment-meta" style="${metaStyle} ${fontStyle}">
        ${voteButtonsHtml}
        ${reactionsHtml}
        <span class="pr-author-controls">
          <span class="pr-author-down ${authorPref < 0 ? "active-down" : ""}" data-action="author-down" title="Mark author as disliked (auto-hide their future comments)">↓</span>
        </span>
        <a href="${authorLink}" target="_blank" class="pr-author" data-author-id="${comment.user?._id || ""}">${escapeHtml(authorName)}</a>
        <span class="pr-author-controls">
          <span class="pr-author-up ${authorPref > 0 ? "active-up" : ""}" data-action="author-up" title="Mark author as preferred (highlight their future comments)">↑</span>
        </span>
        <span class="pr-timestamp">
          <a href="${comment.pageUrl}" target="_blank">${timeStr}</a>
        </span>
        <span class="pr-comment-controls">
          <span class="pr-comment-action text-btn" data-action="send-to-ai-studio" title="Send thread to AI Studio (Shortkey: g, Shift-G to include descendants)">[g]</span>
          <span class="pr-comment-action text-btn ${rDisabled ? "disabled" : ""}" data-action="load-descendants" title="${rTooltip}">[r]</span>
          <span class="pr-comment-action text-btn ${tDisabled ? "disabled" : ""}" data-action="load-parents-and-scroll" title="${tTooltip}">[t]</span>
          <span class="pr-find-parent text-btn" data-action="find-parent" title="Scroll to parent comment">[^]</span>
          <span class="pr-collapse text-btn" data-action="collapse" title="Collapse comment and its replies">[−]</span>
          <span class="pr-expand text-btn" data-action="expand" title="Expand comment">[+]</span>
        </span>
      </div>
      <div class="pr-comment-body">
        ${bodyContent}
      </div>
      ${repliesHtml}
    </div>
  `;
  };
  const createMissingParentPlaceholder = (parentId, child) => {
    const postedAt = child.postedAt || ( new Date()).toISOString();
    return {
      _id: parentId,
      postedAt,
      htmlBody: "",
      contents: { markdown: null },
      baseScore: 0,
      voteCount: 0,
      pageUrl: child.pageUrl || "",
      author: "",
      rejected: false,
      topLevelCommentId: child.topLevelCommentId || parentId,
      user: null,
      postId: child.postId,
      post: child.post ?? null,
      parentCommentId: null,
      parentComment: null,
      extendedScore: null,
      afExtendedScore: null,
      currentUserVote: null,
      currentUserExtendedVote: null,
      isPlaceholder: true
    };
  };
  const extractParentChain = (comment) => {
    const chain = [];
    let current = comment.parentComment;
    while (current && current._id) {
      chain.push({ _id: current._id, parentCommentId: current.parentCommentId || null });
      current = current.parentComment;
    }
    return chain;
  };
  const withMissingParentPlaceholders = (comments, state2) => {
    if (comments.length === 0) return comments;
    const loadedIds = state2.commentById;
    const existingIds = new Set(comments.map((c) => c._id));
    const placeholdersToAdd = new Map();
    comments.forEach((comment) => {
      const parentId = comment.parentCommentId;
      if (!parentId) return;
      if (loadedIds.has(parentId) || existingIds.has(parentId) || placeholdersToAdd.has(parentId)) return;
      const chain = extractParentChain(comment);
      let childForPlaceholder = comment;
      for (const ancestor of chain) {
        if (loadedIds.has(ancestor._id) || existingIds.has(ancestor._id) || placeholdersToAdd.has(ancestor._id)) {
          break;
        }
        const placeholder = createMissingParentPlaceholder(ancestor._id, childForPlaceholder);
        placeholder.parentCommentId = ancestor.parentCommentId;
        placeholdersToAdd.set(ancestor._id, placeholder);
        childForPlaceholder = placeholder;
      }
      if (!placeholdersToAdd.has(parentId) && !loadedIds.has(parentId) && !existingIds.has(parentId)) {
        placeholdersToAdd.set(parentId, createMissingParentPlaceholder(parentId, comment));
      }
    });
    if (placeholdersToAdd.size === 0) return comments;
    return [...comments, ...placeholdersToAdd.values()];
  };
  const buildChildrenIndex = (comments) => {
    const childrenByParentId = new Map();
    comments.forEach((comment) => {
      const parentId = comment.parentCommentId || "";
      if (!childrenByParentId.has(parentId)) {
        childrenByParentId.set(parentId, []);
      }
      childrenByParentId.get(parentId).push(comment);
    });
    childrenByParentId.forEach((children) => {
      children.sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
    });
    return childrenByParentId;
  };
  const renderPostBody = (post) => {
    let bodyContent = post.htmlBody || "<i>(No content)</i>";
    bodyContent = highlightQuotes(bodyContent, post.extendedScore);
    return `
    <div class="pr-post-content pr-post-body-container truncated" style="max-height: ${CONFIG.maxPostHeight};">
      <div class="pr-post-body">
        ${bodyContent}
      </div>
      <div class="pr-read-more-overlay">
        <button class="pr-read-more-btn" data-action="read-more">Read More</button>
      </div>
    </div>
  `;
  };
  const renderPostGroup = (group, state2) => {
    const commentsWithPlaceholders = withMissingParentPlaceholders(group.comments, state2);
    const visibleChildrenByParentId = buildChildrenIndex(commentsWithPlaceholders);
    const readState = getReadState();
    const commentSet = new Set(commentsWithPlaceholders.map((c) => c._id));
    const rootComments = commentsWithPlaceholders.filter(
      (c) => !c.parentCommentId || !commentSet.has(c.parentCommentId)
    );
    const cutoff = getLoadFrom();
    const isImplicitlyRead = (item) => {
      return !!(cutoff && cutoff !== "__LOAD_RECENT__" && cutoff.includes("T") && item.postedAt && item.postedAt < cutoff);
    };
    rootComments.forEach((c) => {
      c.treeKarma = calculateTreeKarma(
        c._id,
        c.baseScore || 0,
        readState[c._id] === 1 || isImplicitlyRead(c),
        visibleChildrenByParentId.get(c._id) || [],
        readState,
        visibleChildrenByParentId,
        cutoff
      );
    });
    rootComments.sort((a, b) => {
      const tkA = a.treeKarma || -Infinity;
      const tkB = b.treeKarma || -Infinity;
      if (tkA !== tkB) return tkB - tkA;
      return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
    });
    const commentsHtml = rootComments.map(
      (c) => renderCommentTree(c, state2, commentsWithPlaceholders, commentSet, visibleChildrenByParentId)
    ).join("");
    const isFullPost = !!(group.fullPost && group.fullPost.htmlBody);
    const postToRender = group.fullPost || {
      _id: group.postId,
      title: group.title,
      pageUrl: `${window.location.origin}/posts/${group.postId}`,
      postedAt: cutoff || ( new Date()).toISOString(),
baseScore: 0,
      voteCount: 0,
      user: null,
      extendedScore: null,
      afExtendedScore: null,
      currentUserVote: null,
      currentUserExtendedVote: null,
      commentCount: 0
    };
    if (!group.fullPost) {
      Logger.warn(`renderPostGroup: fullPost missing for ${group.postId}, using fallback`);
    }
    const isReadPost = isRead(group.postId, readState, postToRender.postedAt);
    const headerHtml = renderPostHeader(postToRender, {
      isFullPost,
      state: state2
    });
    const postBodyHtml = isFullPost ? renderPostBody(group.fullPost) : "";
    const authorHandle = postToRender.user?.username || "";
    return `
    <div class="pr-post pr-item ${isReadPost ? "read" : ""}" 
         data-post-id="${group.postId}" 
         data-id="${group.postId}"
         data-author="${escapeHtml(authorHandle)}">
      ${headerHtml}
      ${postBodyHtml}
      <div class="pr-post-comments">
        ${commentsHtml}
      </div>
    </div>
  `;
  };
  const setupLinkPreviews = (comments) => {
    const postHeaders = document.querySelectorAll(".pr-post-header");
    postHeaders.forEach((header) => {
      const postId = header.getAttribute("data-post-id");
      if (!postId) return;
      const titleH2 = header.querySelector("h2");
      if (titleH2) {
        setupHoverPreview(
          titleH2,
          createPostPreviewFetcher(postId),
          {
            type: "post",
            targetGetter: () => {
              const post = document.querySelector(`.pr-post[data-id="${postId}"]`);
              if (!post) return null;
              const body = post.querySelector(".pr-post-body-container");
              const collapsed = post.querySelector(".pr-post-content.collapsed");
              if (!body || collapsed) return null;
              if (isElementFullyVisible(post)) {
                return [post];
              }
              return null;
            }
          }
        );
      }
    });
    const authorLinks = document.querySelectorAll(".pr-author");
    authorLinks.forEach((link) => {
      const userId = link.getAttribute("data-author-id");
      if (userId) {
        setupHoverPreview(
          link,
          createAuthorPreviewFetcher(userId),
          { type: "author" }
        );
      }
    });
    const commentLinks = document.querySelectorAll(".pr-comment-body a");
    commentLinks.forEach((link) => {
      const href = link.getAttribute("href");
      if (!href) return;
      if (isCommentUrl(href)) {
        const commentId = extractCommentIdFromUrl(href);
        if (commentId) {
          setupHoverPreview(
            link,
            createCommentPreviewFetcher(commentId, comments),
            { type: "comment" }
          );
          return;
        }
      }
      if (isPostUrl(href)) {
        const postId = extractPostIdFromUrl(href);
        if (postId) {
          setupHoverPreview(
            link,
            createPostPreviewFetcher(postId),
            { type: "post" }
          );
          return;
        }
      }
      if (isAuthorUrl(href)) {
        const authorSlug = extractAuthorSlugFromUrl(href);
        if (authorSlug) {
          setupHoverPreview(
            link,
            createAuthorBySlugPreviewFetcher(authorSlug),
            { type: "author" }
          );
          return;
        }
      }
      if (isWikiUrl(href)) {
        const wikiSlug = extractWikiSlugFromUrl(href);
        if (wikiSlug) {
          setupHoverPreview(
            link,
            createWikiPreviewFetcher(wikiSlug),
            { type: "wiki" }
          );
        }
      }
    });
    const parentLinks = document.querySelectorAll(".pr-find-parent");
    parentLinks.forEach((link) => {
      const comment = link.closest(".pr-comment");
      const parentId = comment?.getAttribute("data-parent-id");
      if (parentId) {
        setupHoverPreview(
          link,
          createCommentPreviewFetcher(parentId, comments),
          {
            type: "comment",
            targetGetter: () => document.querySelector(`.pr-comment[data-id="${parentId}"]`)
          }
        );
      } else {
        const postId = comment?.getAttribute("data-post-id");
        if (postId) {
          setupHoverPreview(
            link,
            createPostPreviewFetcher(postId),
            {
              type: "post",
              targetGetter: () => {
                const post = document.querySelector(`.pr-post[data-id="${postId}"]`);
                if (!post) return null;
                const header = post.querySelector(".pr-post-header");
                const body = post.querySelector(".pr-post-body-container");
                const collapsed = post.querySelector(".pr-post-content.collapsed");
                const targets = [];
                if (header) targets.push(header);
                if (body && !collapsed) {
                  targets.push(body);
                }
                const stickyHeader2 = document.querySelector(`.pr-sticky-header.visible .pr-post-header[data-post-id="${postId}"]`);
                if (stickyHeader2) targets.push(stickyHeader2);
                return targets.length > 0 ? targets : null;
              }
            }
          );
        }
      }
      link.addEventListener("click", () => {
        cancelHoverTimeout();
      });
    });
    const expandButtons = document.querySelectorAll(".pr-expand");
    expandButtons.forEach((btn) => {
      const comment = btn.closest(".pr-comment");
      const commentId = comment?.getAttribute("data-id");
      if (commentId) {
        setupHoverPreview(
          btn,
          createCommentPreviewFetcher(commentId, comments),
          { type: "comment" }
        );
      }
    });
    const placeholderBars = document.querySelectorAll(".pr-placeholder-bar");
    placeholderBars.forEach((bar) => {
      const comment = bar.closest(".pr-comment");
      const commentId = comment?.getAttribute("data-id");
      if (commentId) {
        setupHoverPreview(
          bar,
          createCommentPreviewFetcher(commentId, comments),
          { type: "comment" }
        );
      }
    });
  };
  class StickyHeader {
    container = null;
    lastPostId = null;
    isVisible = false;
    constructor() {
      this.container = document.getElementById("pr-sticky-header");
    }
init() {
      if (!this.container) {
        console.warn("[StickyHeader] Container not found");
        return;
      }
      window.addEventListener("scroll", () => this.handleScroll(), { passive: true });
    }
refresh() {
      if (!this.container || !this.lastPostId || !this.isVisible) return;
      this.render(this.lastPostId, null);
    }
    handleScroll() {
      if (!this.container) return;
      const posts = document.querySelectorAll(".pr-post");
      let currentPost = null;
      for (let i = 0; i < posts.length; i++) {
        const post = posts[i];
        const rect = post.getBoundingClientRect();
        if (rect.top < 100 && rect.bottom > 100) {
          const header = post.querySelector(".pr-post-header");
          if (header) {
            const headerRect = header.getBoundingClientRect();
            if (headerRect.top < -1) {
              currentPost = post;
            }
          }
          break;
        }
      }
      if (currentPost) {
        this.updateHeaderContent(currentPost);
      } else {
        this.hide();
      }
    }
    updateHeaderContent(currentPost) {
      if (!this.container) return;
      const postId = currentPost.getAttribute("data-post-id") || "";
      if (postId !== this.lastPostId || !this.isVisible) {
        this.lastPostId = postId;
        this.render(postId, currentPost);
        this.show();
      }
    }
    render(postId, currentPost) {
      if (!this.container) return;
      const state2 = getState();
      const post = state2.postById.get(postId);
      if (!post) return;
      const isFullPost = !!post.htmlBody;
      this.container.innerHTML = renderPostHeader(post, {
        isSticky: true,
        isFullPost,
        state: state2
      });
      this.container.setAttribute("data-author", post.user?.username || "");
      const newHeader = this.container.querySelector(".pr-post-header");
      const titleH2 = newHeader.querySelector("h2");
      const authorLink = newHeader.querySelector(".pr-author");
      const postEl = currentPost || document.querySelector(`.pr-post[data-id="${postId}"]`);
      const isCollapsed = !!postEl?.querySelector(".pr-post-comments.collapsed, .pr-post-content.collapsed");
      if (newHeader) {
        const collapseBtn = newHeader.querySelector('[data-action="collapse"]');
        const expandBtn = newHeader.querySelector('[data-action="expand"]');
        if (collapseBtn) collapseBtn.style.display = isCollapsed ? "none" : "inline";
        if (expandBtn) expandBtn.style.display = isCollapsed ? "inline" : "none";
        const nBtn = newHeader.querySelector('[data-action="scroll-to-next-post"]');
        if (nBtn) {
          let nextPost = postEl ? postEl.nextElementSibling : null;
          while (nextPost && !nextPost.classList.contains("pr-post")) {
            nextPost = nextPost.nextElementSibling;
          }
          if (!nextPost) {
            nBtn.classList.add("disabled");
            nBtn.title = "No more posts in current feed";
          } else {
            nBtn.classList.remove("disabled");
            nBtn.title = "Scroll to next post";
          }
        }
      }
      if (titleH2 && postId) {
        setupHoverPreview(
          titleH2,
          createPostPreviewFetcher(postId),
          { type: "post" }
        );
      }
      if (authorLink) {
        const userId = authorLink.getAttribute("data-author-id");
        if (userId) {
          setupHoverPreview(
            authorLink,
            createAuthorPreviewFetcher(userId),
            { type: "author" }
          );
        }
      }
    }
    show() {
      if (this.container) {
        this.container.classList.add("visible");
        this.isVisible = true;
      }
    }
    hide() {
      if (this.container && this.isVisible) {
        this.lastPostId = null;
        this.container.classList.remove("visible");
        this.isVisible = false;
      }
    }
  }
  let stickyHeader = null;
  const setupStickyHeader = () => {
    if (stickyHeader) return;
    stickyHeader = new StickyHeader();
    stickyHeader.init();
  };
  const getStickyHeader = () => stickyHeader;
  const setupInlineReactions = (state2) => {
    document.addEventListener("selectionchange", () => {
      const selection = window.getSelection();
      const existingBtn = document.getElementById("pr-inline-react-btn");
      if (!selection || selection.isCollapsed || !selection.toString().trim()) {
        if (existingBtn && !document.getElementById("pr-global-reaction-picker")?.classList.contains("visible")) {
          existingBtn.remove();
          state2.currentSelection = null;
        }
        return;
      }
      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;
      const commentBody = (container.nodeType === 3 ? container.parentElement : container)?.closest(".pr-comment-body");
      if (!commentBody) {
        if (existingBtn) existingBtn.remove();
        return;
      }
      const text = selection.toString().slice(0, 500);
      state2.currentSelection = { text, range };
      if (!existingBtn) {
        const btn = document.createElement("div");
        btn.id = "pr-inline-react-btn";
        btn.className = "pr-inline-react-btn";
        btn.textContent = "React";
        btn.dataset.commentId = commentBody.closest(".pr-comment")?.getAttribute("data-id") || "";
        document.body.appendChild(btn);
        const rect = range.getBoundingClientRect();
        btn.style.top = `${rect.top - 30 + window.scrollY}px`;
        btn.style.left = `${rect.left + rect.width / 2}px`;
      } else {
        const rect = range.getBoundingClientRect();
        existingBtn.style.top = `${rect.top - 30 + window.scrollY}px`;
        existingBtn.style.left = `${rect.left + rect.width / 2}px`;
        existingBtn.dataset.commentId = commentBody.closest(".pr-comment")?.getAttribute("data-id") || "";
      }
    });
  };
  const setupExternalLinks = () => {
    document.addEventListener("click", (e) => {
      const target = e.target;
      const link = target.closest("a");
      if (!link) return;
      const hostname = link.hostname;
      const pathname = link.pathname;
      const isReaderLink = pathname.startsWith("/reader");
      const isAnchor = link.getAttribute("href")?.startsWith("#");
      if (isAnchor) return;
      if (hostname && (hostname !== window.location.hostname || !isReaderLink)) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }
    }, { capture: true, passive: true });
  };
  class ReadTracker {
    scrollMarkDelay;
    commentsDataGetter;
    postsDataGetter;
    initialBatchNewestDateGetter;
    pendingReadTimeouts = {};
    scrollTimeout = null;
    scrollListenerAdded = false;
    isCheckingForMore = false;
    lastCheckedIso = null;
    recheckTimer = null;
    countdownSeconds = 0;
    hasAdvancedThisBatch = false;
    constructor(scrollMarkDelay, commentsDataGetter, postsDataGetter = () => [], initialBatchNewestDateGetter = () => null) {
      this.scrollMarkDelay = scrollMarkDelay;
      this.commentsDataGetter = commentsDataGetter;
      this.postsDataGetter = postsDataGetter;
      this.initialBatchNewestDateGetter = initialBatchNewestDateGetter;
    }
    init() {
      if (this.scrollListenerAdded) return;
      window.addEventListener("scroll", () => this.handleScroll(), { passive: true });
      this.scrollListenerAdded = true;
      this.hasAdvancedThisBatch = false;
      setTimeout(() => this.checkInitialState(), 1e3);
    }
    checkInitialState() {
      const unreadCountEl = document.getElementById("pr-unread-count");
      const unreadCount = parseInt(unreadCountEl?.textContent || "0", 10);
      if (unreadCount === 0) {
        const currentComments = this.commentsDataGetter();
        if (currentComments.length > 0) {
          this.advanceAndCheck(currentComments);
        }
      }
    }
    handleScroll() {
      if (this.scrollTimeout) {
        return;
      }
      this.scrollTimeout = window.setTimeout(() => {
        this.scrollTimeout = null;
        this.processScroll();
      }, 200);
    }
    processScroll() {
      const items = document.querySelectorAll(".pr-comment:not(.read):not(.context), .pr-item:not(.read):not(.context)");
      const readThreshold = 0;
      const isAtBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 50;
      Logger.debug(`processScroll: items=${items.length}, isAtBottom=${isAtBottom}, scrollY=${window.scrollY}`);
      items.forEach((el) => {
        const id = el.getAttribute("data-id");
        if (!id) return;
        const rect = el.getBoundingClientRect();
        let checkRect = rect;
        if (el.classList.contains("pr-post")) {
          const body = el.querySelector(".pr-post-content");
          if (body && !body.classList.contains("collapsed")) {
            checkRect = body.getBoundingClientRect();
          } else {
            const header = el.querySelector(".pr-post-header");
            if (header) checkRect = header.getBoundingClientRect();
          }
        } else if (el.classList.contains("pr-comment")) {
          const body = el.querySelector(".pr-comment-body");
          if (body && !el.classList.contains("collapsed")) {
            checkRect = body.getBoundingClientRect();
          } else {
            const meta = el.querySelector(".pr-comment-meta");
            if (meta) checkRect = meta.getBoundingClientRect();
          }
        }
        const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
        const shouldMark = checkRect.bottom < readThreshold || isAtBottom && isVisible;
        if (shouldMark) {
          if (!this.pendingReadTimeouts[id]) {
            Logger.debug(`processScroll: marking ${id} as read`);
            this.pendingReadTimeouts[id] = window.setTimeout(() => {
              delete this.pendingReadTimeouts[id];
              const currentEl = document.querySelector(`.pr-comment[data-id="${id}"], .pr-item[data-id="${id}"]`);
              if (currentEl && !currentEl.classList.contains("read")) {
                markAsRead({ [id]: 1 });
                currentEl.classList.add("read");
                const allRemainingUnread = document.querySelectorAll(".pr-comment:not(.read):not(.context), .pr-item:not(.read):not(.context)");
                const newCount = allRemainingUnread.length;
                const unreadCountEl = document.getElementById("pr-unread-count");
                if (unreadCountEl) {
                  unreadCountEl.textContent = newCount.toString();
                  Logger.debug(`processScroll: ${id} read, recalculated unread count=${newCount}`);
                  const isNowAtBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 100;
                  if (newCount === 0 && isNowAtBottom) {
                    Logger.debug("processScroll: hit 0 unread at bottom, checking server");
                    this.checkInitialState();
                  }
                }
              }
            }, this.scrollMarkDelay);
          }
        } else {
          if (this.pendingReadTimeouts[id]) {
            window.clearTimeout(this.pendingReadTimeouts[id]);
            delete this.pendingReadTimeouts[id];
          }
        }
      });
      const currentComments = this.commentsDataGetter();
      if (isAtBottom && currentComments.length > 0) {
        Logger.debug("processScroll: at bottom, advancing");
        this.advanceAndCheck(currentComments);
      }
    }
    advanceAndCheck(currentComments) {
      if (this.hasAdvancedThisBatch) return;
      const initialNewest = this.initialBatchNewestDateGetter();
      let newestDateStr;
      if (initialNewest) {
        newestDateStr = initialNewest;
      } else {
        const newestComment = currentComments.reduce((prev, current) => {
          return new Date(current.postedAt) > new Date(prev.postedAt) ? current : prev;
        });
        newestDateStr = newestComment.postedAt;
      }
      const date = new Date(newestDateStr);
      date.setMilliseconds(date.getMilliseconds() + 1);
      const nextLoadFrom = date.toISOString();
      const currentLoadFrom = getLoadFrom();
      if (nextLoadFrom !== currentLoadFrom) {
        Logger.info(`Advancing session start to ${nextLoadFrom}`);
        setLoadFrom(nextLoadFrom);
        this.hasAdvancedThisBatch = true;
        const readState = getReadState();
        const dateByItemId = new Map();
        currentComments.forEach((c) => dateByItemId.set(c._id, c.postedAt));
        this.postsDataGetter().forEach((p) => dateByItemId.set(p._id, p.postedAt));
        const cleanupCutoffTime = new Date(currentLoadFrom).getTime();
        let removedCount = 0;
        for (const id of Object.keys(readState)) {
          if (dateByItemId.has(id)) continue;
          const postedAt = dateByItemId.get(id);
          if (!postedAt || new Date(postedAt).getTime() < cleanupCutoffTime) {
            delete readState[id];
            removedCount++;
          }
        }
        if (removedCount > 0) {
          setReadState(readState);
          Logger.info(`Cleaned up read state: removed ${removedCount} items older than ${nextLoadFrom}`);
        }
      }
      this.checkServerForMore(nextLoadFrom);
    }
    startRecheckTimer(afterIso) {
      if (this.recheckTimer) clearInterval(this.recheckTimer);
      this.countdownSeconds = 60;
      this.updateCountdownMessage(afterIso);
      this.recheckTimer = window.setInterval(() => {
        this.countdownSeconds--;
        if (this.countdownSeconds <= 0) {
          clearInterval(this.recheckTimer);
          this.recheckTimer = null;
          this.checkServerForMore(afterIso, true);
        } else {
          this.updateCountdownMessage(afterIso);
        }
      }, 1e3);
    }
    updateCountdownMessage(afterIso) {
      const msgEl = document.getElementById("pr-bottom-message");
      if (!msgEl) return;
      msgEl.style.display = "block";
      msgEl.textContent = `All comments have been marked read. No more comments on server. Waiting ${this.countdownSeconds}s for next check, or click here to check again.`;
      msgEl.onclick = () => {
        if (this.recheckTimer) clearInterval(this.recheckTimer);
        this.recheckTimer = null;
        this.checkServerForMore(afterIso, true);
      };
    }
    async checkServerForMore(afterIso, force = false) {
      if (this.isCheckingForMore && !force) return;
      if (this.lastCheckedIso === afterIso && !force) return;
      if (this.recheckTimer && !force) return;
      this.isCheckingForMore = true;
      this.lastCheckedIso = afterIso;
      const msgEl = document.getElementById("pr-bottom-message");
      if (!msgEl) return;
      msgEl.style.display = "block";
      msgEl.textContent = "Checking for more comments...";
      msgEl.className = "pr-bottom-message";
      msgEl.onclick = null;
      try {
        const res = await queryGraphQL(GET_ALL_RECENT_COMMENTS, {
          after: afterIso,
          limit: 1,
          sortBy: "oldest"
        });
        const hasMore = (res?.comments?.results?.length || 0) > 0;
        if (hasMore) {
          msgEl.textContent = "New comments available! Click here to reload.";
          msgEl.classList.add("has-more");
          msgEl.onclick = () => window.location.reload();
          if (this.recheckTimer) clearInterval(this.recheckTimer);
          this.recheckTimer = null;
        } else {
          this.startRecheckTimer(afterIso);
        }
      } catch (e) {
        Logger.error("Failed to check for more comments:", e);
        msgEl.textContent = "Failed to check server. Click to retry.";
        msgEl.onclick = () => this.checkServerForMore(afterIso, true);
      } finally {
        this.isCheckingForMore = false;
      }
    }
  }
  let readTracker = null;
  const setupScrollTracking = (commentsGetter, postsGetter, initialBatchNewestDateGetter = () => null) => {
    if (readTracker) {
      readTracker = null;
    }
    readTracker = new ReadTracker(CONFIG.scrollMarkDelay, commentsGetter, postsGetter, initialBatchNewestDateGetter);
    readTracker.init();
  };
  const smartScrollTo = (el, isPost) => {
    const postContainer = el.closest(".pr-post");
    if (!postContainer) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const postHeader = postContainer.querySelector(".pr-post-header");
    const stickyHeader2 = document.getElementById("pr-sticky-header");
    const stickyHeight = stickyHeader2 && stickyHeader2.classList.contains("visible") ? stickyHeader2.offsetHeight : 0;
    const headerHeight = postHeader ? postHeader.offsetHeight : stickyHeight || 60;
    if (isPost) {
      const headerTop = postHeader ? postHeader.getBoundingClientRect().top + window.pageYOffset : postContainer.getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo({
        top: headerTop,
        behavior: window.__PR_TEST_MODE__ ? "instant" : "smooth"
      });
    } else {
      const elementTop = el.getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo({
        top: elementTop - headerHeight - 10,
behavior: window.__PR_TEST_MODE__ ? "instant" : "smooth"
      });
    }
  };
  const refreshPostActionButtons = (postId) => {
    const selector = postId ? `.pr-post[data-id="${postId}"]` : ".pr-post";
    const posts = document.querySelectorAll(selector);
    const updateNextPostButton = (header, postEl) => {
      if (!header) return;
      const nBtn = header.querySelector('[data-action="scroll-to-next-post"]');
      if (!nBtn) return;
      let nextPost = postEl ? postEl.nextElementSibling : null;
      while (nextPost && !nextPost.classList.contains("pr-post")) {
        nextPost = nextPost.nextElementSibling;
      }
      if (!nextPost) {
        nBtn.classList.add("disabled");
        nBtn.title = "No more posts in current feed";
      } else {
        nBtn.classList.remove("disabled");
        nBtn.title = "Scroll to next post";
      }
    };
    posts.forEach((post) => {
      const container = post.querySelector(".pr-post-body-container");
      const eBtn = post.querySelector('[data-action="toggle-post-body"]');
      if (container && eBtn) {
        const isFullPost = !!container.querySelector(".pr-post-body");
        if (container.classList.contains("truncated")) {
          if (container.classList.contains("collapsed") || container.style.display === "none") {
            eBtn.classList.remove("disabled");
            eBtn.title = "Expand post body";
          } else {
            const isActuallyTruncated = container.scrollHeight > container.offsetHeight;
            if (!isActuallyTruncated) {
              const overlay = container.querySelector(".pr-read-more-overlay");
              if (overlay) overlay.style.display = "none";
              eBtn.classList.add("disabled");
              eBtn.title = "Post fits within viewport without truncation";
            } else {
              eBtn.classList.remove("disabled");
              eBtn.title = "Expand post body";
            }
          }
        } else if (isFullPost) {
          if (container.classList.contains("collapsed")) {
            eBtn.title = "Expand post body";
          } else {
            const isSmallContent = container.scrollHeight <= window.innerHeight * 0.5;
            if (isSmallContent) {
              eBtn.classList.add("disabled");
              eBtn.title = "Post body is small and doesn't need toggle";
              const overlay = container.querySelector(".pr-read-more-overlay");
              if (overlay) overlay.style.display = "none";
            } else {
              eBtn.title = "Collapse post body";
            }
          }
          if (!eBtn.title.includes("small")) {
            eBtn.classList.remove("disabled");
          }
        }
      }
      const header = post.querySelector(".pr-post-header");
      updateNextPostButton(header, post);
    });
    const stickyHeader2 = document.querySelector(".pr-sticky-header .pr-post-header");
    if (stickyHeader2) {
      const stickyPostId = stickyHeader2.getAttribute("data-post-id");
      const stickyPostEl = stickyPostId ? document.querySelector(`.pr-post[data-id="${stickyPostId}"]`) : null;
      updateNextPostButton(stickyHeader2, stickyPostEl);
    }
  };
  const formatStatusDate = (iso) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const mon = months[d.getMonth()];
    const day = d.getDate();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${mon} ${day} ${hh}:${mm}`;
  };
  const buildPostGroups = (comments, posts, state2) => {
    const readState = getReadState();
    const sortedComments = [...comments].sort(
      (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
    );
    const unreadIds = new Set();
    const parentIds = new Set();
    const cutoff = getLoadFrom();
    const isImplicitlyRead = (item) => {
      return !!(cutoff && cutoff !== "__LOAD_RECENT__" && cutoff.includes("T") && item.postedAt && item.postedAt < cutoff);
    };
    sortedComments.forEach((c) => {
      const isContext = c.isContext;
      const isLocallyRead = isRead(c._id, readState, c.postedAt);
      const implicit = isImplicitlyRead(c);
      const commentIsRead = isLocallyRead || implicit;
      if (isContext || !commentIsRead) {
        if (!isContext) unreadIds.add(c._id);
        let currentId = c._id;
        const visited = new Set();
        while (currentId) {
          if (visited.has(currentId)) break;
          visited.add(currentId);
          parentIds.add(currentId);
          const currentComment = state2.commentById.get(currentId);
          currentId = currentComment?.parentCommentId || null;
        }
      }
    });
    const idsToShow = new Set([...unreadIds, ...parentIds]);
    const unreadPostIds = new Set();
    posts.forEach((p) => {
      const readStatus = isRead(p._id, readState, p.postedAt) || isImplicitlyRead(p);
      if (!readStatus) {
        unreadPostIds.add(p._id);
      }
    });
    const postGroups = new Map();
    posts.forEach((post) => {
      if (!post) return;
      if (!postGroups.has(post._id)) {
        postGroups.set(post._id, { title: post.title, postId: post._id, comments: [], fullPost: post });
      } else {
        postGroups.get(post._id).fullPost = post;
      }
    });
    sortedComments.forEach((comment, index) => {
      if (!idsToShow.has(comment._id) && !parentIds.has(comment._id)) return;
      const postId = comment.postId;
      if (!postId) return;
      if (!postGroups.has(postId)) {
        const postTitle = comment.post?.title || "Unknown Post";
        const fullerPost = state2.postById.get(postId) || comment.post;
        postGroups.set(postId, {
          title: postTitle,
          postId,
          comments: [],
          fullPost: fullerPost
        });
      }
      comment._order = index < CONFIG.highlightLastN ? index + 1 : 0;
      postGroups.get(postId).comments.push(comment);
    });
    let groupsList = Array.from(postGroups.values());
    groupsList.forEach((g) => {
      const postRecord = state2.postById.get(g.postId);
      const post = postRecord || g.fullPost || { _id: g.postId, baseScore: 0 };
      const isPostRead = isRead(g.postId, readState, post.postedAt) || isImplicitlyRead(post);
      const rootCommentsOfPost = g.comments.filter((c) => !c.parentCommentId || !state2.commentById.has(c.parentCommentId));
      g.treeKarma = calculateTreeKarma(
        g.postId,
        post.baseScore || 0,
        isPostRead,
        rootCommentsOfPost,
        readState,
        state2.childrenByParentId,
        cutoff
      );
      g.postedAt = post.postedAt || ( new Date()).toISOString();
      if (g.treeKarma === -Infinity) {
        Logger.warn(`Post group ${g.postId} has Tree-Karma -Infinity (no unread items found in its tree).`);
      }
    });
    const totalGroupsBeforeFilter = groupsList.length;
    groupsList = groupsList.filter((g) => g.treeKarma !== -Infinity);
    const hiddenPosts = totalGroupsBeforeFilter - groupsList.length;
    const visiblePostIds = new Set(groupsList.map((g) => g.postId));
    const finalUnreadPostIds = new Set([...unreadPostIds].filter((id) => visiblePostIds.has(id)));
    groupsList.sort((a, b) => {
      const tkA = a.treeKarma;
      const tkB = b.treeKarma;
      if (tkA !== tkB) return tkB - tkA;
      return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
    });
    const sortedGroups = new Map();
    groupsList.forEach((g) => sortedGroups.set(g.postId, g));
    const batchCommentIds = new Set(comments.map((c) => c._id));
    const batchUnreadCount = Array.from(unreadIds).filter((id) => batchCommentIds.has(id)).length;
    const batchContextCount = Array.from(parentIds).filter((id) => batchCommentIds.has(id) && !unreadIds.has(id)).length;
    const batchHiddenCount = comments.length - batchUnreadCount - batchContextCount;
    const stats = {
      totalComments: comments.length,
      unreadComments: batchUnreadCount,
      contextComments: batchContextCount,
      hiddenComments: batchHiddenCount,
      totalPosts: posts.length,
      visiblePosts: groupsList.length,
      hiddenPosts
    };
    return {
      groups: sortedGroups,
      unreadItemCount: unreadIds.size + finalUnreadPostIds.size,
      stats
    };
  };
  const renderHelpSection = (showHelp) => {
    return `
    <details class="pr-help" ${showHelp ? "open" : ""} id="pr-help-section">
      <summary class="pr-help-header">
        <strong>📖 Power Reader Guide</strong>
      </summary>
      <div class="pr-help-content pr-help-columns">
        <div class="pr-help-section">
          <h4>🗳️ Voting & Reactions</h4>
          <ul>
            <li><strong>▲/▼</strong> Karma vote · <strong>✓/✗</strong> Agreement vote</li>
            <li>Select text → inline react to specific parts</li>
          </ul>
        </div>

        <div class="pr-help-section">
          <h4>👤 Authors</h4>
          <ul>
            <li><strong>[↑]/[↓]</strong> Favor/disfavor author</li>
            <li>Hover name for profile preview</li>
          </ul>
        </div>

        <div class="pr-help-section">
          <h4>🎨 Colors</h4>
          <ul>
            <li><strong>Pink</strong> High karma · <strong>Yellow</strong> Recent</li>
            <li><strong>Green border</strong> Reply to you · <strong>Grey</strong> Read</li>
          </ul>
        </div>

        <div class="pr-help-section">
          <h4>📦 Post Buttons (Hover + Key)</h4>
          <ul>
            <li><strong>[e]</strong> Expand/load body · <strong>[a]</strong> Load all comments</li>
            <li><strong>[c]</strong> Scroll to comments · <strong>[n]</strong> Scroll to next post</li>
            <li><strong>[−]/[+]</strong> Collapse/expand post + comments</li>
          </ul>
        </div>

        <div class="pr-help-section">
          <h4>💬 Comment Buttons (Hover + Key)</h4>
          <ul>
            <li><strong>[r]</strong> Load replies · <strong>[t]</strong> Trace to root (load parents)</li>
            <li><strong>[^]</strong> Find parent · <strong>[−]/[+]</strong> Collapse/expand comment</li>
            <li><strong>[↑]/[↓]</strong> Mark author as preferred/disliked</li>
            <li style="font-size: 0.9em; color: #888; margin-top: 4px;"><i>Note: Buttons show disabled with a tooltip when not applicable.</i></li>
          </ul>
        </div>

        <div class="pr-help-section">
          <h4>🔍 Previews & Navigation</h4>
          <ul>
            <li>Hover post titles or comment links for preview</li>
            <li>Click to navigate · Ctrl+click for new tab</li>
          </ul>
        </div>

        <div class="pr-help-section">
          <h4>📖 Read Tracking</h4>
          <ul>
            <li>Scrolled past → marked read (grey) · Refresh shows unread only</li>
            <li>Click timestamp for permalink</li>
          </ul>
        </div>

        <div class="pr-help-section">
          <h4>↔️ Layout · AI: <strong>g</strong> / <strong>⇧G</strong></h4>
          <ul>
            <li><strong>g</strong>: Thread to AI · <strong>⇧G</strong>: + Descendants</li>
            <li>Drag edges to resize · Width saved across sessions</li>
          </ul>
        </div>

        <h4>🤖 AI Studio Settings</h4>
        <div class="pr-settings-group">
          <label for="pr-ai-prefix-input"><strong>AI Studio Prompt Prefix:</strong></label>
          <p style="font-size: 0.8em; color: #888; margin-top: 5px;">This text is sent to AI Studio before the thread content. Leave blank to use the default.</p>
          <textarea id="pr-ai-prefix-input" class="pr-setting-textarea" rows="4" style="width: 100%; margin-top: 10px; font-family: monospace; font-size: 0.9em; padding: 5px; border: 1px solid #ccc; border-radius: 4px;">${getAIStudioPrefix() || AI_STUDIO_PROMPT_PREFIX}</textarea>
          <div style="margin-top: 5px;">
            <button id="pr-save-ai-prefix-btn" class="pr-debug-btn">Save Prefix</button>
            <button id="pr-reset-ai-prefix-btn" class="pr-debug-btn">Reset to Default</button>
          </div>
        </div>

        <h4>🛠 Debug</h4>
        <p>
          <button id="pr-export-state-btn" class="pr-debug-btn">Export State (Clipboard)</button>
          <button id="pr-reset-state-btn" class="pr-debug-btn">Reset State</button>
        </p>
      </div>
    </details>
  `;
  };
  const renderUI = (state2) => {
    const root = document.getElementById("power-reader-root");
    if (!root) return;
    const { groups: postGroups, unreadItemCount, stats } = buildPostGroups(
      state2.comments,
      state2.posts,
      state2
    );
    const helpCollapsed = GM_getValue("helpCollapsed", false);
    const showHelp = !helpCollapsed;
    const loadFrom = getLoadFrom();
    const startDate = loadFrom && loadFrom !== "__LOAD_RECENT__" ? formatStatusDate(loadFrom) : "?";
    const endDate = state2.initialBatchNewestDate ? formatStatusDate(state2.initialBatchNewestDate) : "now";
    const userLabel = state2.currentUsername ? `👤 ${state2.currentUsername}` : "👤 not logged in";
    let html = `
    <div class="pr-header">
      <h1>Less Wrong: Power Reader <small style="font-size: 0.6em; color: #888;">v${"1.2.538"}</small></h1>
      <div class="pr-status">
        📆 ${startDate} → ${endDate}
        · 🔴 <span id="pr-unread-count">${unreadItemCount}</span> unread
        · 💬 ${stats.totalComments} comments (${stats.unreadComments} new · ${stats.contextComments} context · ${stats.hiddenComments} hidden)
        · 📄 ${stats.visiblePosts} posts${stats.hiddenPosts > 0 ? ` (${stats.hiddenPosts} filtered)` : ""}
        · ${userLabel}
      </div>
    </div>
    ${renderHelpSection(showHelp)}
  `;
    if (state2.moreCommentsAvailable) {
      html += `
      <div class="pr-warning">
        There are more comments available. Please reload after reading current comments to continue.
      </div>
    `;
    }
    if (postGroups.size === 0) {
      html += `
      <div class="pr-info">
        No content found. 
        <div style="margin-top: 10px;">
          <button id="pr-check-now-btn" class="pr-btn">Check Server Again</button>
          <button id="pr-change-date-btn" class="pr-btn">Change Starting Date</button>
        </div>
        <p style="font-size: 0.8em; margin-top: 15px;">
          Alternatively, you can <a href="/reader/reset">Reset all storage</a> to start fresh.
        </p>
      </div>
    `;
    }
    postGroups.forEach((group) => {
      html += renderPostGroup(group, state2);
    });
    html += `
    <div class="pr-footer-space" style="height: 100px; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 20px;">
      <div id="pr-bottom-message" class="pr-bottom-message" style="display: none;"></div>
    </div>
  `;
    root.innerHTML = html;
    if (!document.querySelector(".pr-sticky-ai-status")) {
      const stickyStatus = document.createElement("div");
      stickyStatus.className = "pr-sticky-ai-status";
      stickyStatus.id = "pr-sticky-ai-status";
      document.body.appendChild(stickyStatus);
    }
    if (!document.querySelector(".pr-resize-handle")) {
      initResizeHandles();
    }
    initPreviewSystem();
    setupHelpToggle();
    setupDebugButtons();
    setupAISettings();
    setupScrollTracking(() => state2.comments, () => state2.posts, () => state2.initialBatchNewestDate);
    setupLinkPreviews(state2.comments);
    window.setupLinkPreviews = setupLinkPreviews;
    window.renderUI = renderUI;
    setupStickyHeader();
    const sticky = getStickyHeader();
    if (sticky) sticky.refresh();
    setupInlineReactions(state2);
    setupExternalLinks();
    refreshPostActionButtons();
    window.getState = () => state2;
    window.manualPreview = manualPreview;
    Logger.info("UI Rendered");
  };
  const setupHelpToggle = () => {
    const helpSection = document.getElementById("pr-help-section");
    const helpSummary = helpSection?.querySelector("summary");
    if (helpSection && helpSummary) {
      helpSummary.addEventListener("click", () => {
        const willBeOpen = !helpSection.open;
        Logger.debug(`Help will be open: ${willBeOpen}`);
        GM_setValue("helpCollapsed", !willBeOpen);
      });
    }
  };
  const setupDebugButtons = () => {
    const exportBtn = document.getElementById("pr-export-state-btn");
    if (exportBtn) {
      exportBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        exportState();
      });
    }
    const resetBtn = document.getElementById("pr-reset-state-btn");
    if (resetBtn) {
      resetBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm("Are you sure you want to reset all state (read status, author preferences)? This will reload the page.")) {
          clearAllStorage();
          window.location.href = "/reader";
        }
      });
    }
    const checkBtn = document.getElementById("pr-check-now-btn");
    if (checkBtn) {
      checkBtn.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.reload();
      });
    }
    const changeBtn = document.getElementById("pr-change-date-btn");
    if (changeBtn) {
      changeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        GM_setValue("power-reader-read-from", null);
        window.location.reload();
      });
    }
  };
  const setupAISettings = () => {
    const saveBtn = document.getElementById("pr-save-ai-prefix-btn");
    const resetBtn = document.getElementById("pr-reset-ai-prefix-btn");
    const input = document.getElementById("pr-ai-prefix-input");
    if (saveBtn && input) {
      saveBtn.addEventListener("click", (e) => {
        e.preventDefault();
        const val = input.value.trim();
        setAIStudioPrefix(val);
        alert("AI Studio prompt prefix saved!");
      });
    }
    if (resetBtn && input) {
      resetBtn.addEventListener("click", (e) => {
        e.preventDefault();
        if (confirm("Reset to default prompt?")) {
          setAIStudioPrefix("");
          input.value = AI_STUDIO_PROMPT_PREFIX;
          alert("Reset to default!");
        }
      });
    }
  };
  const showSetupUI = (onStart) => {
    const root = document.getElementById("power-reader-root");
    if (!root) return;
    root.innerHTML = `
    <div class="pr-header">
      <h1>Welcome to Power Reader! <small style="font-size: 0.6em; color: #888;">v${"1.2.538"}</small></h1>
    </div>
    <div class="pr-setup">
      <p>Select a starting date to load comments from, or leave blank to load the most recent ${CONFIG.loadMax} comments.</p>
      <div class="pr-setup-form">
        <label for="loadFromDate">Load comments after:</label>
        <input type="date" id="loadFromDate" />
      </div>
      <button id="startReading" class="pr-btn">Start Reading</button>
    </div>
  `;
    const startBtn = document.getElementById("startReading");
    const dateInput = document.getElementById("loadFromDate");
    startBtn?.addEventListener("click", async () => {
      const dateValue = dateInput?.value;
      if (dateValue) {
        const date = new Date(dateValue + "T00:00:00");
        await onStart(date.toISOString());
      } else {
        await onStart(null);
      }
    });
  };
  const ACTION_TO_VOTE = {
    "karma-up": { kind: "karma", dir: "up" },
    "karma-down": { kind: "karma", dir: "down" },
    "agree": { kind: "agreement", dir: "up" },
    "disagree": { kind: "agreement", dir: "down" }
  };
  const handleVoteInteraction = (target, action, state2) => {
    const config = ACTION_TO_VOTE[action];
    if (!config) return;
    const commentId = target.dataset.commentId;
    if (!commentId) return;
    const comment = state2.commentById.get(commentId);
    if (!comment) return;
    const currentVote = config.kind === "karma" ? comment.currentUserVote || "neutral" : comment.currentUserExtendedVote?.agreement || "neutral";
    const direction = config.kind === "karma" ? config.dir : config.dir === "up" ? "agree" : "disagree";
    const currentVoteStr = String(currentVote ?? "neutral");
    const clickTargetState = calculateNextVoteState(currentVoteStr, direction, false);
    const holdTargetState = calculateNextVoteState(currentVoteStr, direction, true);
    applyOptimisticVoteUI(target, currentVoteStr, config.dir);
    let committed = false;
    const cleanup = () => {
      target.removeEventListener("mouseup", mouseUpHandler);
      target.removeEventListener("mouseleave", mouseLeaveHandler);
    };
    const timer = window.setTimeout(async () => {
      committed = true;
      cleanup();
      if (holdTargetState.startsWith("big")) {
        target.classList.add("strong-vote");
      } else if (holdTargetState === "neutral") {
        clearVoteClasses(target);
      }
      const res = await executeVote(commentId, holdTargetState, config.kind, state2, comment);
      if (res) {
        updateVoteUI(commentId, res);
        syncVoteToState(state2, commentId, res);
      }
    }, 500);
    const mouseUpHandler = async () => {
      if (committed) return;
      clearTimeout(timer);
      cleanup();
      clearVoteClasses(target);
      const res = await executeVote(commentId, clickTargetState, config.kind, state2, comment);
      if (res) {
        updateVoteUI(commentId, res);
        syncVoteToState(state2, commentId, res);
      }
    };
    const mouseLeaveHandler = () => {
      if (committed) return;
      clearTimeout(timer);
      cleanup();
      clearVoteClasses(target);
    };
    target.addEventListener("mouseup", mouseUpHandler);
    target.addEventListener("mouseleave", mouseLeaveHandler);
  };
  const applyOptimisticVoteUI = (target, currentVote, dir) => {
    if (currentVote?.startsWith("big")) {
      target.classList.remove("strong-vote");
    } else {
      if (dir === "up") {
        target.classList.add("active-up");
        target.classList.add("agree-active");
      } else {
        target.classList.add("active-down");
        target.classList.add("disagree-active");
      }
    }
  };
  const clearVoteClasses = (target) => {
    target.classList.remove("active-up", "active-down", "agree-active", "disagree-active", "strong-vote");
  };
  const executeVote = async (commentId, targetState, kind, state2, comment) => {
    const isLoggedIn = !!state2.currentUserId;
    if (kind === "karma") {
      return castKarmaVote(
        commentId,
        targetState,
        isLoggedIn,
        comment.currentUserExtendedVote
      );
    } else {
      return castAgreementVote(
        commentId,
        targetState,
        isLoggedIn,
        comment.currentUserVote
      );
    }
  };
  const syncVoteToState = (state2, commentId, response) => {
    const comment = state2.commentById.get(commentId);
    if (comment && response.performVoteComment?.document) {
      const doc = response.performVoteComment.document;
      syncCommentInState(state2, commentId, {
        baseScore: doc.baseScore ?? 0,
        voteCount: doc.voteCount ?? 0,
        currentUserVote: doc.currentUserVote,
        extendedScore: doc.extendedScore,
        afExtendedScore: doc.afExtendedScore,
        currentUserExtendedVote: doc.currentUserExtendedVote
      });
      updateVoteUI(commentId, response);
      refreshReactions(commentId, state2);
      refreshCommentBody(commentId, state2);
    }
  };
  const refreshCommentBody = (commentId, state2) => {
    const comment = state2.commentById.get(commentId);
    if (!comment) return;
    const el = document.querySelector(`.pr-comment[data-id="${commentId}"]`);
    if (!el) return;
    const bodyEl = el.querySelector(".pr-comment-body");
    if (bodyEl && comment.htmlBody) {
      bodyEl.innerHTML = highlightQuotes(
        comment.htmlBody,
        comment.extendedScore
      );
    }
  };
  const refreshReactions = (commentId, state2) => {
    const comment = state2.commentById.get(commentId);
    if (!comment) return;
    const el = document.querySelector(`.pr-comment[data-id="${commentId}"]`);
    if (!el) return;
    const container = el.querySelector(".pr-reactions-container");
    if (container) {
      container.innerHTML = renderReactions(
        comment._id,
        comment.extendedScore,
        comment.currentUserExtendedVote
      );
    }
  };
  class ReactionPicker {
    commentsGetter;
    currentUserPaletteStyle;
    currentSelection = null;
    activeTriggerButton = null;
    syncCallback;
    currentUserId;
currentCommentId = null;
    currentSearch = "";
    viewMode = "grid";
    tooltipElement = null;
    constructor(commentsGetter, paletteStyle, syncCallback, currentUserId) {
      this.commentsGetter = commentsGetter;
      this.currentUserPaletteStyle = paletteStyle;
      this.syncCallback = syncCallback;
      this.currentUserId = currentUserId;
    }
    setSelection(selection) {
      this.currentSelection = selection;
    }
    open(button, initialSearchText = "") {
      const commentId = button.dataset.commentId;
      if (!commentId) return;
      const existing = document.getElementById("pr-global-reaction-picker");
      if (existing && this.activeTriggerButton === button) {
        existing.remove();
        this.activeTriggerButton = null;
        return;
      }
      if (existing) existing.remove();
      this.activeTriggerButton = button;
      this.currentCommentId = commentId;
      this.currentSearch = initialSearchText;
      this.viewMode = GM_getValue("pickerViewMode", this.currentUserPaletteStyle || "grid");
      const picker = document.createElement("div");
      picker.id = "pr-global-reaction-picker";
      picker.className = "pr-reaction-picker";
      const root = document.getElementById("power-reader-root");
      if (root) {
        root.appendChild(picker);
      } else {
        document.body.appendChild(picker);
      }
      this._render();
      this._setupPickerInteractions(picker, button);
    }
    escapeHtml(unsafe) {
      return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
    _render() {
      const picker = document.getElementById("pr-global-reaction-picker");
      if (!picker || !this.currentCommentId) return;
      const comment = this.commentsGetter().find((c) => c._id === this.currentCommentId);
      const userVotes = comment?.currentUserExtendedVote?.reacts || [];
      const allReactions = getReactions();
      const getReactionsFromList = (names) => {
        if (!names) return [];
        return names.map((name) => allReactions.find((r) => r.name === name)).filter((r) => r && !r.deprecated);
      };
      const renderSectionTitle = (title) => `<div class="pr-picker-section-title">${title}</div>`;
      const renderPickerItem = (reaction, mode) => {
        const voted = userVotes.some((v) => v.react === reaction.name);
        const filter = reaction.filter || DEFAULT_FILTER;
        const imgStyle = `
          filter: opacity(${filter.opacity ?? 1}) saturate(${filter.saturate ?? 1});
          transform: scale(${filter.scale ?? 1}) translate(${filter.translateX ?? 0}px, ${filter.translateY ?? 0}px);
      `;
        const labelAttr = `data-tooltip-label="${this.escapeHtml(reaction.label)}"`;
        const descAttr = `data-tooltip-description="${this.escapeHtml(reaction.description || "")}"`;
        if (mode === "list") {
          return `
            <div class="pr-reaction-list-item ${voted ? "active" : ""}" 
                 data-action="reaction-vote" 
                 data-comment-id="${this.currentCommentId}" 
                 data-reaction-name="${reaction.name}"
                 ${labelAttr} ${descAttr}>
              <img src="${reaction.svg}" alt="${reaction.name}" style="${imgStyle}">
              <span class="${reaction.name === "addc" ? "small" : ""}">${this.escapeHtml(reaction.label).replace(/\\n/g, "<br/>")}</span>
            </div>
          `;
        }
        return `
        <div class="pr-reaction-picker-item ${voted ? "active" : ""}" 
             data-action="reaction-vote" 
             data-comment-id="${this.currentCommentId}" 
             data-reaction-name="${reaction.name}"
             ${labelAttr} ${descAttr}>
          <img src="${reaction.svg}" alt="${reaction.name}" style="${imgStyle}">
        </div>
      `;
      };
      const normalizedSearch = this.currentSearch.toLowerCase();
      const filtered = allReactions.filter((r) => {
        if (!this.currentSearch) return !r.deprecated;
        return r.name.toLowerCase().includes(normalizedSearch) || r.label.toLowerCase().includes(normalizedSearch) || r.searchTerms?.some((t) => t.toLowerCase().includes(normalizedSearch));
      });
      const renderGridSection = (list) => {
        if (!list) return "";
        return getReactionsFromList(list).map((r) => renderPickerItem(r, "grid")).join("");
      };
      const header = `
            <div class="pr-picker-search">
               <span class="pr-picker-view-toggle" title="Switch View">${this.viewMode === "list" ? "▦" : "≣"}</span>
               <input type="text" placeholder="Search reactions..." value="${this.escapeHtml(this.currentSearch)}" id="pr-reaction-search-input">
            </div>
        `;
      let body = "";
      if (this.currentSearch) {
        body += `<div class="pr-reaction-picker-grid">`;
        filtered.forEach((r) => body += renderPickerItem(r, "grid"));
        body += `</div>`;
        if (filtered.length === 0) {
          body += `<div style="padding:10px; text-align:center; color:#888">No matching reactions</div>`;
        }
      } else {
        if (this.viewMode === "list") {
          body += `<div class="pr-reaction-picker-grid">`;
          body += renderGridSection(SECTION_DEFINITIONS.listPrimary);
          body += `</div>`;
          const sections = [
            { title: "Analysis & Agreement", list: SECTION_DEFINITIONS.listViewSectionB },
            { title: "Feedback & Meta", list: SECTION_DEFINITIONS.listViewSectionC }
          ];
          sections.forEach((s) => {
            if (s.list && s.list.length > 0) {
              body += renderSectionTitle(s.title);
              body += `<div class="pr-reaction-picker-list">`;
              body += getReactionsFromList(s.list).map((r) => renderPickerItem(r, "list")).join("");
              body += `</div>`;
            }
          });
          body += renderSectionTitle("Likelihoods");
          body += `<div class="pr-reaction-picker-grid">`;
          body += renderGridSection(SECTION_DEFINITIONS.likelihoods);
          body += `</div>`;
        } else {
          body += `<div class="pr-reaction-picker-grid">`;
          body += renderGridSection(SECTION_DEFINITIONS.gridPrimary);
          if (SECTION_DEFINITIONS.gridSectionB) {
            body += `<div class="pr-picker-grid-separator"></div>`;
            body += renderGridSection(SECTION_DEFINITIONS.gridSectionB);
          }
          if (SECTION_DEFINITIONS.gridSectionC) {
            body += `<div class="pr-picker-grid-separator"></div>`;
            body += renderGridSection(SECTION_DEFINITIONS.gridSectionC);
          }
          body += `<div class="pr-picker-grid-separator"></div>`;
          body += renderGridSection(SECTION_DEFINITIONS.likelihoods);
          body += `</div>`;
        }
      }
      const oldContainer = picker.querySelector(".pr-picker-scroll-container");
      const scrollPos = oldContainer ? oldContainer.scrollTop : 0;
      const searchInput = picker.querySelector("input");
      const selStart = searchInput?.selectionStart;
      const selEnd = searchInput?.selectionEnd;
      picker.innerHTML = `
            <div class="pr-picker-header">${header}</div>
            <div class="pr-picker-scroll-container">${body}</div>
        `;
      const newContainer = picker.querySelector(".pr-picker-scroll-container");
      if (newContainer) newContainer.scrollTop = scrollPos;
      const newInput = picker.querySelector("input");
      if (newInput) {
        newInput.focus();
        newInput.addEventListener("input", (e) => {
          this.currentSearch = e.target.value;
          this._render();
        });
        if (typeof selStart === "number") newInput.setSelectionRange(selStart, selEnd || selStart);
      }
      const toggle = picker.querySelector(".pr-picker-view-toggle");
      if (toggle) {
        toggle.addEventListener("click", (e) => {
          e.stopPropagation();
          this.viewMode = this.viewMode === "list" ? "grid" : "list";
          GM_setValue("pickerViewMode", this.viewMode);
          this._render();
        });
      }
    }
    _setupPickerInteractions(picker, button) {
      picker.addEventListener("mouseover", (e) => {
        const target = e.target.closest("[data-tooltip-label]");
        if (target) {
          this._showTooltip(target);
        }
      });
      picker.addEventListener("mouseout", (e) => {
        const target = e.target.closest("[data-tooltip-label]");
        if (target) {
          this._hideTooltip();
        }
      });
      picker.addEventListener("click", (e) => {
        e.stopPropagation();
        const target = e.target.closest('[data-action="reaction-vote"]');
        if (target) {
          const commentId = target.dataset.commentId;
          const reactionName = target.dataset.reactionName;
          if (commentId && reactionName) {
            Logger.info(`Picker: Clicked reaction ${reactionName} on comment ${commentId}`);
            this.handleReactionVote(commentId, reactionName);
          }
        }
      });
      picker.addEventListener("mousedown", (e) => e.stopPropagation());
      const rect = button.getBoundingClientRect();
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;
      picker.style.visibility = "hidden";
      picker.style.display = "flex";
      const pickerHeight = picker.offsetHeight;
      const pickerWidth = picker.offsetWidth;
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const margin = 10;
      const buttonTopDoc = rect.top + scrollY;
      const buttonBottomDoc = rect.bottom + scrollY;
      const buttonLeftDoc = rect.left + scrollX;
      const buttonRightDoc = rect.right + scrollX;
      let top = buttonBottomDoc + 5;
      let left = buttonLeftDoc;
      const pickerBottomViewport = rect.bottom + 5 + pickerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      if (pickerBottomViewport > viewportHeight - margin && spaceAbove > spaceBelow) {
        top = buttonTopDoc - pickerHeight - 5;
      }
      const minTop = scrollY + margin;
      const maxTop = scrollY + viewportHeight - pickerHeight - margin;
      top = Math.max(minTop, Math.min(top, maxTop));
      const pickerBottom = top + pickerHeight;
      const overlapsVertically = !(pickerBottom <= buttonTopDoc || top >= buttonBottomDoc);
      if (overlapsVertically) {
        const spaceOnRight = viewportWidth - rect.right;
        if (spaceOnRight >= pickerWidth + margin) {
          left = buttonRightDoc + 5;
        } else {
          const spaceOnLeft = rect.left;
          if (spaceOnLeft >= pickerWidth + margin) {
            left = buttonLeftDoc - pickerWidth - 5;
          }
        }
      }
      const pickerRightViewport = left - scrollX + pickerWidth;
      if (pickerRightViewport > viewportWidth - margin) {
        left = scrollX + viewportWidth - pickerWidth - margin;
      }
      left = Math.max(scrollX + margin, left);
      picker.style.top = `${top}px`;
      picker.style.left = `${left}px`;
      picker.style.visibility = "visible";
      picker.classList.add("visible");
      const input = picker.querySelector("input");
      if (input) input.focus();
      const closeHandler = (e) => {
        if (!button.contains(e.target)) {
          picker?.classList.remove("visible");
          if (picker) {
            picker.style.display = "none";
            picker.style.visibility = "hidden";
          }
          this._hideTooltip();
          document.removeEventListener("mousedown", closeHandler);
          this.currentSelection = null;
          this.activeTriggerButton = null;
          this.currentCommentId = null;
        }
      };
      setTimeout(() => {
        document.addEventListener("mousedown", closeHandler);
      }, 50);
    }
    _showTooltip(target) {
      if (!this.tooltipElement) {
        this.tooltipElement = document.createElement("div");
        this.tooltipElement.className = "pr-tooltip-global";
        document.body.appendChild(this.tooltipElement);
      }
      const label = target.dataset.tooltipLabel || "";
      const description = target.dataset.tooltipDescription || "";
      const cleanLabel = this.escapeHtml(label).replace(/\\n/g, "<br/>");
      const cleanDescription = this.escapeHtml(description).replace(/\\n/g, "<br/>");
      this.tooltipElement.innerHTML = `
            <strong>${cleanLabel}</strong>
            ${cleanDescription}
        `;
      this.tooltipElement.style.visibility = "hidden";
      this.tooltipElement.style.display = "block";
      this.tooltipElement.style.opacity = "0";
      const rect = target.getBoundingClientRect();
      const tooltipHeight = this.tooltipElement.offsetHeight;
      const tooltipWidth = this.tooltipElement.offsetWidth;
      let top = rect.top - tooltipHeight - 8;
      let left = rect.left + rect.width / 2 - tooltipWidth / 2;
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
      this.tooltipElement.style.top = `${top}px`;
      this.tooltipElement.style.left = `${left}px`;
      this.tooltipElement.style.visibility = "visible";
      this.tooltipElement.style.opacity = "1";
    }
    _hideTooltip() {
      if (this.tooltipElement) {
        this.tooltipElement.style.visibility = "hidden";
        this.tooltipElement.style.opacity = "0";
      }
    }
    async handleReactionVote(commentId, reactionName) {
      Logger.info(`Handling reaction vote: ${reactionName} for ${commentId}`);
      const comment = this.commentsGetter().find((c) => c._id === commentId);
      if (!comment) return;
      let quote = null;
      if (this.currentSelection && this.currentSelection.range.commonAncestorContainer.parentElement?.closest(`[data-id="${commentId}"]`)) {
        quote = this.currentSelection.text;
      }
      const res = await castReactionVote(
        commentId,
        reactionName,
        !!this.currentUserId,
        comment.currentUserVote,
        comment.currentUserExtendedVote,
        quote
      );
      if (res) {
        updateVoteUI(commentId, res);
        this.syncCallback(commentId, res);
        window.getSelection()?.removeAllRanges();
        this.currentSelection = null;
        document.getElementById("pr-inline-react-btn")?.remove();
        this._render();
      }
    }
  }
  let reactionPicker = null;
  const initReactionPicker = (state2) => {
    reactionPicker = new ReactionPicker(
      () => state2.comments,
      state2.currentUserPaletteStyle,
      (commentId, response) => syncVoteToState(state2, commentId, response),
      state2.currentUserId
    );
  };
  const openReactionPicker = (button, state2, initialSearchText = "") => {
    if (!reactionPicker) initReactionPicker(state2);
    reactionPicker?.setSelection(state2.currentSelection);
    reactionPicker?.open(button, initialSearchText);
  };
  const handleReactionVote = async (commentId, reactionName, state2) => {
    Logger.info(`Handling reaction vote: ${reactionName} for ${commentId}`);
    const comment = state2.commentById.get(commentId);
    if (!comment) return;
    let quote = null;
    if (state2.currentSelection) {
      const container = state2.currentSelection.range.commonAncestorContainer;
      const parentEl = container.nodeType === 3 ? container.parentElement : container;
      if (parentEl?.closest(`[data-id="${commentId}"]`)) {
        quote = state2.currentSelection.text;
      }
    }
    const res = await castReactionVote(
      commentId,
      reactionName,
      !!state2.currentUserId,
      comment.currentUserVote,
      comment.currentUserExtendedVote,
      quote
    );
    if (res) {
      updateVoteUI(commentId, res);
      syncVoteToState(state2, commentId, res);
      window.getSelection()?.removeAllRanges();
      state2.currentSelection = null;
      document.getElementById("pr-inline-react-btn")?.remove();
      const picker = document.getElementById("pr-global-reaction-picker");
      if (picker) {
        picker.classList.remove("visible");
        setTimeout(() => picker.remove(), 300);
      }
    }
  };
  const attachHotkeyListeners = (state2) => {
    document.addEventListener("keydown", (e) => {
      const target = e.target;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }
      const key = e.key.toLowerCase();
      const actionMap = {
        "a": "load-all-comments",
        "c": "scroll-to-comments",
        "n": "scroll-to-next-post",
        "r": "load-descendants",
        "t": "load-parents-and-scroll",
        "^": "find-parent",
        "-": "collapse",
        "+": "expand",
        "=": "expand",
"e": "toggle-post-body",
        "g": "send-to-ai-studio"
      };
      const action = actionMap[key];
      if (!action) return;
      const elementUnderMouse = document.elementFromPoint(state2.lastMousePos.x, state2.lastMousePos.y);
      if (!elementUnderMouse) return;
      const prItem = elementUnderMouse.closest(".pr-item");
      if (!prItem) return;
      let button = prItem.querySelector(`[data-action="${action}"]`);
      if (!button && prItem.classList.contains("pr-comment")) {
        const postId = prItem.dataset.postId;
        if (postId) {
          const postEl = document.querySelector(`.pr-post[data-id="${postId}"]`);
          if (postEl) {
            button = postEl.querySelector(`[data-action="${action}"]`);
          }
        }
      }
      if (button) {
        if (button.classList.contains("disabled")) {
          Logger.debug(`Hotkey '${key}' triggered action '${action}' but button is disabled`);
          return;
        }
        Logger.info(`Hotkey '${key}' triggering action '${action}' on item ${prItem.dataset.id}`);
        e.preventDefault();
        e.stopPropagation();
        button.dispatchEvent(new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
          shiftKey: e.shiftKey
        }));
        button.dispatchEvent(new MouseEvent("mouseup", {
          bubbles: true,
          cancelable: true,
          shiftKey: e.shiftKey
        }));
        button.dispatchEvent(new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          shiftKey: e.shiftKey
        }));
      }
    });
  };
  const collapsePost = (post) => {
    post.querySelector(".pr-post-comments")?.classList.add("collapsed");
    post.querySelector(".pr-post-content")?.classList.add("collapsed");
    syncPostToggleButtons(post, true);
  };
  const expandPost = (post) => {
    post.querySelector(".pr-post-comments")?.classList.remove("collapsed");
    post.querySelector(".pr-post-content")?.classList.remove("collapsed");
    syncPostToggleButtons(post, false);
  };
  const syncPostToggleButtons = (post, isCollapsed) => {
    const postEl = post;
    const postId = postEl.getAttribute("data-post-id") || postEl.getAttribute("data-id");
    const headers = [];
    const mainHeader = postEl.querySelector(".pr-post-header");
    if (mainHeader) headers.push(mainHeader);
    if (postId) {
      const stickyHeader2 = document.querySelector(`.pr-sticky-header .pr-post-header[data-post-id="${postId}"]`);
      if (stickyHeader2) headers.push(stickyHeader2);
    }
    headers.forEach((header) => {
      const collapseBtn = header.querySelector('[data-action="collapse"]');
      const expandBtn = header.querySelector('[data-action="expand"]');
      if (collapseBtn) collapseBtn.style.display = isCollapsed ? "none" : "inline";
      if (expandBtn) expandBtn.style.display = isCollapsed ? "inline" : "none";
    });
  };
  const handlePostCollapse = (target, _state) => {
    const postId = getPostIdFromTarget(target);
    if (!postId) return;
    const post = document.querySelector(`.pr-post[data-id="${postId}"]`);
    if (!post) return;
    const isFromSticky = !!target.closest(".pr-sticky-header");
    let headerTop = null;
    if (isFromSticky) {
      const postHeader = post.querySelector(".pr-post-header");
      if (postHeader) {
        headerTop = postHeader.getBoundingClientRect().top + window.pageYOffset;
      }
    }
    collapsePost(post);
    if (headerTop !== null) {
      window.scrollTo({
        top: headerTop,
        behavior: window.__PR_TEST_MODE__ ? "instant" : "smooth"
      });
    }
  };
  const handlePostExpand = (target, _state) => {
    const postId = getPostIdFromTarget(target);
    if (!postId) return;
    const post = document.querySelector(`.pr-post[data-id="${postId}"]`);
    if (!post) return;
    const isFromSticky = !!target.closest(".pr-sticky-header");
    expandPost(post);
    if (isFromSticky) {
      const postHeader = post.querySelector(".pr-post-header");
      if (postHeader) {
        const headerTop = postHeader.getBoundingClientRect().top + window.pageYOffset;
        window.scrollTo({
          top: headerTop,
          behavior: window.__PR_TEST_MODE__ ? "instant" : "smooth"
        });
      }
    }
  };
  const handleCommentCollapse = (target) => {
    const comment = target.closest(".pr-comment");
    comment?.classList.add("collapsed");
  };
  const handleCommentExpand = (target) => {
    const comment = target.closest(".pr-comment");
    comment?.classList.remove("collapsed");
  };
  const handleExpandPlaceholder = (target, state2) => {
    const commentEl = target.closest(".pr-comment");
    if (!commentEl) return;
    const commentId = commentEl.getAttribute("data-id");
    const postId = commentEl.getAttribute("data-post-id");
    if (!commentId || !postId) return;
    const comment = state2.commentById.get(commentId);
    if (!comment) return;
    comment.forceVisible = true;
    comment.justRevealed = true;
    reRenderPostGroup(postId, state2, commentId);
    setTimeout(() => {
      if (comment) comment.justRevealed = false;
    }, 2e3);
  };
  const handleCommentCollapseToggle = (replies) => {
    const comment = replies.closest(".pr-comment");
    if (comment) {
      if (comment.classList.contains("collapsed")) {
        comment.classList.remove("collapsed");
      } else {
        comment.classList.add("collapsed");
      }
    }
  };
  const handleFindParent = async (target, state2) => {
    const commentEl = target.closest(".pr-comment");
    const parentId = commentEl?.getAttribute("data-parent-id");
    if (!parentId) {
      const postId = commentEl?.getAttribute("data-post-id");
      if (!postId) return;
      const postEl = document.querySelector(`.pr-post[data-id="${postId}"]`);
      if (postEl) {
        const postHeader = postEl.querySelector(".pr-post-header");
        const postBody = postEl.querySelector(".pr-post-body-container");
        const stickyHeader2 = document.querySelector(`.pr-sticky-header .pr-post-header[data-post-id="${postId}"]`);
        if (postHeader) smartScrollTo(postHeader, true);
        const targets = [postHeader, postBody, stickyHeader2].filter(Boolean);
        targets.forEach((t) => t.classList.add("pr-highlight-parent"));
        setTimeout(() => targets.forEach((t) => t.classList.remove("pr-highlight-parent")), 2e3);
      }
      return;
    }
    const parentEl = document.querySelector(`.pr-comment[data-id="${parentId}"]`);
    const isReadPlaceholder = parentEl?.classList.contains("pr-comment-placeholder");
    const parentIsPlaceholder = !!parentEl?.dataset.placeholder || parentEl?.classList.contains("pr-missing-parent") || isReadPlaceholder;
    if (parentEl && !parentIsPlaceholder) {
      smartScrollTo(parentEl, false);
      parentEl.classList.add("pr-highlight-parent");
      setTimeout(() => parentEl.classList.remove("pr-highlight-parent"), 2e3);
    } else if (parentEl && isReadPlaceholder) {
      const postId = commentEl?.getAttribute("data-post-id");
      const comment = state2.commentById.get(parentId);
      if (comment && postId) {
        markAncestorChainForceVisible(parentId, state2);
        reRenderPostGroup(postId, state2, parentId);
        const newParentEl = document.querySelector(`.pr-comment[data-id="${parentId}"]`);
        if (newParentEl) {
          smartScrollTo(newParentEl, false);
          newParentEl.classList.add("pr-highlight-parent");
          setTimeout(() => newParentEl.classList.remove("pr-highlight-parent"), 2e3);
        }
      }
    } else {
      const originalText = target.textContent;
      target.textContent = "[...]";
      try {
        Logger.info(`Find Parent: Fetching missing parent ${parentId} from server...`);
        const res = await queryGraphQL(GET_COMMENT, { id: parentId });
        const parentComment = res?.comment?.result;
        if (parentComment) {
          if (!state2.commentById.has(parentComment._id)) {
            parentComment.isContext = true;
            parentComment.forceVisible = true;
            parentComment.justRevealed = true;
            state2.comments.push(parentComment);
            rebuildIndexes(state2);
            const postId = parentComment.postId;
            if (postId) {
              const postContainer = document.querySelector(`.pr-post[data-id="${postId}"]`);
              if (postContainer) {
                Logger.info(`Re-rendering post group ${postId}. Parent ${parentComment._id} present in state? ${state2.commentById.has(parentComment._id)}`);
                const group = {
                  postId,
                  title: parentComment.post?.title || "Unknown Post",
                  comments: state2.comments.filter((c) => c.postId === postId),
                  fullPost: state2.postById.get(postId)
                };
                postContainer.outerHTML = renderPostGroup(group, state2);
                setupLinkPreviews(state2.comments);
                setTimeout(() => {
                  const newParentEl = document.querySelector(`.pr-comment[data-id="${parentId}"]`);
                  if (newParentEl) {
                    smartScrollTo(newParentEl, false);
                    newParentEl.classList.add("pr-highlight-parent");
                    setTimeout(() => newParentEl.classList.remove("pr-highlight-parent"), 2e3);
                  }
                }, 50);
              } else {
                renderUI(state2);
              }
            }
          }
        } else {
          alert("Parent comment could not be found on the server.");
        }
      } catch (err) {
        Logger.error("Failed to fetch parent comment", err);
        alert("Error fetching parent comment.");
      } finally {
        target.textContent = originalText;
      }
    }
  };
  const handleAuthorUp = (target, state2) => {
    const item = target.closest(".pr-item");
    let author = item?.getAttribute("data-author");
    if (!author) {
      const sticky = target.closest(".pr-sticky-header");
      author = sticky?.getAttribute("data-author");
    }
    if (author) {
      toggleAuthorPreference(author, "up");
      renderUI(state2);
    }
  };
  const handleAuthorDown = (target, state2) => {
    const item = target.closest(".pr-item");
    let author = item?.getAttribute("data-author");
    if (!author) {
      const sticky = target.closest(".pr-sticky-header");
      author = sticky?.getAttribute("data-author");
    }
    if (author) {
      toggleAuthorPreference(author, "down");
      renderUI(state2);
    }
  };
  const handleReadMore = (target) => {
    const container = target.closest(".pr-post-body-container");
    if (container) {
      container.classList.remove("truncated");
      container.style.maxHeight = "none";
      const overlay = container.querySelector(".pr-read-more-overlay");
      if (overlay) overlay.style.display = "none";
    }
  };
  const reRenderPostGroup = (postId, state2, anchorCommentId) => {
    const postContainer = document.querySelector(`.pr-post[data-id="${postId}"]`);
    if (!postContainer) {
      Logger.warn(`reRenderPostGroup: Container for post ${postId} not found`);
      return;
    }
    let beforeTop = null;
    if (anchorCommentId) {
      const anchorEl = postContainer.querySelector(`.pr-comment[data-id="${anchorCommentId}"]`);
      if (anchorEl) beforeTop = anchorEl.getBoundingClientRect().top;
    }
    const post = state2.postById.get(postId);
    const postComments = state2.comments.filter((c) => c.postId === postId);
    Logger.info(`reRenderPostGroup: p=${postId}, comments=${postComments.length}`);
    const group = {
      postId,
      title: post?.title || postComments.find((c) => c.post?.title)?.post?.title || "Unknown Post",
      comments: postComments,
      fullPost: post
    };
    postContainer.outerHTML = renderPostGroup(group, state2);
    setupLinkPreviews(state2.comments);
    refreshPostActionButtons(postId);
    if (anchorCommentId && beforeTop !== null) {
      const newAnchor = document.querySelector(`.pr-comment[data-id="${anchorCommentId}"]`);
      if (newAnchor) {
        const afterTop = newAnchor.getBoundingClientRect().top;
        const delta = afterTop - beforeTop;
        const oldScrollY = window.scrollY;
        Logger.info(`Viewport Preservation [${anchorCommentId}]: beforeTop=${beforeTop.toFixed(2)}, afterTop=${afterTop.toFixed(2)}, delta=${delta.toFixed(2)}, oldScrollY=${oldScrollY.toFixed(2)}`);
        window.scrollTo(0, Math.max(0, oldScrollY + delta));
        Logger.info(`New ScrollY: ${window.scrollY.toFixed(2)}`);
      }
    }
  };
  const mergeComments = (newComments, state2, markAsContext = true) => {
    let added = 0;
    for (const c of newComments) {
      if (!state2.commentById.has(c._id)) {
        if (markAsContext) c.isContext = true;
        state2.comments.push(c);
        added++;
      }
    }
    if (added > 0) rebuildIndexes(state2);
    return added;
  };
  const getPostIdFromTarget = (target) => {
    const post = target.closest(".pr-post");
    if (post) return post.dataset.postId || null;
    const header = target.closest(".pr-post-header");
    return header?.getAttribute("data-post-id") || null;
  };
  const getCommentIdFromTarget = (target) => {
    const comment = target.closest(".pr-comment");
    return comment?.getAttribute("data-id") || null;
  };
  const findTopLevelAncestorId = (commentId, state2) => {
    let current = state2.commentById.get(commentId);
    if (!current) return null;
    const visited = new Set();
    while (current) {
      if (visited.has(current._id)) break;
      visited.add(current._id);
      if (!current.parentCommentId) return current._id;
      const parent = state2.commentById.get(current.parentCommentId);
      if (!parent) return null;
      current = parent;
    }
    return null;
  };
  const markAncestorChainForceVisible = (commentId, state2) => {
    let currentId = commentId;
    const visited = new Set();
    while (currentId) {
      if (visited.has(currentId)) break;
      visited.add(currentId);
      const comment = state2.commentById.get(currentId);
      if (!comment) break;
      comment.forceVisible = true;
      comment.justRevealed = true;
      currentId = comment.parentCommentId || null;
    }
  };
  const handleLoadPost = async (postId, titleLink, state2) => {
    const postContainer = titleLink.closest(".pr-post");
    if (!postContainer) return;
    let contentEl = postContainer.querySelector(".pr-post-content");
    if (!contentEl) {
      contentEl = document.createElement("div");
      contentEl.className = "pr-post-content";
      const header = postContainer.querySelector(".pr-post-header");
      if (header) {
        header.after(contentEl);
      } else {
        postContainer.prepend(contentEl);
      }
    }
    contentEl.innerHTML = '<div class="pr-info">Loading post content...</div>';
    try {
      const res = await queryGraphQL(GET_POST_BY_ID, { id: postId });
      const post = res?.post?.result;
      if (post) {
        if (!state2.postById.has(post._id)) {
          state2.posts.push(post);
        } else {
          const idx = state2.posts.findIndex((p) => p._id === post._id);
          if (idx >= 0) state2.posts[idx] = post;
        }
        rebuildIndexes(state2);
        titleLink.removeAttribute("data-action");
        const group = {
          postId: post._id,
          title: post.title,
          comments: state2.comments.filter((c) => c.postId === post._id),
          fullPost: post
        };
        postContainer.outerHTML = renderPostGroup(group, state2);
        setupLinkPreviews(state2.comments);
      } else {
        contentEl.innerHTML = '<div class="pr-info" style="color: red;">Failed to load post content.</div>';
      }
    } catch (err) {
      Logger.error("Failed to load post", err);
      contentEl.innerHTML = '<div class="pr-info" style="color: red;">Error loading post.</div>';
    }
  };
  const handleTogglePostBody = async (target, state2) => {
    const postId = getPostIdFromTarget(target);
    if (!postId) return;
    const postEl = document.querySelector(`.pr-post[data-id="${postId}"]`);
    if (!postEl) return;
    const eBtn = postEl.querySelector('[data-action="toggle-post-body"]');
    const isFromSticky = !!target.closest(".pr-sticky-header");
    let container = postEl.querySelector(".pr-post-body-container");
    if (!container) {
      if (eBtn) eBtn.textContent = "[...]";
      try {
        const res = await queryGraphQL(GET_POST_BY_ID, { id: postId });
        const post = res?.post?.result;
        if (!post || !post.htmlBody) {
          Logger.warn(`Post ${postId} has no body content`);
          if (eBtn) eBtn.textContent = "[e]";
          return;
        }
        state2.postById.set(postId, post);
        const postIdx = state2.posts.findIndex((p) => p._id === postId);
        if (postIdx >= 0) {
          state2.posts[postIdx] = post;
        } else {
          state2.posts.push(post);
        }
        reRenderPostGroup(postId, state2);
        container = document.querySelector(`.pr-post[data-id="${postId}"] .pr-post-body-container`);
        if (container) {
          container.classList.remove("truncated");
          container.style.maxHeight = "none";
          const overlay = container.querySelector(".pr-read-more-overlay");
          if (overlay) overlay.style.display = "none";
        }
        const newBtn = document.querySelector(`.pr-post[data-id="${postId}"] [data-action="toggle-post-body"]`);
        if (newBtn) {
          newBtn.textContent = "[e]";
          newBtn.title = "Collapse post body";
        }
        if (isFromSticky) {
          const freshPostEl = document.querySelector(`.pr-post[data-id="${postId}"]`);
          const postHeader = freshPostEl?.querySelector(".pr-post-header");
          if (postHeader) {
            const newHeaderTop = postHeader.getBoundingClientRect().top + window.pageYOffset;
            window.scrollTo({
              top: newHeaderTop,
              behavior: window.__PR_TEST_MODE__ ? "instant" : "smooth"
            });
          }
        }
        Logger.info(`Loaded and expanded post body for ${postId}`);
        return;
      } catch (err) {
        Logger.error(`Failed to load post body for ${postId}`, err);
        if (eBtn) eBtn.textContent = "[e]";
        return;
      }
    }
    if (container.classList.contains("truncated")) {
      container.classList.remove("truncated");
      container.style.maxHeight = "none";
      const overlay = container.querySelector(".pr-read-more-overlay");
      if (overlay) overlay.style.display = "none";
      if (eBtn) eBtn.title = "Collapse post body";
    } else {
      container.classList.add("truncated");
      container.style.maxHeight = CONFIG.maxPostHeight;
      const overlay = container.querySelector(".pr-read-more-overlay");
      if (overlay) overlay.style.display = "flex";
      if (eBtn) eBtn.title = "Expand post body";
    }
    if (isFromSticky) {
      const postHeader = postEl.querySelector(".pr-post-header");
      if (postHeader) {
        const newHeaderTop = postHeader.getBoundingClientRect().top + window.pageYOffset;
        window.scrollTo({
          top: newHeaderTop,
          behavior: window.__PR_TEST_MODE__ ? "instant" : "smooth"
        });
      }
    }
  };
  const handleLoadAllComments = async (target, state2) => {
    const postId = getPostIdFromTarget(target);
    if (!postId) return;
    const originalText = target.textContent;
    target.textContent = "[...]";
    try {
      const res = await queryGraphQL(GET_POST_COMMENTS, {
        postId,
        limit: CONFIG.loadMax
      });
      const comments = res?.comments?.results || [];
      const added = mergeComments(comments, state2, false);
      Logger.info(`Load all comments for post ${postId}: ${comments.length} fetched, ${added} new`);
      state2.comments.filter((c) => c.postId === postId).forEach((c) => {
        c.forceVisible = true;
        c.justRevealed = true;
      });
      setTimeout(() => {
        state2.comments.filter((c) => c.postId === postId).forEach((c) => {
          c.justRevealed = false;
        });
      }, 2e3);
      reRenderPostGroup(postId, state2);
      if (added === 0) {
        Logger.info(`No new comments found for post ${postId}`);
      }
    } catch (err) {
      Logger.error("Failed to load all comments", err);
    } finally {
      target.textContent = originalText;
    }
  };
  const handleScrollToPostTop = (target, state2) => {
    const postId = getPostIdFromTarget(target);
    if (!postId) return;
    const postHeader = document.querySelector(`.pr-post[data-id="${postId}"] .pr-post-header`);
    if (postHeader) {
      const headerTop = postHeader.getBoundingClientRect().top + window.pageYOffset;
      const currentScroll = window.pageYOffset;
      if (Math.abs(headerTop - currentScroll) < 5) {
        const eBtn = postHeader.querySelector('[data-action="toggle-post-body"]');
        if (eBtn && !eBtn.classList.contains("disabled")) {
          handleTogglePostBody(eBtn, state2).then(() => {
            const refreshedTop = postHeader.getBoundingClientRect().top + window.pageYOffset;
            window.scrollTo({
              top: refreshedTop,
              behavior: window.__PR_TEST_MODE__ ? "instant" : "smooth"
            });
          });
          return;
        }
      }
      window.scrollTo({
        top: headerTop,
        behavior: window.__PR_TEST_MODE__ ? "instant" : "smooth"
      });
    }
  };
  const handleScrollToComments = (target) => {
    const postId = getPostIdFromTarget(target);
    if (!postId) return;
    const postEl = document.querySelector(`.pr-post[data-id="${postId}"]`);
    if (!postEl) return;
    const firstComment = postEl.querySelector(".pr-comment");
    if (firstComment) smartScrollTo(firstComment, false);
  };
  const handleScrollToNextPost = (target) => {
    const postId = getPostIdFromTarget(target);
    if (!postId) return;
    const currentPost = document.querySelector(`.pr-post[data-id="${postId}"]`);
    if (!currentPost) return;
    const nextPost = currentPost.nextElementSibling;
    if (nextPost && nextPost.classList.contains("pr-post")) {
      const header = nextPost.querySelector(".pr-post-header");
      if (header) smartScrollTo(header, true);
    }
  };
  const handleLoadThread = async (target, state2) => {
    const commentId = getCommentIdFromTarget(target);
    if (!commentId) return;
    const comment = state2.commentById.get(commentId);
    if (!comment) return;
    let topLevelId = findTopLevelAncestorId(commentId, state2);
    if (!topLevelId && comment.parentCommentId) {
      const originalText2 = target.textContent;
      target.textContent = "[...]";
      try {
        let currentParentId = comment.parentCommentId;
        const visited = new Set();
        while (currentParentId && !visited.has(currentParentId)) {
          visited.add(currentParentId);
          const existing = state2.commentById.get(currentParentId);
          if (existing) {
            currentParentId = existing.parentCommentId || null;
            continue;
          }
          const res = await queryGraphQL(GET_COMMENT, { id: currentParentId });
          const parent = res?.comment?.result;
          if (!parent) break;
          parent.isContext = true;
          state2.comments.push(parent);
          rebuildIndexes(state2);
          currentParentId = parent.parentCommentId || null;
        }
        topLevelId = findTopLevelAncestorId(commentId, state2);
      } catch (err) {
        Logger.error("Failed to walk parent chain for thread load", err);
        target.textContent = originalText2;
        return;
      }
    }
    if (!topLevelId) {
      topLevelId = commentId;
    }
    const originalText = target.textContent;
    target.textContent = "[...]";
    try {
      const res = await queryGraphQL(GET_THREAD_COMMENTS, {
        topLevelCommentId: topLevelId,
        limit: CONFIG.loadMax
      });
      const comments = res?.comments?.results || [];
      const added = mergeComments(comments, state2);
      Logger.info(`Load thread ${topLevelId}: ${comments.length} fetched, ${added} new`);
      if (added > 0 && comment.postId) {
        reRenderPostGroup(comment.postId, state2, commentId);
      }
    } catch (err) {
      Logger.error("Failed to load thread", err);
    } finally {
      target.textContent = originalText;
    }
  };
  const handleLoadParents = async (target, state2) => {
    const commentId = getCommentIdFromTarget(target);
    if (!commentId) return;
    const comment = state2.commentById.get(commentId);
    if (!comment) return;
    const originalText = target.textContent;
    target.textContent = "[...]";
    try {
      const missingIds = [];
      let currentId = comment.parentCommentId || null;
      const visited = new Set();
      while (currentId) {
        if (visited.has(currentId)) break;
        visited.add(currentId);
        const existing = state2.commentById.get(currentId);
        if (existing) {
          currentId = existing.parentCommentId || null;
          continue;
        }
        missingIds.push(currentId);
        currentId = null;
      }
      if (missingIds.length === 0) {
        target.textContent = originalText;
        return;
      }
      const fetched = [];
      while (missingIds.length > 0) {
        const batch = missingIds.splice(0, 50);
        const res = await queryGraphQL(GET_COMMENTS_BY_IDS, { commentIds: batch });
        const results = res?.comments?.results || [];
        fetched.push(...results);
        for (const r of results) {
          if (r.parentCommentId && !state2.commentById.has(r.parentCommentId) && !missingIds.includes(r.parentCommentId)) {
            missingIds.push(r.parentCommentId);
          }
        }
      }
      const added = mergeComments(fetched, state2);
      Logger.info(`Load parents for ${commentId}: ${fetched.length} fetched, ${added} new`);
      for (const f of fetched) {
        f.forceVisible = true;
        f.justRevealed = true;
      }
      if (comment) {
        comment.forceVisible = true;
        comment.justRevealed = true;
      }
      if (added > 0 && comment.postId) {
        reRenderPostGroup(comment.postId, state2, commentId);
      }
      setTimeout(() => {
        for (const f of fetched) f.justRevealed = false;
        if (comment) comment.justRevealed = false;
      }, 2e3);
    } catch (err) {
      Logger.error("Failed to load parents", err);
    } finally {
      target.textContent = originalText;
    }
  };
  const handleLoadDescendants = async (target, state2) => {
    const commentId = getCommentIdFromTarget(target);
    if (!commentId) return;
    const comment = state2.commentById.get(commentId);
    if (!comment) return;
    const originalText = target.textContent;
    target.textContent = "[...]";
    try {
      let topLevelId = findTopLevelAncestorId(commentId, state2);
      if (!topLevelId && comment.parentCommentId) {
        let currentParentId = comment.parentCommentId;
        const visited = new Set();
        while (currentParentId && !visited.has(currentParentId)) {
          visited.add(currentParentId);
          const existing = state2.commentById.get(currentParentId);
          if (existing) {
            currentParentId = existing.parentCommentId || null;
            continue;
          }
          const parentRes = await queryGraphQL(GET_COMMENT, { id: currentParentId });
          const parent = parentRes?.comment?.result;
          if (!parent) break;
          parent.isContext = true;
          state2.comments.push(parent);
          rebuildIndexes(state2);
          currentParentId = parent.parentCommentId || null;
        }
        topLevelId = findTopLevelAncestorId(commentId, state2);
      }
      if (!topLevelId) topLevelId = commentId;
      const res = await queryGraphQL(GET_THREAD_COMMENTS, {
        topLevelCommentId: topLevelId,
        limit: CONFIG.loadMax
      });
      const fetchedComments = res?.comments?.results || [];
      fetchedComments.forEach((c) => {
        c.forceVisible = true;
        c.justRevealed = true;
      });
      const added = mergeComments(fetchedComments, state2);
      fetchedComments.forEach((c) => {
        const inState = state2.commentById.get(c._id);
        if (inState) {
          inState.forceVisible = true;
          inState.justRevealed = true;
        }
      });
      Logger.info(`Load descendants for ${commentId}: ${fetchedComments.length} fetched, ${added} new`);
      if ((added > 0 || fetchedComments.length > 0) && comment.postId) {
        reRenderPostGroup(comment.postId, state2, commentId);
      }
      setTimeout(() => {
        fetchedComments.forEach((c) => {
          const inState = state2.commentById.get(c._id);
          if (inState) inState.justRevealed = false;
        });
      }, 2e3);
    } catch (err) {
      Logger.error("Failed to load descendants", err);
    } finally {
      target.textContent = originalText;
    }
  };
  const handleScrollToRoot = (target, state2) => {
    const commentId = getCommentIdFromTarget(target);
    if (!commentId) return;
    const topLevelId = findTopLevelAncestorId(commentId, state2);
    if (topLevelId) {
      const rootEl = document.querySelector(`.pr-comment[data-id="${topLevelId}"]`);
      if (rootEl) {
        smartScrollTo(rootEl, false);
        rootEl.classList.add("pr-highlight-parent");
        setTimeout(() => rootEl.classList.remove("pr-highlight-parent"), 2e3);
        return;
      }
    }
    const comment = state2.commentById.get(commentId);
    if (comment?.postId) {
      const postHeader = document.querySelector(`.pr-post[data-id="${comment.postId}"] .pr-post-header`);
      if (postHeader) {
        smartScrollTo(postHeader, true);
        postHeader.classList.add("pr-highlight-parent");
        setTimeout(() => postHeader.classList.remove("pr-highlight-parent"), 2e3);
      }
    }
  };
  const handleLoadParentsAndScroll = async (target, state2) => {
    const commentId = getCommentIdFromTarget(target);
    if (!commentId) return;
    let topLevelId = findTopLevelAncestorId(commentId, state2);
    const alreadyLoaded = !!topLevelId;
    markAncestorChainForceVisible(commentId, state2);
    if (!alreadyLoaded) {
      await handleLoadParents(target, state2);
      topLevelId = findTopLevelAncestorId(commentId, state2);
    }
    if (topLevelId) {
      let rootEl = document.querySelector(`.pr-comment[data-id="${topLevelId}"]`);
      if (rootEl) {
        const comment = state2.commentById.get(commentId);
        if (comment?.postId) {
          reRenderPostGroup(comment.postId, state2, commentId);
          rootEl = document.querySelector(`.pr-comment[data-id="${topLevelId}"]`);
        }
        if (!rootEl) return;
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const isVisible = isElementFullyVisible(rootEl);
        if (!isVisible) {
          smartScrollTo(rootEl, false);
        } else {
          Logger.info(`Trace to Root: Root ${topLevelId} already visible, skipping scroll.`);
        }
        rootEl.classList.add("pr-highlight-parent");
        setTimeout(() => rootEl.classList.remove("pr-highlight-parent"), 2e3);
        return;
      }
    }
    handleScrollToRoot(target, state2);
  };
  const handleSendToAIStudio = async (state2, includeDescendants = false) => {
    const target = document.elementFromPoint(state2.lastMousePos.x, state2.lastMousePos.y);
    if (!target) {
      Logger.warn("AI Studio: No element found under mouse.");
      return;
    }
    const itemEl = target.closest(".pr-comment, .pr-post");
    if (!itemEl) {
      Logger.warn("AI Studio: No comment or post found under mouse.");
      return;
    }
    document.querySelectorAll(".being-summarized").forEach((el) => el.classList.remove("being-summarized"));
    itemEl.classList.add("being-summarized");
    const id = itemEl.dataset.id;
    if (!id) {
      Logger.warn("AI Studio: Element has no ID.");
      return;
    }
    if (!includeDescendants && state2.sessionAICache[id] && !window.PR_FORCE_AI_REGEN) {
      Logger.info(`AI Studio: Using session-cached answer for ${id}`);
      displayAIPopup(state2.sessionAICache[id], state2);
      return;
    }
    window.PR_FORCE_AI_REGEN = false;
    const isPost = itemEl.classList.contains("pr-post");
    Logger.info(`AI Studio: Target identified - ${isPost ? "Post" : "Comment"} ${id} (Include descendants: ${includeDescendants})`);
    try {
      const statusEl = document.querySelector(".pr-status");
      if (statusEl) statusEl.innerHTML = '<span style="color: #007bff;">[AI Studio] Building conversation thread...</span>';
      const requestId = Math.random().toString(36).substring(2, 10);
      const lineage = [];
      let currentId = id;
      let currentIsPost = isPost;
      while (currentId && lineage.length < 8) {
        const item = await fetchItemMarkdown(currentId, currentIsPost, state2);
        if (!item) break;
        lineage.unshift(item);
        if (currentIsPost) {
          currentId = null;
        } else {
          if (item.parentCommentId) {
            currentId = item.parentCommentId;
            currentIsPost = false;
          } else if (item.postId) {
            currentId = item.postId;
            currentIsPost = true;
          } else {
            currentId = null;
          }
        }
      }
      let descendants = [];
      if (includeDescendants) {
        if (isPost) {
          descendants = state2.comments.filter((c) => c.postId === id);
        } else {
          const found = new Set();
          const toCheck = [id];
          while (toCheck.length > 0) {
            const cid = toCheck.pop();
            const children = state2.comments.filter((c) => c.parentCommentId === cid);
            children.forEach((c) => {
              if (!found.has(c._id)) {
                found.add(c._id);
                descendants.push(c);
                toCheck.push(c._id);
              }
            });
          }
        }
        descendants.sort((a, b) => new Date(a.postedAt).getTime() - new Date(b.postedAt).getTime());
        descendants = descendants.filter((d) => d._id !== id);
      }
      const threadXml = lineage.length > 0 ? toXml(lineage, id, descendants) : "";
      const prefix = getAIStudioPrefix() || AI_STUDIO_PROMPT_PREFIX;
      const finalPayload = prefix + threadXml;
      Logger.info("AI Studio: Opening tab with deep threaded payload...");
      state2.currentAIRequestId = requestId;
      if (typeof GM_setValue === "function") {
        GM_setValue("ai_studio_request_id", requestId);
        GM_setValue("ai_studio_prompt_payload", finalPayload);
        GM_setValue("ai_studio_include_descendants", includeDescendants);
      }
      if (typeof GM_openInTab === "function") {
        GM_openInTab("https://aistudio.google.com/prompts/new_chat", { active: true });
      }
      if (statusEl) statusEl.innerHTML = '<span style="color: #28a745;">[AI Studio] Opening AI Studio tab...</span>';
    } catch (error) {
      Logger.error("AI Studio: Failed to prepare threaded payload", error);
      alert("Failed to send thread to AI Studio. Check console.");
    }
  };
  const fetchItemMarkdown = async (itemId, itemIsPost, state2) => {
    if (itemIsPost) {
      const p = state2.posts.find((p2) => p2._id === itemId);
      if (p?.contents?.markdown) return p;
    } else {
      const c = state2.comments.find((c2) => c2._id === itemId);
      if (c?.contents?.markdown) return c;
    }
    Logger.info(`AI Studio: Fetching ${itemId} source from server...`);
    if (itemIsPost) {
      const res = await queryGraphQL(GET_POST, { id: itemId });
      return res?.post?.result || null;
    } else {
      const res = await queryGraphQL(GET_COMMENT, { id: itemId });
      return res?.comment?.result || null;
    }
  };
  const toXml = (items, focalId, descendants = []) => {
    if (items.length === 0) return "";
    const item = items[0];
    const remaining = items.slice(1);
    const isFocal = item._id === focalId;
    const type = item.title ? "post" : "comment";
    const author = item.user?.username || item.author || "unknown";
    const md = item.contents?.markdown || item.htmlBody || "(no content)";
    let xml = `<${type} id="${item._id}" author="${author}"${isFocal ? ' is_focal="true"' : ""}>
`;
    xml += `<body_markdown>
${md}
</body_markdown>
`;
    if (isFocal && descendants.length > 0) {
      xml += `<descendants>
`;
      xml += descendantsToXml(descendants, focalId).split("\n").map((line) => "  " + line).join("\n") + "\n";
      xml += `</descendants>
`;
    }
    if (remaining.length > 0) {
      xml += toXml(remaining, focalId, descendants).split("\n").map((line) => "  " + line).join("\n") + "\n";
    }
    xml += `</${type}>`;
    return xml;
  };
  const descendantsToXml = (descendants, parentId) => {
    const children = descendants.filter((d) => d.parentCommentId === parentId || parentId === d.postId && !d.parentCommentId);
    if (children.length === 0) return "";
    return children.map((child) => {
      const author = child.user?.username || child.author || "unknown";
      const md = child.contents?.markdown || child.htmlBody || "(no content)";
      let xml = `<comment id="${child._id}" author="${author}">
`;
      xml += `  <body_markdown>
${md.split("\n").map((l) => "    " + l).join("\n")}
  </body_markdown>
`;
      const grandChildrenXml = descendantsToXml(descendants, child._id);
      if (grandChildrenXml) {
        xml += grandChildrenXml.split("\n").map((line) => "  " + line).join("\n") + "\n";
      }
      xml += `</comment>`;
      return xml;
    }).join("\n");
  };
  const displayAIPopup = (text, state2, includeDescendants = false) => {
    if (state2.activeAIPopup) {
      const content = state2.activeAIPopup.querySelector(".pr-ai-popup-content");
      if (content) content.innerHTML = text;
      state2.activeAIPopup.classList.toggle("pr-ai-include-descendants", includeDescendants);
      return;
    }
    const popup = document.createElement("div");
    popup.className = `pr-ai-popup${includeDescendants ? " pr-ai-include-descendants" : ""}`;
    popup.innerHTML = `
    <div class="pr-ai-popup-header">
      <h3>Summary and Potential Errors</h3>
      <div class="pr-ai-popup-actions">
        <button class="pr-ai-popup-regen">Regenerate</button>
        <button class="pr-ai-popup-close">Close</button>
      </div>
    </div>
    <div class="pr-ai-popup-content">${text}</div>
  `;
    document.body.appendChild(popup);
    state2.activeAIPopup = popup;
    popup.querySelector(".pr-ai-popup-close")?.addEventListener("click", () => closeAIPopup(state2));
    popup.querySelector(".pr-ai-popup-regen")?.addEventListener("click", () => {
      window.PR_FORCE_AI_REGEN = true;
      const isShifted = popup.classList.contains("pr-ai-include-descendants");
      handleSendToAIStudio(state2, isShifted);
    });
  };
  const closeAIPopup = (state2) => {
    if (state2.activeAIPopup) {
      state2.activeAIPopup.remove();
      state2.activeAIPopup = null;
    }
    document.querySelectorAll(".being-summarized").forEach((el) => el.classList.remove("being-summarized"));
  };
  const initAIStudioListener = (state2) => {
    if (typeof GM_addValueChangeListener !== "function") {
      Logger.debug("AI Studio: GM_addValueChangeListener not available, skipping listener setup");
      return;
    }
    GM_addValueChangeListener("ai_studio_response_payload", (_key, _oldVal, newVal, remote) => {
      if (!newVal || !remote) return;
      const { text, requestId, includeDescendants } = newVal;
      if (requestId === state2.currentAIRequestId) {
        Logger.info("AI Studio: Received matching response!");
        const target = document.querySelector(".being-summarized");
        if (target?.dataset.id) {
          state2.sessionAICache[target.dataset.id] = text;
        }
        displayAIPopup(text, state2, !!includeDescendants);
        const statusEl = document.querySelector(".pr-status");
        if (statusEl) statusEl.innerHTML = "AI Studio response received.";
        const stickyEl = document.getElementById("pr-sticky-ai-status");
        if (stickyEl) {
          stickyEl.classList.remove("visible");
          stickyEl.textContent = "";
        }
        window.focus();
      } else {
        Logger.debug("AI Studio: Received response for different request. Ignoring.");
      }
    });
    GM_addValueChangeListener("ai_studio_status", (_key, _oldVal, newVal, remote) => {
      if (!newVal || !remote) return;
      Logger.debug(`AI Studio Status: ${newVal}`);
      const statusEl = document.querySelector(".pr-status");
      if (statusEl) {
        statusEl.innerHTML = `<span style="color: #28a745;">[AI Studio] ${newVal}</span>`;
      }
      const stickyEl = document.getElementById("pr-sticky-ai-status");
      if (stickyEl) {
        stickyEl.textContent = `AI: ${newVal}`;
        stickyEl.classList.add("visible");
        if (newVal === "Response received!" || newVal.startsWith("Error:")) {
          setTimeout(() => {
            if (stickyEl.textContent?.includes(newVal)) {
              stickyEl.classList.remove("visible");
            }
          }, 5e3);
        }
      }
    });
    let scrollThrottle = null;
    window.addEventListener("scroll", () => {
      if (scrollThrottle || !state2.activeAIPopup) return;
      scrollThrottle = window.setTimeout(() => {
        scrollThrottle = null;
        if (!state2.activeAIPopup) return;
        const target = document.querySelector(".being-summarized");
        if (target) {
          const rect = target.getBoundingClientRect();
          const isVisible = rect.bottom > 0 && rect.top < window.innerHeight;
          if (!isVisible) {
            Logger.info("AI Studio: Target scrolled off-screen. Auto-closing popup.");
            closeAIPopup(state2);
          }
        }
      }, 500);
    }, { passive: true });
  };
  const setupAIStudioKeyboard = (state2) => {
    document.addEventListener("keydown", (e) => {
      const target = e.target;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }
      const key = e.key;
      const lowerKey = key.toLowerCase();
      if (lowerKey === "g" || key === "Escape") {
        if (state2.activeAIPopup) {
          if (key === "Escape") {
            closeAIPopup(state2);
            return;
          }
          const elementUnderMouse = document.elementFromPoint(state2.lastMousePos.x, state2.lastMousePos.y);
          const isInPopup = !!elementUnderMouse?.closest(".pr-ai-popup");
          const isInFocalItem = !!elementUnderMouse?.closest(".being-summarized");
          if (isInPopup || isInFocalItem) {
            closeAIPopup(state2);
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return;
          }
        }
      }
    });
  };
  const attachEventListeners = (state2) => {
    const isHeaderInteractive = (el) => {
      return !!el.closest(
        ".pr-post-header a, .pr-author, .pr-vote-controls, .pr-reactions-container, .pr-reaction-chip, .pr-add-reaction-btn, .pr-vote-btn, .pr-author-controls, .pr-post-action"
      );
    };
    document.addEventListener("mousedown", (e) => {
      Logger.debug(`document.mousedown: target=${e.target.tagName}.${e.target.className}`);
      const target = e.target.closest("[data-action]");
      if (!target) return;
      const action = target.dataset.action;
      if (!action) return;
      if (target.classList.contains("disabled")) {
        Logger.debug(`action ${action} is disabled, ignoring`);
        return;
      }
      Logger.debug(`Event: mousedown, action=${action}`);
      if (action === "karma-up" || action === "karma-down" || action === "agree" || action === "disagree") {
        handleVoteInteraction(target, action, state2);
      } else if (action === "reaction-vote") {
        const commentId = target.dataset.commentId;
        const reactName = target.dataset.reactionName;
        if (commentId && reactName) {
          handleReactionVote(commentId, reactName, state2);
        }
      } else if (action === "open-picker") {
        e.stopPropagation();
        openReactionPicker(target, state2);
      }
    });
    document.addEventListener("click", (e) => {
      const target = e.target;
      const replies = target.closest(".pr-replies");
      if (replies && target === replies) {
        e.stopPropagation();
        handleCommentCollapseToggle(replies);
        return;
      }
      const actionTarget = target.closest("[data-action]");
      if (!actionTarget) return;
      const action = actionTarget.dataset.action;
      if (actionTarget.classList.contains("disabled")) return;
      if (action === "collapse" && actionTarget.classList.contains("pr-post-toggle")) {
        e.stopPropagation();
        handlePostCollapse(actionTarget);
      } else if (action === "expand" && actionTarget.classList.contains("pr-post-toggle")) {
        e.stopPropagation();
        handlePostExpand(actionTarget);
      } else if (action === "author-up") {
        e.stopPropagation();
        handleAuthorUp(actionTarget, state2);
      } else if (action === "author-down") {
        e.stopPropagation();
        handleAuthorDown(actionTarget, state2);
      } else if (action === "read-more") {
        e.stopPropagation();
        handleReadMore(actionTarget);
      } else if (action === "load-post") {
        e.preventDefault();
        e.stopPropagation();
        const post = actionTarget.closest(".pr-post");
        const postId = post?.dataset.postId || actionTarget.closest(".pr-post-header")?.getAttribute("data-post-id");
        if (postId) {
          handleLoadPost(postId, actionTarget, state2);
        }
      } else if (action === "toggle-post-body") {
        e.stopPropagation();
        handleTogglePostBody(actionTarget, state2);
      } else if (action === "load-all-comments") {
        e.stopPropagation();
        handleLoadAllComments(actionTarget, state2);
      } else if (action === "scroll-to-post-top") {
        e.stopPropagation();
        const rawTarget = e.target;
        if (rawTarget instanceof Element && isHeaderInteractive(rawTarget)) return;
        handleScrollToPostTop(actionTarget, state2);
      } else if (action === "scroll-to-comments") {
        e.stopPropagation();
        handleScrollToComments(actionTarget);
      } else if (action === "scroll-to-next-post") {
        e.stopPropagation();
        handleScrollToNextPost(actionTarget);
      } else if (action === "send-to-ai-studio") {
        e.stopPropagation();
        handleSendToAIStudio(state2, e.shiftKey);
      } else if (action === "collapse" && actionTarget.classList.contains("pr-collapse")) {
        handleCommentCollapse(actionTarget);
      } else if (action === "expand" && actionTarget.classList.contains("pr-expand")) {
        handleCommentExpand(actionTarget);
      } else if (action === "expand-placeholder") {
        e.preventDefault();
        e.stopPropagation();
        handleExpandPlaceholder(target, state2);
      } else if (action === "find-parent") {
        e.preventDefault();
        e.stopPropagation();
        handleFindParent(target, state2);
      } else if (action === "load-thread") {
        e.preventDefault();
        e.stopPropagation();
        handleLoadThread(target, state2);
      } else if (action === "load-parents") {
        e.preventDefault();
        e.stopPropagation();
        handleLoadParents(target, state2);
      } else if (action === "load-descendants") {
        e.preventDefault();
        e.stopPropagation();
        handleLoadDescendants(target, state2);
      } else if (action === "scroll-to-root") {
        e.preventDefault();
        e.stopPropagation();
        handleScrollToRoot(target, state2);
      } else if (action === "load-parents-and-scroll") {
        e.preventDefault();
        e.stopPropagation();
        handleLoadParentsAndScroll(target, state2);
      }
    });
    document.addEventListener("click", (e) => {
      const target = e.target;
      if (target.id === "pr-inline-react-btn") {
        if (state2.currentSelection) {
          openReactionPicker(target, state2, "");
        }
      }
    });
    document.addEventListener("mousemove", (e) => {
      state2.lastMousePos.x = e.clientX;
      state2.lastMousePos.y = e.clientY;
    }, { passive: true });
    attachHotkeyListeners(state2);
  };
  const injectReaderLink = () => {
    const container = document.querySelector(".Header-rightHeaderItems");
    if (!container) return;
    if (document.getElementById("pr-header-link")) return;
    if (!document.getElementById("pr-header-injection-styles")) {
      GM_addStyle(`
      #pr-header-link {
        transition: opacity 0.2s !important;
      }
      #pr-header-link:hover {
        opacity: 0.7 !important;
        text-decoration: none !important;
      }
    `);
      const styleMarker = document.createElement("div");
      styleMarker.id = "pr-header-injection-styles";
      styleMarker.style.display = "none";
      document.head.appendChild(styleMarker);
    }
    const link = document.createElement("a");
    link.id = "pr-header-link";
    link.href = "/reader";
    link.className = "MuiButtonBase-root MuiButton-root MuiButton-text UsersMenu-userButtonRoot";
    link.style.marginRight = "12px";
    link.style.textDecoration = "none";
    link.style.color = "inherit";
    link.style.display = "inline-flex";
    link.style.alignItems = "center";
    link.innerHTML = `
    <span class="MuiButton-label">
      <span class="UsersMenu-userButtonContents" style="display: flex; align-items: center; gap: 6px;">
        <span style="
          background: #333; 
          color: #fff; 
          padding: 2px 5px; 
          border-radius: 3px; 
          font-size: 0.75em; 
          font-weight: 900;
          letter-spacing: 0.5px;
          line-height: 1;
        ">POWER</span>
        <span style="font-weight: 500;">Reader</span>
      </span>
    </span>
  `;
    const searchBar = container.querySelector(".SearchBar-root");
    if (searchBar) {
      searchBar.after(link);
    } else {
      container.prepend(link);
    }
    Logger.debug("Header Injection: Reader link injected");
  };
  const setupHeaderInjection = () => {
    let isHydrated = false;
    const detectHydration = () => {
      if (document.querySelector(".Header-rightHeaderItems")) {
        isHydrated = true;
        injectReaderLink();
        return;
      }
    };
    if (document.readyState === "complete") {
      detectHydration();
    } else {
      window.addEventListener("load", detectHydration);
    }
    const observer = new MutationObserver(() => {
      if (!isHydrated) {
        if (document.querySelector(".Header-rightHeaderItems")) {
          isHydrated = true;
          injectReaderLink();
        }
        return;
      }
      if (!document.getElementById("pr-header-link")) {
        injectReaderLink();
      }
    });
    if (document.documentElement) {
      observer.observe(document.documentElement, { childList: true, subtree: true });
    } else {
      const earlyCheck = setInterval(() => {
        if (document.documentElement) {
          clearInterval(earlyCheck);
          observer.observe(document.documentElement, { childList: true, subtree: true });
        }
      }, 100);
    }
  };
  const initReader = async () => {
    const route = getRoute();
    if (route.type === "skip") {
      return;
    }
    if (route.type === "forum-injection") {
      setupHeaderInjection();
      return;
    }
    if (route.type === "ai-studio") {
      await runAIStudioMode();
      return;
    }
    executeTakeover();
    try {
      await initializeReactions();
    } catch (e) {
      Logger.error("Reaction initialization failed:", e);
    }
    if (route.path === "reset") {
      Logger.info("Resetting storage...");
      clearAllStorage();
      window.location.href = "/reader";
      return;
    }
    rebuildDocument();
    const loadFrom = getLoadFrom();
    if (!loadFrom) {
      showSetupUI(handleStartReading);
      signalReady();
      return;
    }
    await loadAndRender();
  };
  const handleStartReading = async (loadFromDate) => {
    if (loadFromDate) {
      setLoadFrom(loadFromDate);
    } else {
      setLoadFrom("__LOAD_RECENT__");
    }
    await loadAndRender();
  };
  const loadAndRender = async () => {
    const root = getRoot();
    if (!root) return;
    const state2 = getState();
    root.innerHTML = `
    <div class="pr-header">
      <h1>Less Wrong: Power Reader <small style="font-size: 0.6em; color: #888;">v${"1.2.538"}</small></h1>
      <div class="pr-status">Fetching comments...</div>
    </div>
  `;
    const setStatus = (text) => {
      const el = document.querySelector(".pr-status");
      if (el) el.textContent = text;
    };
    try {
      Logger.info("Loading data...");
      const initialResult = await loadInitial();
      Logger.info("loadInitial complete");
      applyInitialLoad(state2, initialResult);
      if (state2.comments.length > 0) {
        state2.initialBatchNewestDate = state2.comments.reduce((newest, c) => {
          return new Date(c.postedAt) > new Date(newest) ? c.postedAt : newest;
        }, state2.comments[0].postedAt);
      }
      setStatus(`${state2.comments.length} comments — fetching posts & subscriptions...`);
      Logger.info("Enriching in background...");
      const enrichResult = await enrichInBackground(state2);
      Logger.info("enrichInBackground complete");
      applyEnrichment(state2, enrichResult);
      setStatus(`${state2.comments.length} comments & ${state2.primaryPostsCount} posts — loading replies...`);
      const readState = getReadState();
      const smartResult = await runSmartLoading(state2, readState);
      if (smartResult) {
        applySmartLoad(state2, smartResult);
        Logger.info(`Smart loaded: ${state2.comments.length} comments total`);
      }
      Logger.info(`Loaded ${state2.comments.length} comments and ${state2.posts.length} posts`);
      renderUI(state2);
      Logger.info("renderUI complete");
      signalReady();
      Logger.info("signalReady called");
      if (!root.dataset.listenersAttached) {
        initAIStudioListener(state2);
        setupAIStudioKeyboard(state2);
        attachEventListeners(state2);
        root.dataset.listenersAttached = "true";
      }
    } catch (e) {
      Logger.error("Page load failed:", e);
      root.innerHTML = `<div class="pr-error">Error loading reader. Check console.</div>`;
      signalReady();
    }
  };
  initReader();

})();