const BLOCKED_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'IFRAME',
  'OBJECT',
  'EMBED',
  'FORM',
  'INPUT',
  'BUTTON',
  'TEXTAREA',
  'SELECT',
  'META',
  'LINK'
]);

const UNSAFE_STYLE_PATTERNS = [
  /expression\s*\(/i,
  /@import/i,
  /-moz-binding/i,
  /behavior\s*:/i,
  /url\s*\(\s*(['"]?)\s*(javascript:|vbscript:|data:(?!image\/))/i
];

const BLOCKED_STYLE_PROPERTIES = new Set([
  'position',
  'z-index',
  'top',
  'left',
  'right',
  'bottom',
  'inset'
]);

const isSafeStyleDeclaration = (property: string, value: string): boolean => {
  const normalizedProperty = property.trim().toLowerCase();
  if (!normalizedProperty) return false;

  const isCssVariable = normalizedProperty.startsWith('--');
  if (!isCssVariable && !/^[a-z-]+$/.test(normalizedProperty)) {
    return false;
  }
  if (!isCssVariable && BLOCKED_STYLE_PROPERTIES.has(normalizedProperty)) {
    return false;
  }

  const normalizedValue = value.trim();
  if (!normalizedValue) return false;
  return !UNSAFE_STYLE_PATTERNS.some(pattern => pattern.test(normalizedValue));
};

const sanitizeInlineStyle = (styleValue: string): string => {
  const declarations = styleValue.split(';');
  const safeDeclarations: string[] = [];

  for (const declaration of declarations) {
    const separatorIndex = declaration.indexOf(':');
    if (separatorIndex <= 0) continue;

    const property = declaration.slice(0, separatorIndex).trim();
    const value = declaration.slice(separatorIndex + 1).trim();
    if (!isSafeStyleDeclaration(property, value)) continue;
    safeDeclarations.push(`${property}: ${value}`);
  }

  return safeDeclarations.join('; ');
};

const isSafeUrl = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) return false;

  const lowered = trimmed.toLowerCase();
  if (
    lowered.startsWith('#') ||
    lowered.startsWith('/') ||
    lowered.startsWith('./') ||
    lowered.startsWith('../')
  ) {
    return true;
  }
  if (lowered.startsWith('data:image/')) return true;

  try {
    const url = new URL(trimmed, window.location.origin);
    return (
      url.protocol === 'http:' ||
      url.protocol === 'https:' ||
      url.protocol === 'mailto:' ||
      url.protocol === 'tel:'
    );
  } catch {
    return false;
  }
};

const isSafeSrcset = (value: string): boolean => {
  const candidates = value.split(',');
  for (const candidate of candidates) {
    const part = candidate.trim();
    if (!part) return false;
    const urlPart = part.split(/\s+/)[0];
    if (!isSafeUrl(urlPart)) return false;
  }
  return true;
};

export const sanitizeHtml = (html: string): string => {
  const domPurify = (globalThis as any).DOMPurify as { sanitize?: (input: string, options?: Record<string, unknown>) => string } | undefined;
  if (!domPurify || typeof domPurify.sanitize !== 'function') {
    // Fallback sanitizer for test/runtime environments where @require did not execute.
    // Keep benign markup, remove dangerous nodes/attributes.
    const template = document.createElement('template');
    template.innerHTML = html;

    const elements = Array.from(template.content.querySelectorAll('*'));
    for (const element of elements) {
      if (BLOCKED_TAGS.has(element.tagName)) {
        element.remove();
        continue;
      }

      const attrs = Array.from(element.attributes);
      for (const attr of attrs) {
        const name = attr.name.toLowerCase();
        const value = attr.value;

        if (name.startsWith('on') || name === 'srcdoc') {
          element.removeAttribute(attr.name);
          continue;
        }

        if (name === 'style') {
          const safeStyle = sanitizeInlineStyle(value);
          if (safeStyle) {
            element.setAttribute('style', safeStyle);
          } else {
            element.removeAttribute(attr.name);
          }
          continue;
        }

        if ((name === 'href' || name === 'src' || name === 'xlink:href') && !isSafeUrl(value)) {
          element.removeAttribute(attr.name);
          continue;
        }

        if (name === 'srcset' && !isSafeSrcset(value)) {
          element.removeAttribute(attr.name);
        }
      }
    }

    return template.innerHTML;
  }

  return domPurify.sanitize(html, {
    USE_PROFILES: { html: true },
  });
};
