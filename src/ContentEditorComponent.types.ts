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
  /** Replace the entire document content with the provided HTML. */
  setValue: (html: string) => void;
  /** Return the current document as HTML. */
  getValue: () => string;
  /** Clear the document to an empty state. */
  clear: () => void;
  /** Move focus to the editable area. */
  focus: () => void;
  /** Remove focus from the editable area. */
  blur: () => void;
  /** Whether the editor currently contains no user content. */
  isEmpty: () => boolean;
  /** Whether the editor currently has input focus. */
  isFocused: () => boolean;
  /**
   * Display one or more error messages inside the editor immediately.
   * These are shown alongside any prop-based `errors`.
   * Example: ref.current.setErrors(['Attachment too large', 'Subject is required'])
   */
  setErrors: (messages: string[]) => void;
  /** Remove all errors that were set via `setErrors`. */
  clearErrors: () => void;
  /**
   * Access the underlying Lexical editor instance for advanced usage.
   * Returned type is `any` to avoid leaking internal Lexical types.
   */
  getEditor: () => any;
  /**
   * Insert or update a block identified by `spec.kind`.
   *
   * If a block with the same `kind` exists, it will be updated;
   * otherwise a new block is inserted. `position` controls whether
   * the insertion occurs at the document 'start' or 'end'.
   */
  upsertBlock: (spec: BlockSpec) => void;
  /** Remove a previously inserted block by its `kind` identifier. */
  removeBlock: (kind: string) => void;
  /** Check whether a block with the given `kind` exists. */
  hasBlock: (kind: string) => boolean;
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
  // ── Word / character limits ────────────────────────────────────────────────
  /** Maximum words allowed. Shows a live counter; turns red when exceeded. */
  wordLimit?: number;
  /** Minimum words required. Error shown after blur if not met. */
  minWords?: number;
  /** Maximum characters allowed. Error shown when exceeded. */
  maxChars?: number;
  /** Minimum characters required. Error shown after blur if not met. */
  minChars?: number;

  // ── Required ───────────────────────────────────────────────────────────────
  /** When true, shows a required-field error after blur if the editor is empty. */
  required?: boolean;

  // ── Callbacks ─────────────────────────────────────────────────────────────
  /**
   * Fires when the content crosses the configured word limit boundary.
   * exceeded: true → user just exceeded; false → came back within limit.
   */
  onWordLimitExceeded?: (info: { wordCount: number; wordLimit: number; exceeded: boolean }) => void;

  // ── External errors ────────────────────────────────────────────────────────
  /**
   * Extra error messages to display (on top of any built-in validation).
   * Use this for errors that originate outside the editor (e.g. file too large,
   * subject empty, API failure).
   *
   * Example: errors={['Attachment exceeds 5 MB', 'Subject is required']}
   */
  errors?: string[];

  // ── Custom error messages ──────────────────────────────────────────────────
  /**
   * Override the text of any built-in validation message.
   * Every key accepts a plain string OR a function receiving the live counts.
   *
   * Covered errors:
   * - wordLimitExceeded  — fires when wordCount > wordLimit
   * - required           — fires on blur when editor is empty and required=true
   * - minWords           — fires on blur when wordCount < minWords
   * - maxCharsExceeded   — fires when charCount > maxChars
   * - minCharsRequired   — fires on blur when charCount < minChars
   *
   * Example:
   * ```tsx
   * errorMessages={{
   *   wordLimitExceeded: (count, limit) => `Too long — ${count}/${limit} words used.`,
   *   required: 'Email body cannot be empty.',
   *   minWords: (count, min) => `Write at least ${min} words (${count} so far).`,
   *   maxCharsExceeded: (count, max) => `${count}/${max} characters — please shorten.`,
   *   minCharsRequired: (count, min) => `At least ${min} characters needed (${count} entered).`,
   * }}
   * ```
   */
  errorMessages?: {
    wordLimitExceeded?: string | ((wordCount: number, wordLimit: number) => string);
    required?: string;
    minWords?: string | ((wordCount: number, minWords: number) => string);
    maxCharsExceeded?: string | ((charCount: number, maxChars: number) => string);
    minCharsRequired?: string | ((charCount: number, minChars: number) => string);
  };
}
