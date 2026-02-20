/**
 * CSS styles for Power Reader
 */

export const STYLES = `
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
    /* Shared theme tokens used across archive + preview UI. */
    --pr-bg-primary: #fff;
    --pr-bg-secondary: #f9f9f9;
    --pr-bg-hover: #f0f0f0;
    --pr-text-primary: #000;
    --pr-text-secondary: #666;
    --pr-text-tertiary: #999;
    --pr-border-color: #ddd;
    --pr-border-subtle: #eee;
    --pr-highlight: #0078ff;

    margin: 0 auto;
    padding: 20px;
    position: relative;
    box-sizing: border-box;
  }

  /* Temporarily bypass content-visibility for precise DOM measurements and smooth scrolling */
  .pr-force-layout,
  .pr-force-layout .pr-comment,
  .pr-force-layout .pr-post {
      content-visibility: visible !important;
      contain-intrinsic-size: auto !important;
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
    content-visibility: auto;
    contain-intrinsic-size: auto 150px;
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

  .pr-post-comments.collapsed, .pr-post-content.collapsed, .pr-post-body-container.collapsed {
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
    content-visibility: auto;
    contain-intrinsic-size: auto 150px;
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

  .pr-comment.read > .pr-comment-body {
    color: #707070;
  }

  .pr-comment.read, .pr-comment.context {
    border: none;
    background: transparent;
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
    white-space: pre-wrap; /* Allows \n to break lines */
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

  /* Archive Mode */
  .pr-archive-item-body {
    padding: 10px 15px;
    background: white;
    border-top: 1px solid #eee;
  }

  /* Compact post header for top-level comments in archive card view only */
  .pr-archive-top-level-comment > .pr-post-header {
    padding: 4px 8px;
    gap: 6px;
  }

  .pr-archive-top-level-comment > .pr-post-header h2 {
    font-size: 1em;
  }

  .pr-archive-top-level-comment > .pr-post-header .pr-post-meta {
    font-size: 80%;
    gap: 4px !important;
    min-height: 18px;
  }

  .pr-archive-top-level-comment > .pr-post-header .pr-author-controls {
    margin: 0 2px;
  }

  .pr-archive-top-level-comment > .pr-post-header .pr-post-actions {
    gap: 1px;
    margin-right: 2px;
  }

  .pr-archive-top-level-comment > .pr-post-header .text-btn {
    font-size: 11px !important;
    padding: 0 1px;
  }
`;
