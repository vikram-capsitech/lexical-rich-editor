import type { InitialConfigType } from '@lexical/react/LexicalComposer';
import type { LexicalEditor } from 'lexical';

/** How the suggestion was accepted */
/**
 * How an inline suggestion was accepted/committed by the user.
 *
 * - 'tab': Accepted via the Tab key (or ArrowRight)
 * - 'enter': Accepted via the Enter key
 * - 'click': Accepted by clicking on a suggestion item
 */
export type AcceptMethod = 'tab' | 'enter' | 'click';
/** What the consumer returns for autocomplete requests */
export type SearchPromise = {
  promise: Promise<string[] | null>;
  dismiss: () => void;
};
// ─── Spell / Grammar check types ────────────────────────────────────────────
/**
 * A single spelling, grammar, or style issue returned by your API.
 *
 * `offset` and `length` are character positions in the plain-text
 * representation of the document (`editor.getRootElement().innerText`).
 */
export type SpellCheckIssue = {
  /** Character offset in the document's plain text */
  offset: number;
  /** Number of characters the issue spans */
  length: number;
  /** Human-readable description shown in the suggestion popover */
  message: string;
  /** Replacement candidates, best first */
  suggestions: string[];
  /** Visual style of the underline: red = spelling, blue = grammar, yellow = style */
  type?: 'spelling' | 'grammar' | 'style';
  /** Actual word as it appears in the text (set by adapter) */
  word?: string;
};
/**
 * Return value of `useSpellCheck`.
 *
 * `promise` resolves to an object containing:
 *  - `issues`      — individual misspelled words to underline
 *  - `improvedText`— the fully corrected sentence (like Grammarly's "Accept all")
 */
export type SpellCheckPayload = {
  issues: SpellCheckIssue[];
  /** Full corrected sentence from grammar check */
  grammarCorrection?: string;
  /** Legacy: full improved text. Prefer grammarCorrection. */
  improvedText?: string;
};
export type SpellCheckResult = {
  promise: Promise<SpellCheckPayload | null>;
  dismiss: () => void;
};
// ─── Editor level ────────────────────────────────────────────────────────────
/**
 * Editor capability levels controlling which toolbar features are enabled.
 *
 * - none: No toolbar shown
 * - basic: Minimal formatting (bold/italic/underline), lists, links
 * - standard: Common formatting plus media (images, tables, etc.)
 * - pro: Full feature set (advanced blocks and tools)
 */
export enum ContentEditorLevel {
  None = 'none',
  Basic = 'basic',
  Standard = 'standard',
  Pro = 'pro',
}
/**
 * INTERNAL: Block specification used by the ref API.
 *
 * Not exported from the package root to avoid locking
 * implementation details. Subject to change without notice.
 */
type BlockSpec = {
  kind: string;
  html: string;
  position?: 'start' | 'end';
};
/**
 * Public, imperative API exposed via the component ref.
 *
 * Allows programmatic read/write, focus control, and state checks.
 */
export type ContentEditorRef = {
  /**
   * Replace the entire document with the provided HTML string.
   *
   * The HTML is sanitized before import, so event handlers and dangerous
   * URL schemes are automatically stripped.
   *
   * ⚠️ Do NOT call this inside an effect that watches the same `value` prop —
   * it will create an infinite update loop.  Use the controlled `value` prop
   * for external state synchronization instead.
   *
   * @param html - HTML to load.  Pass an empty string to clear the editor.
   *
   * @example
   * editorRef.current?.setValue('<p>Hello <strong>world</strong></p>');
   */
  setValue: (html: string) => void;

  /**
   * Return the current document as an HTML string.
   *
   * The returned HTML is Lexical-normalized (class names, data-attributes, etc.)
   * and is safe to store and later reload via `value` prop or `setValue()`.
   *
   * @example
   * const html = editorRef.current?.getValue();
   * await saveToDatabase(html);
   */
  getValue: () => string;

  /**
   * Clear the editor to a completely empty state.
   *
   * Equivalent to `setValue('')` but more efficient — skips HTML parsing.
   */
  clear: () => void;

  /**
   * Move keyboard focus into the editable content area.
   *
   * Useful for auto-focus after a modal opens or a dialog is confirmed.
   */
  focus: () => void;

  /**
   * Remove keyboard focus from the editable content area.
   */
  blur: () => void;

  /**
   * Returns `true` when the editor contains no visible user content.
   *
   * Note: system blocks inserted via `upsertBlock` may still affect this check
   * unless the implementation explicitly excludes `HtmlBlockNode` content.
   *
   * @example
   * if (editorRef.current?.isEmpty()) {
   *   alert('Please write something before sending.');
   * }
   */
  isEmpty: () => boolean;

  /**
   * Returns `true` when the editor's content area currently has input focus.
   */
  isFocused: () => boolean;

  /**
   * Access the underlying Lexical `LexicalEditor` instance.
   *
   * Use only for advanced integrations (custom commands, plugins, etc.).
   * The return type is `any` to avoid coupling consumers to Lexical's internal
   * types; cast to `LexicalEditor` from the `lexical` package if needed.
   *
   * @example
   * import { $getRoot } from 'lexical';
   * const lexical = editorRef.current?.getEditor();
   * lexical?.getEditorState().read(() => console.log($getRoot().getTextContent()));
   */
  getEditor: () => any;

  /**
   * Insert or update a named system block in the document.
   *
   * System blocks (signature, footer, banner, etc.) are tracked by `kind` and
   * rendered as non-editable regions. The user can delete them but cannot type
   * inside them. They do **not** affect `checkDirty()` or `isEmpty()`.
   *
   * If a block with the same `kind` already exists it is replaced in-place;
   * otherwise a new block is appended (or prepended if `position = 'start'`).
   *
   * @param spec.kind     - Unique identifier, e.g. `'signature'` or `'footer'`.
   * @param spec.html     - HTML content for the block. Sanitized before import.
   * @param spec.position - Where to insert when creating: `'start'` | `'end'` (default `'end'`).
   *
   * @example
   * editorRef.current?.upsertBlock({
   *   kind: 'signature',
   *   html: '<p><strong>Vikram Singh</strong></p><p>Senior Engineer</p>',
   *   position: 'end',
   * });
   */
  upsertBlock: (spec: BlockSpec) => void;

  /**
   * Remove a system block by its `kind` identifier.
   *
   * No-op if no block with that `kind` exists.
   *
   * @param kind - The same identifier used when calling `upsertBlock`.
   *
   * @example
   * editorRef.current?.removeBlock('signature');
   */
  removeBlock: (kind: string) => void;

  /**
   * Returns `true` if a system block with the given `kind` is present in the document.
   *
   * @example
   * const hasSig = editorRef.current?.hasBlock('signature'); // true | false
   */
  hasBlock: (kind: string) => boolean;

  /**
   * Returns `true` when the editor's user content differs from the clean baseline.
   *
   * **What counts as user content:**
   * Text the user typed in paragraphs, headings, lists, etc., plus any media
   * (images, YouTube embeds) inserted via the toolbar. System blocks added via
   * `upsertBlock` are **excluded** from the comparison.
   *
   * **What is always `false` (clean):**
   * - Empty editor (placeholder visible).
   * - Editor containing only a default / pre-loaded value that has not been changed.
   * - Editor cleared back to empty after the user had typed something.
   *
   * **Baseline:** captured automatically after the editor finishes loading its
   * initial content. Call `markClean()` to reset it after a successful save.
   *
   * @example
   * window.onbeforeunload = () => {
   *   if (editorRef.current?.checkDirty()) return 'You have unsaved changes.';
   * };
   */
  checkDirty: () => boolean;

  /**
   * Reset the dirty baseline to the editor's current content.
   *
   * Call this after successfully saving so that `checkDirty()` compares against
   * the saved state going forward, rather than the original mount-time value.
   *
   * @example
   * const html = editorRef.current?.getValue();
   * await api.save(html);
   * editorRef.current?.markClean(); // checkDirty() now returns false
   */
  markClean: () => void;
};
// ─── Validation ─────────────────────────────────────────────────────────────

/**
 * Built-in default messages used when no custom `validationMessages` entry is
 * provided for that rule. Export this to inspect or copy individual defaults.
 */
export const DEFAULT_VALIDATION_MESSAGES = {
  required:      'This field is required.',
  minWords:      (current: number, min: number) =>
    `Minimum ${min} word${min === 1 ? '' : 's'} required (${current} entered).`,
  maxWords:      (current: number, max: number) =>
    `Word limit exceeded: ${current} / ${max} words.`,
  minChars:      (current: number, min: number) =>
    `Minimum ${min} character${min === 1 ? '' : 's'} required (${current} entered).`,
  maxChars:      (current: number, max: number) =>
    `Character limit exceeded: ${current} / ${max} characters.`,
  noImages:      'Images are not allowed in this field.',
  maxImages:     (current: number, max: number) =>
    `Too many images: ${current} / ${max} allowed.`,
  noLinks:       'Hyperlinks are not allowed in this field.',
  maxLinks:      (current: number, max: number) =>
    `Too many links: ${current} / ${max} allowed.`,
  noTables:      'Tables are not allowed in this field.',
  imageTooLarge: (fileMB: number, maxMB: number) =>
    `Image size (${fileMB.toFixed(1)} MB) exceeds the ${maxMB} MB limit.`,
} as const;

/** A single active validation error on the editor. */
export type EditorValidationError = {
  type:
    | 'required'
    | 'minWords' | 'maxWords'
    | 'minChars' | 'maxChars'
    | 'noImages'  | 'maxImages'
    | 'noLinks'   | 'maxLinks'
    | 'noTables';
  message: string;
};

/**
 * Custom messages for each validation rule.
 * Each entry accepts either a static string or a function that receives
 * the relevant counts and returns a string.
 */
export type ValidationMessages = {
  // ── Word count ─────────────────────────────────────────────────────────
  /** Shown when the editor is empty and `required` is true. */
  required?: string;
  /** Shown when word count is below `minWords`. Receives (current, min). */
  minWords?: string | ((current: number, min: number) => string);
  /** Shown when word count exceeds `maxWords`. Receives (current, max). */
  maxWords?: string | ((current: number, max: number) => string);
  // ── Character count ────────────────────────────────────────────────────
  /** Shown when character count is below `minChars`. Receives (current, min). */
  minChars?: string | ((current: number, min: number) => string);
  /** Shown when character count exceeds `maxChars`. Receives (current, max). */
  maxChars?: string | ((current: number, max: number) => string);
  // ── Images ─────────────────────────────────────────────────────────────
  /** Shown when content contains images and `noImages` is true. */
  noImages?: string;
  /** Shown when image count exceeds `maxImages`. Receives (current, max). */
  maxImages?: string | ((current: number, max: number) => string);
  // ── Links ──────────────────────────────────────────────────────────────
  /** Shown when content contains links and `noLinks` is true. */
  noLinks?: string;
  /** Shown when link count exceeds `maxLinks`. Receives (current, max). */
  maxLinks?: string | ((current: number, max: number) => string);
  // ── Tables ─────────────────────────────────────────────────────────────
  /** Shown when content contains tables and `noTables` is true. */
  noTables?: string;
  // ── Image upload ───────────────────────────────────────────────────────
  /** Shown in the image dialog when an uploaded file exceeds `maxImageSizeMB`. Receives (fileMB, maxMB). */
  imageTooLarge?: string | ((fileMB: number, maxMB: number) => string);
};

// ─── Component props ─────────────────────────────────────────────────────────
export interface ContentEditorProps {
  /** Optional editor namespace used by Lexical for scoping. */
  namespace?: string;
  /** Controlled HTML value rendered by the editor. */
  value: string;
  /** Outer container width (e.g., '100%', '600px'). */
  width?: string;
  /** Outer container height (e.g., '100%', '400px'). */
  height?: string;
  /** When true, focuses the editor on mount. */
  autoFocus?: boolean;
  /** CSS margin applied to the root container. */
  margin?: string | number;
  /** Placeholder text shown when the editor is empty. */
  placeholder?: string;
  /** Height of the editable content area inside the container. */
  contentHeight?: string;
  /** Feature level controlling which toolbar groups are enabled. */
  level?: ContentEditorLevel;
  /**
   * Fully custom toolbar layout that overrides the `level` preset.
   *
   * Pass a 2-D array of **token strings**. Each inner array is rendered in order.
   * Use `'|'` inside a group (including at the end) to render a divider.
   * Every token renders as its own **standalone** control — there are no
   * hidden dropdowns.  Items like `'Strikethrough'` or `'H1'` that were
   * previously only reachable inside aggregate dropdowns can now be placed
   * directly in the toolbar.  Unknown tokens are silently ignored.
   *
   * ---
   * ### Text formatting (standalone toggle buttons)
   *
   * | Token            | What it renders                  |
   * |------------------|----------------------------------|
   * | `'Bold'`         | Bold toggle                      |
   * | `'Italic'`       | Italic toggle                    |
   * | `'Underline'`    | Underline toggle                 |
   * | `'Strikethrough'`| Strikethrough toggle             |
   * | `'Subscript'`    | Subscript toggle                 |
   * | `'Superscript'`  | Superscript toggle               |
   * | `'Highlight'`    | Highlight toggle                 |
   * | `'Uppercase'`    | Uppercase transform toggle       |
   * | `'Lowercase'`    | Lowercase transform toggle       |
   * | `'Capitalize'`   | Capitalize transform toggle      |
   *
   * ### Lists (standalone toggle buttons)
   *
   * | Token               | What it renders          |
   * |---------------------|--------------------------|
   * | `'BulletList'`      | Unordered list toggle    |
   * | `'NumberList'`      | Ordered list toggle      |
   * | `'AlphabeticalList'`| Alphabetical list toggle |
   *
   * ### Block-level (standalone buttons)
   *
   * | Token        | What it renders                     |
   * |--------------|-------------------------------------|
   * | `'Quote'`    | Blockquote toggle                   |
   * | `'PageBreak'`| Insert page-break                   |
   *
   * ### Heading levels (standalone toggle buttons)
   *
   * Clicking an active heading level reverts the block to normal paragraph.
   *
   * | Token | What it renders         |
   * |-------|-------------------------|
   * | `'H1'`| Heading 1 toggle button |
   * | `'H2'`| Heading 2 toggle button |
   * | `'H3'`| Heading 3 toggle button |
   * | `'H4'`| Heading 4 toggle button |
   * | `'H5'`| Heading 5 toggle button |
   * | `'H6'`| Heading 6 toggle button |
   *
   * ### Dropdowns / rich plugins
   *
   * | Token           | What it renders                                   |
   * |-----------------|---------------------------------------------------|
   * | `'Heading'`     | Dropdown: Normal + H1–H6 (all heading levels)     |
   * | `'Decorators'`  | Dropdown: all text / list / block decorator items |
   * | `'Align'`       | Dropdown: left / center / right / justify         |
   * | `'FontFamily'`  | Font-family dropdown                              |
   * | `'FontSize'`    | Font-size dropdown                                |
   * | `'ColorPicker'` | Text color picker                                 |
   * | `'Link'`        | Insert / edit hyperlink                           |
   * | `'Table'`       | Insert table                                      |
   * | `'Image'`       | Upload block image                                |
   * | `'InlineImage'` | Insert inline image                               |
   * | `'Youtube'`     | Embed YouTube video                               |
   * | `'|'`           | Inline divider within a group                     |
   *
   * ---
   * ### Examples
   *
   * **Only bold, italic, underline and strikethrough as standalone buttons:**
   * ```tsx
   * customToolbar={[['Bold', 'Italic', 'Underline', 'Strikethrough']]}
   * ```
   *
   * **Pick specific heading levels without a dropdown:**
   * ```tsx
   * customToolbar={[['H1', 'H2', 'H3'], ['Bold', 'Italic']]}
   * ```
   *
   * **Mix standalone items and aggregate dropdowns:**
   * ```tsx
   * customToolbar={[
   *   ['Bold', 'Italic', 'Underline', 'Strikethrough', 'Highlight'],
   *   ['BulletList', 'NumberList'],
   *   ['H1', 'H2', 'H3'],
   *   ['Link', 'Image'],
   * ]}
   * ```
   *
   * **Full toolbar using aggregate dropdowns:**
   * ```tsx
   * customToolbar={[
   *   ['Heading', 'FontFamily', 'FontSize'],
   *   ['Bold', 'Italic', 'Underline', '|', 'ColorPicker'],
   *   ['Align'],
   *   ['Link', 'Image', 'InlineImage', 'Youtube', 'Table'],
   *   ['Decorators'],
   * ]}
   * ```
   *
   * ---
   * ### Notes
   * - When `customToolbar` is set the `level` prop has no effect.
   * - Token order within each group is preserved exactly as written.
   * - Avoid duplicate tokens in the same render (each renders once per occurrence).
   */
  customToolbar?: string[][];
  /**
   * @deprecated Not used by the component. Prefer styling overrides instead.
   */
  topPlaceholderMargin?: string;
  /** Change handler returning the latest HTML value. */
  onChange: (value: string) => void;
  /** When true, the editor becomes read-only (non-interactive). */
  readOnly?: boolean;
  /**
   * @deprecated Legacy flag intended to show a clear button.
   * This is currently not wired in the UI.
   */
  clearEditorMode?: boolean;
  // ── Autocomplete ───────────────────────────────────────────────────────────
  /**
   * Simple autocomplete — just pass your raw async API call.
   *
   * The component handles all debouncing, cancellation, and ghost-text
   * insertion internally. Return the raw API response — supported shapes:
   *   - `{ generated_text: string }` — single suggestion
   *   - `string[]`                   — list of suggestions
   *   - `null / undefined`           — no suggestion
   *
   * Example:
   * ```ts
   * suggestFn={async (text) => {
   *   const res = await fetch('/api/suggest', { method: 'POST', body: JSON.stringify({ text }) });
   *   return res.json(); // return raw — component adapts internally
   * }}
   * ```
   */
  suggestFn?: (text: string, cursorIndex?: number) => Promise<any>;
  /**
   * Advanced: full control over autocomplete with manual cancellation.
   * Use `suggestFn` instead unless you need a custom `dismiss()` implementation.
   */
  useQuery?: (searchText?: string, cursorIndex?: number) => SearchPromise;
  /** Called when the editor gains focus. */
  onFocus?: () => void;
  /** Called when the editor loses focus. */
  onBlur?: () => void;
  /**
   * Fires when the user **accepts** an autocomplete suggestion (Tab / ArrowRight).
   *
   * Use this to send a reward signal to your backend so the model improves
   * over time. Example:
   * ```ts
   * onSuggestionAccept={({ suggestionText, triggerText, method }) => {
   *   sendReward({ suggestionText, triggerText }); // hits your reward API
   * }}
   * ```
   */
  onSuggestionAccept?: (info: {
    suggestionText: string;
    triggerText?: string;
    method: AcceptMethod;
  }) => void;
  /**
   * Fires when a suggestion is displayed to the user (optional analytics hook).
   */
  onSuggestionShown?: (info: { suggestionText: string; triggerText?: string }) => void;
  // ── Spell / Grammar check ──────────────────────────────────────────────────
  /**
   * Simple spell/grammar check — just pass your raw async API call.
   *
   * The component handles all debouncing, cancellation, response adaptation,
   * underlines, and popovers internally. Supported API response shapes:
   *   - `{ misspelled_words: string[], suggestions: Record<string, string[]>, grammar_correction?: string }`
   *   - `{ misspelled: string[], suggestions: Record<string, string[]>, improved_text?: string }`
   *   - `SpellCheckIssue[]` (legacy — already-adapted array)
   *
   * Example:
   * ```ts
   * spellCheckFn={async (text) => {
   *   const res = await fetch('/api/spellcheck', { method: 'POST', body: JSON.stringify({ text }) });
   *   return res.json(); // return raw — component adapts internally
   * }}
   * ```
   */
  spellCheckFn?: (text: string) => Promise<any>;
  /**
   * Advanced: full control over spell check with manual cancellation.
   * Use `spellCheckFn` instead unless you need a custom `dismiss()` implementation.
   */
  useSpellCheck?: (text: string) => SpellCheckResult;
  /**
   * Fires when the user accepts a spell/grammar correction from the popover.
   *
   * Use this to POST a reward signal to your backend.
   * ```ts
   * onSpellCheckAccept={({ original, replacement, message, type }) => {
   *   myApi.rewardSpellCheck({ original, replacement });
   * }}
   * ```
   */
  onSpellCheckAccept?: (info: {
    original: string;
    replacement: string;
    message: string;
    type?: string;
  }) => void;
  /**
   * Debounce delay (ms) after the user stops typing before the spell-check
   * API is called. Defaults to 1200ms. Tune this to balance responsiveness
   * vs. API call frequency.
   */
  spellCheckIdleMs?: number;
  /**
   * Debounce delay (ms) after the user stops typing before the `suggestFn`
   * API is called. Defaults to 300ms. Tune this to balance responsiveness
   * vs. API call frequency.
   */
  suggestIdleMs?: number;
  /** When false, spell checking is disabled without unmounting the plugin. */
  spellCheckEnabled?: boolean;
  // ── Floating toolbar ───────────────────────────────────────────────────────
  /** When true, shows the floating formatting toolbar near text selections. */
  showFloatingToolbar?: boolean;
  /**
   * Maximum word count allowed. When set, a live counter is shown
   * below the editor. Exceeding the limit turns the counter red.
   * Example: wordLimit={500}
   */
  wordLimit?: number;

  /**
   * Fires when the content crosses the configured word limit boundary.
   *
   * - exceeded: true  -> user just exceeded the limit
   * - exceeded: false -> user came back within the limit
   */
  onWordLimitExceeded?: (info: { wordCount: number; wordLimit: number; exceeded: boolean }) => void;

  // ── Validation ─────────────────────────────────────────────────────────────

  /** When true, the editor must not be empty. Equivalent to `minWords: 1`. */
  required?: boolean;

  /** Minimum number of words required. */
  minWords?: number;

  /** Maximum number of words allowed. Shows a validation error when exceeded. */
  maxWords?: number;

  /** Minimum number of characters required. */
  minChars?: number;

  /** Maximum number of characters allowed. Shows a validation error when exceeded. */
  maxChars?: number;

  /** When true, the editor must not contain any images. */
  noImages?: boolean;

  /** Maximum number of images allowed in the content. */
  maxImages?: number;

  /** When true, the editor must not contain any hyperlinks. */
  noLinks?: boolean;

  /** Maximum number of hyperlinks allowed in the content. */
  maxLinks?: number;

  /** When true, the editor must not contain any tables. */
  noTables?: boolean;

  /**
   * Maximum image file size in megabytes. When set, the image upload dialogs
   * reject files that are larger and display an error inside the dialog.
   */
  maxImageSizeMB?: number;

  /**
   * Override the default error messages shown for each validation rule.
   * Accepts static strings or functions for dynamic messages.
   */
  validationMessages?: ValidationMessages;

  /**
   * Called whenever the set of active validation errors changes.
   * Receives the current array of errors (empty array means valid).
   */
  onValidationChange?: (errors: EditorValidationError[]) => void;

  /**
   * Pass any string here to display it as a custom error message below the
   * editor and turn the border red. Useful for server-side or form-level
   * errors that live outside the component's own validation rules.
   *
   * Example:
   * ```tsx
   * errorMessage={submitFailed ? 'Please fill in the email body before sending.' : undefined}
   * ```
   */
  errorMessage?: string;
  /**
   * Called once before `LexicalComposer` is initialized.
   *
   * Receives the `InitialConfigType` object that will be passed to
   * `LexicalComposer`. You may mutate it (e.g. add custom nodes, override the
   * theme or namespace) — Lexical reads this config only once on mount, so
   * this is the only safe window to modify it.
   *
   * Note: called only on the initial mount, never on re-renders.
   */
  onBeforeInitialize?: (config: InitialConfigType) => void;

  /**
   * Called once when the Lexical editor instance is ready for use.
   *
   * Receives the live `LexicalEditor` instance. Use it for operations that
   * require the editor to be mounted — programmatic focus, registering
   * external commands, or handing the instance to an external controller.
   *
   * Note: called only once on mount, never on re-renders.
   */
  onReady?: (editor: LexicalEditor) => void;
}
