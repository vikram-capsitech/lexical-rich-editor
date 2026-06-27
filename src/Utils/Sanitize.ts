/**
 * sanitizeHtml — Custom allowlist-based HTML sanitizer.
 *
 * SECURITY: Every HTML string that enters the editor from an external source
 * (value prop, setValue(), upsertBlock()) MUST be passed through this function
 * before being handed to Lexical's $generateNodesFromDOM or DOMParser.
 *
 * Uses the browser's built-in DOMParser + attribute manipulation to strip
 * disallowed tags and dangerous patterns with zero external dependencies.
 *
 * Threat model:
 *  - Strips unknown tags (unwraps children, does not silently drop them).
 *  - Strips all event-handler attributes (onclick, onerror, onload, …).
 *  - Strips javascript:/vbscript:/data: URI schemes from href and src.
 *  - Sanitizes expression() and url(javascript:…) inside style attributes.
 */

/**
 * Tags that must be deleted in their entirety — including all their children
 * and text content — because even the raw text they contain is executable
 * (script body) or exposes sensitive data (style, meta).
 *
 * These are checked BEFORE the allowlist so they can never slip through as
 * "unknown tag → unwrap" which would leave their text in the output.
 */
const DROP_ENTIRELY = new Set([
  'script',
  'noscript',
  'style',
  'object',
  'embed',
  'form',
  'input',
  'button',
  'select',
  'textarea',
  'meta',
  'link',
  'base',
]);

/** Tags the editor legitimately produces and should round-trip safely. */
const ALLOWED_TAGS = new Set([
  // Block
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'div',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'td',
  'th',
  // Inline
  'span',
  'a',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'del',
  'strike',
  'sub',
  'sup',
  'mark',
  'code',
  'br',
  'hr',
  // Media / embeds
  'img',
  'iframe',
]);

/** Attributes the editor legitimately uses. Everything else is stripped. */
const ALLOWED_ATTRS = new Set([
  // Presentation
  'class',
  'style',
  'dir',
  'lang',
  // Anchors
  'href',
  'target',
  'rel',
  // Images
  'src',
  'alt',
  'width',
  'height',
  // Tables
  'colspan',
  'rowspan',
  // Lists  — <ol type="a"> and <ol start="2">
  'start',
  'type',
  // Lexical-internal data markers
  'data-lex-block',
  'data-kind',
  'data-lexical-decorator',
  // Misc
  'title',
  'allowfullscreen',
]);

/** Schemes that are never safe inside href or src. */
const DANGEROUS_URL = /^\s*(javascript|data\s*:|vbscript)/i;

/**
 * Sanitizes a single DOM element in-place (recursive, bottom-up).
 *
 * Disallowed tags are "unwrapped" — their child nodes are promoted to the
 * parent so text content is never silently lost.
 */
function sanitizeElement(el: Element): void {
  // Process children first so indices don't shift under us during parent removal.
  for (const child of Array.from(el.children)) {
    sanitizeElement(child);
  }

  const tag = el.tagName.toLowerCase();

  // Completely remove dangerous tags — do NOT unwrap because even their
  // text content (e.g. a <script> body) is executable / sensitive.
  if (DROP_ENTIRELY.has(tag)) {
    el.parentNode?.removeChild(el);
    return;
  }

  // Only allow iframes that match the editor's YouTube embed output.
  if (tag === 'iframe') {
    const src = el.getAttribute('src') ?? '';
    const isYouTube =
      /^\s*https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com)\/embed\/[^?&/]+/i.test(src);
    if (!isYouTube) {
      el.parentNode?.removeChild(el);
      return;
    }
  }

  if (!ALLOWED_TAGS.has(tag)) {
    // Unknown tag — unwrap: hoist all children (including text) before this
    // element so visible text is never silently discarded.
    while (el.firstChild) {
      el.parentNode?.insertBefore(el.firstChild, el);
    }
    el.parentNode?.removeChild(el);
    return;
  }

  // Strip disallowed / dangerous attributes.
  for (const { name, value } of Array.from(el.attributes)) {
    const lname = name.toLowerCase();

    if (!ALLOWED_ATTRS.has(lname)) {
      // Covers all on* event handlers and unknown attributes.
      el.removeAttribute(name);
      continue;
    }

    if (lname === 'href' || lname === 'src') {
      if (DANGEROUS_URL.test(value)) {
        el.removeAttribute(name);
      }
    }

    if (lname === 'style') {
      const safe = value
        .replace(/expression\s*\(/gi, '(')
        .replace(/url\s*\(\s*['"]?\s*javascript:/gi, 'url(');
      el.setAttribute('style', safe);
    }
  }

  // Prevent reverse tabnabbing for links that open in a new tab/window.
  if (tag === 'a' && (el.getAttribute('target') || '').toLowerCase() === '_blank') {
    const rel = (el.getAttribute('rel') || '').trim();
    const tokens = new Set(
      rel
        .split(/\s+/)
        .filter(Boolean)
        .map((t) => t.toLowerCase()),
    );
    tokens.add('noopener');
    tokens.add('noreferrer');
    el.setAttribute('rel', Array.from(tokens).join(' '));
  }
}

/**
 * Sanitizes an HTML string using a strict allowlist.
 *
 * @param html - Raw HTML from an untrusted source (value prop, API, clipboard).
 * @returns Sanitized HTML safe to import into the Lexical editor.
 *
 * @example
 * const clean = sanitizeHtml(rawHtmlFromDatabase);
 * editor.update(() => {
 *   const nodes = $generateNodesFromDOM(editor, new DOMParser().parseFromString(clean, 'text/html'));
 *   $getRoot().append(...nodes);
 * });
 */
export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  for (const child of Array.from(doc.body.children)) {
    sanitizeElement(child);
  }
  return doc.body.innerHTML;
}

/**
 * Post-processes HTML output from Lexical before it is handed to consumers
 * (onChange / getValue).
 *
 * Fixes three known issues with Lexical 0.44 output:
 *
 * 1. Bold double-wrap — Lexical's createDOM uses <strong> as the semantic
 *    inner element, then exportDOM wraps with <b> for email-client compat.
 *    Result: <b><strong>text</strong></b>.  Any CSS that uses font-weight:
 *    bolder (e.g. CSS resets, email clients) renders this noticeably heavier.
 *    Fix: unwrap <strong> from inside <b>, merging any attributes into <b>.
 *
 * 2. Italic double-wrap — same pattern: createDOM creates <em>, exportDOM
 *    wraps with <i>.  Result: <i><em>text</em></i>.
 *    Fix: unwrap <em> from inside <i>.
 *
 * 3. <p> default margins — normalizeToBlockHtml wraps all content in <p>.
 *    Inside the editor the theme CSS resets margins; but the stored HTML is
 *    used outside (email body, preview) where those CSS rules don't apply.
 *    Fix: add inline margin:0; line-height:1.25 to every <p> that lacks
 *    an explicit margin declaration.
 */
export function postProcessOutput(html: string): string {
  if (!html) return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');

  // ── 1. Collapse <b><strong> → <b> ─────────────────────────────────────────
  for (const inner of Array.from(doc.querySelectorAll('b > strong'))) {
    const outer = inner.parentElement!;
    _mergeAttributes(inner, outer);
    while (inner.firstChild) outer.insertBefore(inner.firstChild, inner);
    outer.removeChild(inner);
  }

  // ── 2. Collapse <i><em> → <i> ─────────────────────────────────────────────
  for (const inner of Array.from(doc.querySelectorAll('i > em'))) {
    const outer = inner.parentElement!;
    _mergeAttributes(inner, outer);
    while (inner.firstChild) outer.insertBefore(inner.firstChild, inner);
    outer.removeChild(inner);
  }

  // ── 3. Inline margin reset on <p> so output renders correctly everywhere ──
  for (const p of Array.from(doc.querySelectorAll('p'))) {
    const style = (p as HTMLElement).style;
    const hasMargin = !!(
      style.margin ||
      style.marginTop ||
      style.marginRight ||
      style.marginBottom ||
      style.marginLeft
    );
    if (!hasMargin) style.margin = '0';
    if (!style.lineHeight) style.lineHeight = '1.25';
  }

  return doc.body.innerHTML;
}

/** Moves style and class attributes from src element into dst, merging values. */
function _mergeAttributes(src: Element, dst: Element): void {
  for (const { name, value } of Array.from(src.attributes)) {
    if (name === 'style') {
      const prev = dst.getAttribute('style') || '';
      dst.setAttribute('style', prev ? `${prev}; ${value}` : value);
    } else if (name === 'class') {
      const prev = dst.getAttribute('class') || '';
      dst.setAttribute('class', prev ? `${prev} ${value}` : value);
    }
    // other attributes (data-*, etc.) are intentionally not merged
  }
}

const BLOCK_TAGS = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'div',
  'ul',
  'ol',
  'li',
  'table',
  'blockquote',
  'pre',
  'hr',
]);

/**
 * Ensures every top-level node is a block element so the HTML can be safely
 * imported into Lexical's root node (which only accepts block children).
 *
 * Handles three cases:
 *   - Pure plain text / inline-only → wraps everything in one <p>
 *   - Mixed (some blocks + loose text/inline) → wraps each loose node in its own <p>
 *   - Already all blocks → returns the string unchanged (fast path)
 *
 * The mixed case can arise after sanitizeHtml() unwraps unknown block tags
 * (e.g. <section>text<p>para</p></section> → text<p>para</p>).
 */
export function normalizeToBlockHtml(html: string): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const body = doc.body;
  const childNodes = Array.from(body.childNodes);

  // Fast path: every non-whitespace top-level node is already a block.
  const needsWrap = childNodes.some((node) => {
    if (node.nodeType === Node.TEXT_NODE) return !!node.nodeValue?.trim();
    if (node.nodeType === Node.ELEMENT_NODE)
      return !BLOCK_TAGS.has((node as Element).tagName.toLowerCase());
    return false;
  });
  if (!needsWrap) return html;

  // Detach all children first (the references in childNodes[] remain valid).
  while (body.firstChild) body.removeChild(body.firstChild);

  // Re-append: block nodes stay as-is; consecutive inline/text nodes are
  // grouped into a single <p> that is flushed when the next block arrives.
  let pendingP: HTMLParagraphElement | null = null;
  for (const node of childNodes) {
    const isBlock =
      node.nodeType === Node.ELEMENT_NODE &&
      BLOCK_TAGS.has((node as Element).tagName.toLowerCase());
    const isWhitespace = node.nodeType === Node.TEXT_NODE && !node.nodeValue?.trim();

    if (isBlock) {
      if (pendingP) {
        body.appendChild(pendingP);
        pendingP = null;
      }
      body.appendChild(node);
    } else if (!isWhitespace) {
      if (!pendingP) pendingP = doc.createElement('p');
      pendingP.appendChild(node);
    }
  }
  if (pendingP) body.appendChild(pendingP);

  return body.innerHTML;
}
