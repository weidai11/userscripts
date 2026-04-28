import type { Post } from '../../../shared/graphql/queries';
import type { ArchiveSortBy } from './state';
import type { ArchiveItem, ArchiveSearchScope } from './search/types';

type ArchiveExportItemType = 'post' | 'comment';
type ArchiveExportMode = 'current-view' | 'full-archive';

export interface ArchiveExportSource {
  mode: ArchiveExportMode;
  scope: ArchiveSearchScope;
  sort: ArchiveSortBy;
  query: string;
}

export interface ArchiveExportPayload {
  schemaVersion: 1;
  exportType: 'power-reader-archive';
  exportedAt: string;
  username: string;
  source: ArchiveExportSource;
  counts: {
    items: number;
    posts: number;
    comments: number;
  };
  items: ArchiveItem[];
}

const isPostItem = (item: ArchiveItem): item is Post => 'title' in item;

const countByType = (items: readonly ArchiveItem[]): { posts: number; comments: number } => {
  let posts = 0;
  let comments = 0;
  for (const item of items) {
    if (isPostItem(item)) {
      posts += 1;
    } else {
      comments += 1;
    }
  }
  return { posts, comments };
};

const getItemType = (item: ArchiveItem): ArchiveExportItemType => (isPostItem(item) ? 'post' : 'comment');

const stripHtml = (value: string): string =>
  value
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|li|blockquote|h[1-6]|ul|ol)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();

const getMarkdownOrFallbackText = (item: ArchiveItem): string => {
  const markdown = item.contents?.markdown;
  if (typeof markdown === 'string' && markdown.trim().length > 0) {
    return markdown.trim();
  }

  const htmlBody = item.htmlBody;
  if (typeof htmlBody === 'string' && htmlBody.trim().length > 0) {
    return stripHtml(htmlBody);
  }

  return '';
};

const normalizePostedAtMs = (value?: string | null): number => {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
};

const sortChronologically = (items: readonly ArchiveItem[]): ArchiveItem[] =>
  [...items].sort((a, b) => {
    const aTime = normalizePostedAtMs(a.postedAt);
    const bTime = normalizePostedAtMs(b.postedAt);
    if (aTime === bTime) return 0;
    return aTime < bTime ? -1 : 1;
  });

const escapeMarkdownInline = (value: string): string =>
  value.replace(/[\\`*_{}()[\]#+\-.!|>]/g, '\\$&');

const formatItemTitle = (item: ArchiveItem): string => {
  if (isPostItem(item)) {
    return item.title || '(untitled post)';
  }
  return `Comment by ${item.user?.displayName || item.user?.username || item.author || 'unknown author'}`;
};

const formatItemUrl = (item: ArchiveItem): string => {
  if (item.pageUrl && typeof item.pageUrl === 'string') return item.pageUrl;
  if (isPostItem(item) && item.slug) return `/posts/${item._id}/${item.slug}`;
  return '';
};

const formatExportMeta = (payload: ArchiveExportPayload): string[] => [
  '# Power Reader Archive Export',
  '',
  `- Username: ${payload.username}`,
  `- Exported At (UTC): ${payload.exportedAt}`,
  `- Export Mode: ${payload.source.mode}`,
  `- Scope: ${payload.source.scope}`,
  `- Sort: ${payload.source.sort}`,
  `- Query: ${payload.source.query || '(empty)'}`,
  `- Items: ${payload.counts.items} (posts: ${payload.counts.posts}, comments: ${payload.counts.comments})`,
  ''
];

export const createArchiveExportPayload = (
  username: string,
  items: readonly ArchiveItem[],
  source: ArchiveExportSource
): ArchiveExportPayload => {
  const { posts, comments } = countByType(items);
  return {
    schemaVersion: 1,
    exportType: 'power-reader-archive',
    exportedAt: new Date().toISOString(),
    username,
    source,
    counts: {
      items: items.length,
      posts,
      comments
    },
    items: [...items]
  };
};

export const buildArchiveMarkdown = (payload: ArchiveExportPayload): string => {
  const lines: string[] = formatExportMeta(payload);
  const exportItems = payload.source.mode === 'current-view'
    ? [...payload.items]
    : sortChronologically(payload.items);

  for (const item of exportItems) {
    const type = getItemType(item);
    const title = formatItemTitle(item);
    const date = item.postedAt || 'unknown';
    const score = Number.isFinite(item.baseScore) ? item.baseScore : 0;
    const url = formatItemUrl(item);
    const author = item.user?.displayName || item.user?.username || item.author || 'unknown';
    const bodyText = getMarkdownOrFallbackText(item);

    lines.push(`## [${type.toUpperCase()}] ${escapeMarkdownInline(title)}`);
    lines.push('');
    lines.push(`- ID: \`${item._id}\``);
    lines.push(`- Posted At: ${date}`);
    lines.push(`- Score: ${score}`);
    lines.push(`- Author: ${escapeMarkdownInline(author)}`);
    if (url) {
      lines.push(`- URL: ${url}`);
    }
    lines.push('');
    if (bodyText) {
      lines.push(bodyText);
      lines.push('');
    }
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
};

export const buildArchiveJsExportSource = (payload: ArchiveExportPayload): string => {
  const json = JSON.stringify(payload, null, 2);
  return [
    '/* Power Reader Archive Export */',
    '(() => {',
    `  const data = ${json};`,
    '  const root = (typeof globalThis === "object" && globalThis) ? globalThis : (typeof window === "object" ? window : {});',
    '  root.__PR_ARCHIVE_EXPORT__ = data;',
    '})();',
    ''
  ].join('\n');
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const escapeForInlineScript = (value: string): string =>
  value.replace(/<\/script/gi, '<\\/script');

export const buildArchiveHtmlExport = (payload: ArchiveExportPayload): string => {
  const jsExportSource = buildArchiveJsExportSource(payload);
  const inlineDataScript = escapeForInlineScript(jsExportSource);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Power Reader Archive Export - ${escapeHtml(payload.username)}</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #0f1115;
      --card: #171a21;
      --text: #f5f7fb;
      --muted: #9ea6b6;
      --border: #2a3140;
      --accent: #63a1ff;
    }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: "Segoe UI", Arial, sans-serif;
      line-height: 1.5;
    }
    .wrap {
      max-width: 1100px;
      margin: 0 auto;
      padding: 16px;
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 10;
      background: color-mix(in oklab, var(--bg) 90%, black 10%);
      border-bottom: 1px solid var(--border);
      padding: 12px 0;
      margin-bottom: 12px;
      backdrop-filter: blur(4px);
    }
    .toolbar-grid {
      display: grid;
      gap: 10px;
      grid-template-columns: 1fr auto auto;
      align-items: center;
    }
    .search {
      min-width: 0;
      padding: 10px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--card);
      color: var(--text);
    }
    .select {
      padding: 10px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--card);
      color: var(--text);
    }
    .meta {
      color: var(--muted);
      font-size: 0.9rem;
      margin-bottom: 10px;
    }
    .item {
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 14px;
      margin-bottom: 10px;
      background: var(--card);
    }
    .item h3 {
      margin: 0 0 8px;
      font-size: 1rem;
    }
    .item-meta {
      margin: 0 0 8px;
      color: var(--muted);
      font-size: 0.85rem;
    }
    .item a {
      color: var(--accent);
      text-decoration: none;
    }
    .item a:hover {
      text-decoration: underline;
    }
    details {
      margin-top: 8px;
    }
    pre {
      white-space: pre-wrap;
      word-wrap: break-word;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px;
      background: #0b0d12;
      color: var(--text);
      overflow: auto;
    }
    .html-body {
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px;
      background: #0b0d12;
      overflow: auto;
    }
    @media (max-width: 760px) {
      .toolbar-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="toolbar">
      <div class="toolbar-grid">
        <input id="search" class="search" type="text" placeholder="Filter by title/body/author">
        <select id="type" class="select" aria-label="Type filter">
          <option value="all">All</option>
          <option value="post">Posts</option>
          <option value="comment">Comments</option>
        </select>
        <select id="sort" class="select" aria-label="Sort">
          <option value="date-desc">Date (Newest)</option>
          <option value="date-asc">Date (Oldest)</option>
          <option value="score-desc">Score (High-Low)</option>
          <option value="score-asc">Score (Low-High)</option>
        </select>
      </div>
    </div>
    <h1>Power Reader Archive Export</h1>
    <div id="meta" class="meta"></div>
    <div id="results"></div>
  </div>
  <script>${inlineDataScript}</script>
  <script>
    (() => {
      const payload = globalThis.__PR_ARCHIVE_EXPORT__;
      if (!payload || !Array.isArray(payload.items)) {
        document.getElementById('results').textContent = 'Invalid export payload.';
        return;
      }

      const searchInput = document.getElementById('search');
      const typeSelect = document.getElementById('type');
      const sortSelect = document.getElementById('sort');
      const metaEl = document.getElementById('meta');
      const resultsEl = document.getElementById('results');

      const formatDate = (value) => {
        const date = new Date(value || '');
        return Number.isFinite(date.getTime()) ? date.toLocaleString() : 'unknown';
      };

      const isPost = (item) => Object.prototype.hasOwnProperty.call(item, 'title');
      const getType = (item) => isPost(item) ? 'post' : 'comment';
      const getAuthor = (item) => item?.user?.displayName || item?.user?.username || item?.author || 'unknown';
      const getTextBody = (item) => {
        const md = item?.contents?.markdown;
        if (typeof md === 'string' && md.trim().length > 0) return md;
        const html = typeof item?.htmlBody === 'string' ? item.htmlBody : '';
        return html.replace(/<\\s*br\\s*\\/?>/gi, '\\n').replace(/<[^>]+>/g, ' ');
      };
      const sanitizeHtmlBody = (value) => {
        if (typeof value !== 'string' || value.length === 0) return '';
        const template = document.createElement('template');
        template.innerHTML = value;
        template.content.querySelectorAll('script, style, iframe, object, embed, meta[http-equiv], link').forEach((el) => el.remove());
        template.content.querySelectorAll('*').forEach((el) => {
          for (const attr of Array.from(el.attributes)) {
            const name = attr.name.toLowerCase();
            const val = attr.value.trim().toLowerCase();
            if (name.startsWith('on')) {
              el.removeAttribute(attr.name);
              continue;
            }
            if ((name === 'href' || name === 'src' || name === 'action' || name === 'xlink:href') && val.startsWith('javascript:')) {
              el.removeAttribute(attr.name);
            }
          }
        });
        return template.innerHTML;
      };
      const escapeText = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
      const escapeAttr = (value) => escapeText(value);
      const sourceSort = typeof payload?.source?.sort === 'string' ? payload.source.sort : '';
      if (sourceSort === 'date-asc') sortSelect.value = 'date-asc';
      else if (sourceSort === 'score') sortSelect.value = 'score-desc';
      else if (sourceSort === 'score-asc') sortSelect.value = 'score-asc';

      const render = () => {
        const query = (searchInput.value || '').trim().toLowerCase();
        const type = typeSelect.value;
        const sort = sortSelect.value;
        const filtered = payload.items.filter((item) => {
          if (type !== 'all' && getType(item) !== type) return false;
          if (!query) return true;
          const text = [
            isPost(item) ? (item.title || '') : '',
            getAuthor(item),
            getTextBody(item)
          ].join(' ').toLowerCase();
          return text.includes(query);
        });

        filtered.sort((a, b) => {
          const aTime = Date.parse(a.postedAt || '') || 0;
          const bTime = Date.parse(b.postedAt || '') || 0;
          const aScore = Number.isFinite(a.baseScore) ? a.baseScore : 0;
          const bScore = Number.isFinite(b.baseScore) ? b.baseScore : 0;
          switch (sort) {
            case 'date-asc': return aTime - bTime;
            case 'score-desc': return bScore - aScore;
            case 'score-asc': return aScore - bScore;
            case 'date-desc':
            default: return bTime - aTime;
          }
        });

        metaEl.textContent = [
          'User: ' + payload.username,
          'Exported: ' + payload.exportedAt,
          'Mode: ' + payload.source.mode,
          'Items: ' + filtered.length + ' / ' + payload.items.length
        ].join(' | ');

        resultsEl.innerHTML = filtered.map((item) => {
          const typeLabel = getType(item).toUpperCase();
          const title = isPost(item) ? (item.title || '(untitled post)') : ('Comment by ' + getAuthor(item));
          const url = typeof item.pageUrl === 'string' ? item.pageUrl : '';
          const markdown = (typeof item?.contents?.markdown === 'string' && item.contents.markdown.trim().length > 0)
            ? item.contents.markdown
            : '';
          const htmlBody = sanitizeHtmlBody(item?.htmlBody);
          const hasMarkdown = markdown.length > 0;
          const hasHtml = htmlBody.length > 0;
          return '<article class="item">'
            + '<h3>[' + typeLabel + '] ' + escapeText(title) + '</h3>'
            + '<div class="item-meta">ID: ' + item._id
            + ' | Posted: ' + formatDate(item.postedAt)
            + ' | Score: ' + (Number.isFinite(item.baseScore) ? item.baseScore : 0)
            + ' | Author: ' + escapeText(getAuthor(item))
            + (url ? ' | <a href="' + escapeAttr(url) + '" target="_blank" rel="noopener noreferrer">Open</a>' : '')
            + '</div>'
            + (hasMarkdown ? '<details open><summary>Markdown</summary><pre>' + escapeText(markdown) + '</pre></details>' : '')
            + (hasHtml ? '<details><summary>HTML</summary><div class="html-body">' + htmlBody + '</div></details>' : '')
            + '</article>';
        }).join('');
      };

      searchInput.addEventListener('input', render);
      typeSelect.addEventListener('change', render);
      sortSelect.addEventListener('change', render);
      render();
    })();
  </script>
</body>
</html>`;
};
