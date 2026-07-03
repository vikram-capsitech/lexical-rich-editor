import { css, mergeStyleSets, Stack } from '@fluentui/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { ErrorCircleRegular } from "@fluentui/react-icons";
import { CodeHighlightNode, CodeNode } from '@lexical/code';
import { AutoLinkNode, LinkNode } from '@lexical/link';
import { ListItemNode, ListNode } from '@lexical/list';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { AutoLinkPlugin, createLinkMatcherWithRegExp } from '@lexical/react/LexicalAutoLinkPlugin';
import { LexicalComposer, type InitialConfigType } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { TablePlugin } from '@lexical/react/LexicalTablePlugin';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { TableCellNode, TableNode, TableRowNode } from '@lexical/table';
import { $setSelection, type LexicalEditor } from 'lexical';
import React, { forwardRef, useCallback, useEffect, useRef, useState } from 'react';

import {
  ContentEditorLevel,
  ContentEditorProps,
  ContentEditorRef,
  DEFAULT_VALIDATION_MESSAGES,
  EditorValidationError,
  SearchPromise,
  SpellCheckIssue,
  SpellCheckPayload,
  SpellCheckResult,
} from './ContentEditorComponent.types';

import './Editor.css';
import { DEFAULT_PAGE_SETUP, PageSetupValue, resolvePageCanvasMetrics } from "./Types/PageSetup";
import { AlphaListNode } from './Nodes/AlphaListNode';
import { AutocompleteNode } from './Nodes/AutoCompleteNode';
import { HtmlBlockNode } from './Nodes/HtmlBlockNode';
import { ImageNode } from './Nodes/ImageNode';
import { InlineImageNode } from './Nodes/InlineImageNode';
import { PageBreakNode } from './Nodes/PageBreakNode';
import { SpellErrorNode } from './Nodes/SpellErrorNode';
import { YouTubeNode } from './Nodes/YoutubeNode';

import AutocompletePlugin from './Plugins/AutoComplete';
import CharacterStylesPopupPlugin from './Plugins/CharacterStylesPopupPlugin';
import { CustomOnChangePlugin } from './Plugins/CustomOnChange';
import { FloatingLinkEditorPlugin } from './Plugins/FloatLinkEditor';
import ImagesPlugin from './Plugins/ImagePlugin';
import InlineImagePlugin from './Plugins/InlineImage';
import PageBreakPlugin from './Plugins/PageBreak';
import RefApiPlugin from './Plugins/RefApiPlugin';
import SpellCheckPlugin from './Plugins/Spellcheckplugin';
import TableActionMenuPlugin from './Plugins/TableActionMenuPlugin';
import TableCellResizerPlugin from './Plugins/TableCellResizer';
import { ToolBarPlugins } from './Plugins/ToolBar';
import YoutubeDeletePlugin from './Plugins/YoutubeDeletePlugin';
import { $getRoot } from "lexical";
import { theme } from './Theme';

function ReadOnlyPlugin({ readonly }: { readonly: boolean }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    editor.setEditable(!readonly);
  }, [editor, readonly]);
  return null;
}

function BrowserSpellCheckPlugin({ enabled }: { enabled: boolean }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    const el = editor.getRootElement();
    if (!el) return;
    el.spellcheck = enabled;
    return editor.registerRootListener((nextRoot, prevRoot) => {
      if (prevRoot) prevRoot.spellcheck = false;
      if (nextRoot) nextRoot.spellcheck = enabled;
    });
  }, [editor, enabled]);
  return null;
}

type ContentMetrics = {
  words: number;
  chars: number;
  images: number;
  links: number;
  tables: number;
};

function ContentMetricsPlugin({
  onMetricsChange,
}: {
  onMetricsChange: (m: ContentMetrics) => void;
}) {
  const [editor] = useLexicalComposerContext();
  const prevRef = useRef<ContentMetrics>({ words: 0, chars: 0, images: 0, links: 0, tables: 0 });

  useEffect(() => {
    return editor.registerUpdateListener(({ dirtyElements, dirtyLeaves }) => {
      if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return;

      const root = editor.getRootElement();
      if (!root) return;
      const text = root.innerText ?? '';
      const trimmed = text.trim();
      const words = trimmed === '' ? 0 : trimmed.split(/\s+/).length;
      const chars = trimmed.length;
      const images = root.querySelectorAll('img').length;
      const links = root.querySelectorAll('a[href]').length;
      const tables = root.querySelectorAll('table').length;

      // Only notify (and trigger a re-render) when a value actually changed.
      const prev = prevRef.current;
      if (
        prev.words !== words ||
        prev.chars !== chars ||
        prev.images !== images ||
        prev.links !== links ||
        prev.tables !== tables
      ) {
        const next = { words, chars, images, links, tables };
        prevRef.current = next;
        onMetricsChange(next);
      }
    });
  }, [editor, onMetricsChange]);
  return null;
}

function FocusEventsPlugin({
  onFocus,
  onBlur,
  setFocused,
  containerRef,
}: {
  onFocus?: () => void;
  onBlur?: () => void;
  setFocused: (focused: boolean) => void;
  containerRef: React.RefObject<HTMLDivElement>;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const root = editor.getRootElement();
    if (!root) return;

    const handleFocusIn = () => {
      setFocused(true);
      onFocus?.();
    };

    const handleFocusOut = (e: FocusEvent) => {
      const next = e.relatedTarget as Element | null;
      // Stay active if focus moved anywhere inside the whole editor container
      // (e.g. toolbar buttons), not just within the ContentEditable root.
      const container = containerRef.current;
      const stillInside = !!next && (container ? container.contains(next) : root.contains(next));
      // Also stay active if focus moved to one of our portal widgets (table
      // action menu, floating toolbar, etc.) — they live outside containerRef
      // in the DOM but are logically part of this editor.
      const isEditorPortal = !!next?.closest?.('[data-lexical-editor-portal]');
      if (stillInside || isEditorPortal) return;

      editor.update(() => {
        $setSelection(null);
      });

      setFocused(false);
      onBlur?.();
    };

    root.addEventListener('focusin', handleFocusIn);
    root.addEventListener('focusout', handleFocusOut);

    return () => {
      root.removeEventListener('focusin', handleFocusIn);
      root.removeEventListener('focusout', handleFocusOut);
    };
  }, [editor, onBlur, onFocus, setFocused, containerRef]);

  return null;
}

const URL_REGEX =
  /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/;

const EMAIL_REGEX =
  /(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))/;

const MATCHERS = [
  createLinkMatcherWithRegExp(URL_REGEX, (text) => text),
  createLinkMatcherWithRegExp(EMAIL_REGEX, (text) => `mailto:${text}`),
];

// ─── Internal adapters for spellCheckFn / suggestFn ──────────────────────────
// These let consumers pass a plain async function instead of the full
// SpellCheckResult / SearchPromise shape. The component wraps it internally.

function _escRx(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function _matchFrom(
  text: string,
  regex: RegExp,
  from: number,
): { offset: number; actualWord: string } | null {
  const m = text.slice(from).match(regex);
  if (!m || m.index == null) return null;
  return { offset: from + m.index, actualWord: m[0] };
}

function _adaptRawSpell(data: any, text: string): SpellCheckPayload | null {
  if (!data) return null;
  if (Array.isArray(data)) return { issues: data as SpellCheckIssue[] };

  const hasSpelling = !!(data.misspelled_words?.length || data.misspelled?.length);
  const hasGrammar = !!(data.grammar_correction || data.improved_text);
  if (!hasSpelling && !hasGrammar) return null;

  const words: string[] = data.misspelled_words ?? data.misspelled ?? [];
  const seen: Record<string, number> = {};
  const issues: SpellCheckIssue[] = [];

  for (const apiWord of words) {
    const from = seen[apiWord] ?? 0;
    const match =
      _matchFrom(text, new RegExp(`\\b${_escRx(apiWord)}\\b`, 'i'), from) ??
      _matchFrom(text, new RegExp(_escRx(apiWord), 'i'), from);
    if (!match) continue;
    seen[apiWord] = match.offset + match.actualWord.length;
    issues.push({
      offset: match.offset,
      length: match.actualWord.length,
      word: match.actualWord,
      message: `"${match.actualWord}" may be misspelled`,
      suggestions: data.suggestions?.[apiWord] ?? [],
      type: 'spelling',
    });
  }

  const rawGrammar: string | undefined = data.grammar_correction ?? data.improved_text;
  const grammarCorrection =
    rawGrammar && rawGrammar.trim() !== text.trim() ? rawGrammar.trim() : undefined;

  return { issues: issues.sort((a, b) => a.offset - b.offset), grammarCorrection };
}

function _adaptRawSuggest(data: any): string[] | null {
  if (!data) return null;
  // string[] directly
  if (Array.isArray(data)) return data.filter(Boolean);
  // { suggestions: string[] } — shape returned by AutoCompleteWorker / suggest API
  if (Array.isArray(data.suggestions) && data.suggestions.length > 0)
    return data.suggestions.filter(Boolean);
  // { generated_text: string } — alternate API shape
  if (typeof data.generated_text === 'string' && data.generated_text.trim())
    return [data.generated_text];
  // { improved_text: string } — fallback shape
  if (typeof data.improved_text === 'string' && data.improved_text.trim())
    return [data.improved_text];
  // bare string
  if (typeof data === 'string' && data.trim()) return [data];
  return null;
}

// These are module-level factory functions (not hooks) so the component
// can call them conditionally without violating Rules of Hooks.
function _makeSpellCheckFn(fn: (text: string) => Promise<any>): (text: string) => SpellCheckResult {
  return (text: string): SpellCheckResult => {
    let dismissed = false;
    const promise: Promise<SpellCheckPayload | null> = (async () => {
      try {
        const raw = await fn(text);
        if (dismissed) return null;
        return _adaptRawSpell(raw, text);
      } catch {
        return null;
      }
    })();
    return {
      promise,
      dismiss: () => {
        dismissed = true;
      },
    };
  };
}

function _makeQueryFn(
  fn: (text: string, cursorIndex?: number) => Promise<any>,
): (text?: string, cursorIndex?: number) => SearchPromise {
  return (text?: string, cursorIndex?: number): SearchPromise => {
    let dismissed = false;
    const promise: Promise<string[] | null> = (async () => {
      try {
        if (!text?.trim()) return null;
        const raw = await fn(text, cursorIndex);
        if (dismissed) return null;
        return _adaptRawSuggest(raw);
      } catch {
        return null;
      }
    })();
    return {
      promise,
      dismiss: () => {
        dismissed = true;
      },
    };
  };
}

function EditorReadyPlugin({ onReady }: { onReady?: (editor: LexicalEditor) => void }) {
  const [editor] = useLexicalComposerContext();
  const calledRef = useRef(false);
  useEffect(() => {
    if (!onReady || calledRef.current) return;
    calledRef.current = true;
    onReady(editor);
  }, [editor, onReady]);
  return null;
}

export const ContentEditorComponent = forwardRef<ContentEditorRef, ContentEditorProps>(
  (props, ref) => {
    const isReadOnly = !!props.readOnly;

    // ── Resolve simple fn props → plugin format ────────────────────────────
    // spellCheckFn / suggestFn: simple API — just a plain async function.
    // useSpellCheck / useQuery: advanced API — manual cancellation control.
    // Simple props take precedence if both are provided.
    // useMemo ensures the wrapped functions are stable across renders so
    // plugins don't re-register on every keystroke.

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const resolvedSpellCheck = React.useMemo(
      () => (props.spellCheckFn ? _makeSpellCheckFn(props.spellCheckFn) : props.useSpellCheck),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [props.spellCheckFn, props.useSpellCheck],
    );

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const resolvedQuery = React.useMemo(
      () => (props.suggestFn ? _makeQueryFn(props.suggestFn) : props.useQuery),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [props.suggestFn, props.useQuery],
    );

    const [floatingAnchorElem, setFloatingAnchorElem] = useState<HTMLDivElement | null>(null);
    const [isLinkEditMode, setIsLinkEditMode] = useState(false);

    const [metrics, setMetrics] = useState<ContentMetrics>({
      words: 0,
      chars: 0,
      images: 0,
      links: 0,
      tables: 0,
    });
    const handleMetrics = useCallback((m: ContentMetrics) => setMetrics(m), []);
    const [pageSetup, setPageSetup] = useState<PageSetupValue>(DEFAULT_PAGE_SETUP);
    const pageCanvas = resolvePageCanvasMetrics(pageSetup);
    const wordCount = metrics.words;

    const contentEditableDomRef = useRef<HTMLDivElement>(null);
    const previousOverLimitRef = useRef(false);

    const focusedRef = useRef(false);
    const setFocused = (focused: boolean) => {
      focusedRef.current = focused;
    };

    const containerRef = useRef<HTMLDivElement>(null);

    const onAnchorRef = (elem: HTMLDivElement | null) => {
      if (elem) setFloatingAnchorElem(elem);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const initialConfig: any = React.useMemo(() => {
      const config: InitialConfigType = {
        namespace: props.namespace ?? '',
        theme,
        onError: () => { },
        nodes: [
          HeadingNode,
          QuoteNode,

          CodeHighlightNode,
          CodeNode,

          ListNode,
          ListItemNode,
          AlphaListNode,

          LinkNode,
          AutoLinkNode,

          TableNode,
          TableRowNode,
          TableCellNode,

          ImageNode,
          InlineImageNode,
          YouTubeNode,
          PageBreakNode,
          AutocompleteNode,
          SpellErrorNode,

          HtmlBlockNode,
        ],
      };
      props.onBeforeInitialize?.(config);
      return config;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const EditorStyles = mergeStyleSets({
      editorPlaceholder: {
        color: "var(--colorNeutralForeground3, grey)",
        position: "absolute",
        top: props.level !== ContentEditorLevel.None ? "17px" : "27px",
        left: 0,
        right: 0,
        maxWidth: pageCanvas.widthPx,
        marginLeft: pageCanvas.widthPx !== undefined ? "auto" : undefined,
        marginRight: pageCanvas.widthPx !== undefined ? "auto" : undefined,
        paddingLeft: pageCanvas.paddingPx,
        paddingRight: pageCanvas.paddingPx,
        fontSize: "14px",
        pointerEvents: "none",
        userSelect: "none",
      },
      contentEditor: {
        zIndex: 0,
        flex: "auto",
        outline: "none",
        overflow: "auto",
        marginTop: "0px",
        position: "relative",
        background: "var(--colorNeutralBackground1, #ffffff)",
        justifyContent: "center",
        height: props.contentHeight ?? "100%",
        ...(isReadOnly && {
          cursor: "not-allowed",
          opacity: 0.75,
          userSelect: "text",
        }),
      },
    });

    const urlRegExp = new RegExp(
      /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=+$,\w]+@)?[A-Za-z0-9.-]+|(?:www.|[-;:&=+$,\w]+@)[A-Za-z0-9.-]+)((?:\/[+~%/.\w-_]*)?\??(?:[-+=&;%@.\w_]*)#?(?:[\w]*))?)/,
    );
    const validateUrl = (url: string) => url === 'https://' || urlRegExp.test(url);

    const handleReadOnlyClickCapture = (e: React.SyntheticEvent) => {
      if (!isReadOnly) return;
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.('a');
      if (anchor) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const isOverLimit = props.wordLimit !== undefined && wordCount > props.wordLimit;

    useEffect(() => {
      if (props.wordLimit === undefined || !props.onWordLimitExceeded) return;

      const wasOverLimit = previousOverLimitRef.current;

      if (isOverLimit !== wasOverLimit) {
        props.onWordLimitExceeded({
          wordCount,
          wordLimit: props.wordLimit,
          exceeded: isOverLimit,
        });

        previousOverLimitRef.current = isOverLimit;
      }
    }, [isOverLimit, wordCount, props.wordLimit, props.onWordLimitExceeded]);

    // ── Validation ──────────────────────────────────────────────────────────
    const validationErrors = React.useMemo((): EditorValidationError[] => {
      const errors: EditorValidationError[] = [];
      const custom = props.validationMessages ?? {};
      const { words, chars, images, links, tables } = metrics;

      // Helper: resolve a message using custom override → default fallback.
      const msg = <T extends any[]>(
        key: keyof typeof DEFAULT_VALIDATION_MESSAGES,
        ...args: T
      ): string => {
        const override = (custom as any)[key];
        if (override !== undefined) {
          return typeof override === 'function' ? override(...args) : override;
        }
        const def = (DEFAULT_VALIDATION_MESSAGES as any)[key];
        return typeof def === 'function' ? def(...args) : def;
      };

      // ── Word count ──────────────────────────────────────────────────────
      const requiredFired = props.required && words === 0;
      if (requiredFired) {
        errors.push({ type: 'required', message: msg('required') });
      } else if (props.minWords !== undefined && words < props.minWords) {
        errors.push({ type: 'minWords', message: msg('minWords', words, props.minWords) });
      }

      // wordLimit is the legacy counter prop; treat it as maxWords for error messages.
      const effectiveMaxWords = props.maxWords ?? props.wordLimit;
      if (effectiveMaxWords !== undefined && words > effectiveMaxWords) {
        errors.push({ type: 'maxWords', message: msg('maxWords', words, effectiveMaxWords) });
      }

      // ── Character count ─────────────────────────────────────────────────
      // Skip minChars when the 'required' error already covers an empty editor.
      if (!requiredFired && props.minChars !== undefined && chars < props.minChars) {
        errors.push({ type: 'minChars', message: msg('minChars', chars, props.minChars) });
      }

      if (props.maxChars !== undefined && chars > props.maxChars) {
        errors.push({ type: 'maxChars', message: msg('maxChars', chars, props.maxChars) });
      }

      // ── Images ──────────────────────────────────────────────────────────
      if (props.noImages && images > 0) {
        errors.push({ type: 'noImages', message: msg('noImages') });
      } else if (props.maxImages !== undefined && images > props.maxImages) {
        errors.push({ type: 'maxImages', message: msg('maxImages', images, props.maxImages) });
      }

      // ── Links ────────────────────────────────────────────────────────────
      if (props.noLinks && links > 0) {
        errors.push({ type: 'noLinks', message: msg('noLinks') });
      } else if (props.maxLinks !== undefined && links > props.maxLinks) {
        errors.push({ type: 'maxLinks', message: msg('maxLinks', links, props.maxLinks) });
      }

      // ── Tables ───────────────────────────────────────────────────────────
      if (props.noTables && tables > 0) {
        errors.push({ type: 'noTables', message: msg('noTables') });
      }

      return errors;
    }, [
      metrics,
      props.required,
      props.minWords,
      props.maxWords,
      props.wordLimit,
      props.minChars,
      props.maxChars,
      props.noImages,
      props.maxImages,
      props.noLinks,
      props.maxLinks,
      props.noTables,
      props.validationMessages,
    ]);

    const previousErrorTypesRef = useRef<string>('');
    useEffect(() => {
      if (!props.onValidationChange) return;
      const key = validationErrors.map((e) => e.type).join(',');
      if (key !== previousErrorTypesRef.current) {
        previousErrorTypesRef.current = key;
        props.onValidationChange(validationErrors);
      }
    }, [validationErrors, props.onValidationChange]);

    const trimmedErrorMessage = props.errorMessage?.trim() || '';
    const hasValidationError = validationErrors.length > 0 || !!trimmedErrorMessage;

    return (
      <FluentProvider theme={webLightTheme} style={{ height: '100%' }}>
        <LexicalComposer initialConfig={initialConfig}>
          <div ref={containerRef} className='lexical-rich-editor-root' style={{ height: '100%', position: 'relative' }}>
            <Stack
              style={{
                zIndex: 1000,
                background: '#fff',
                borderRadius: '2px',
                width: props.width ?? '100%',
                height: props.height ?? '100%',
                margin: props.margin ?? '5px auto',
                border: `1px solid ${isOverLimit || hasValidationError
                    ? '#c4272c'
                    : 'var(--colorNeutralStroke1, #ccced1)'
                  }`,
                transition: 'border-color 0.2s',
                display: 'flex',
                flexDirection: 'column',
              }}>
              <div
                className='editor-toolbar-root'
                style={{
                  pointerEvents: isReadOnly ? 'none' : 'auto',
                  position: 'sticky',
                  opacity: isReadOnly ? 0.85 : 1,
                }}>
                <ToolBarPlugins
                  level={props.level ?? ContentEditorLevel.Basic}
                  customToolbar={props.customToolbar}
                  readOnly={props.readOnly}
                  pageSetup={pageSetup}
                  onPageSetupChange={setPageSetup}
                  maxImageSizeMB={props.maxImageSizeMB}
                  validationMessages={props.validationMessages}
                  setIsLinkEditMode={setIsLinkEditMode}
                />
              </div>

              <div
                style={{
                  position: 'relative',
                  flexGrow: 1,
                  padding: '15px 0px',
                  overflowY: 'scroll',
                  overflowX: 'auto',
                  minWidth: 0,
                  background: pageCanvas.widthPx !== undefined ? '#eef0f2' : undefined,
                }}
                onClickCapture={handleReadOnlyClickCapture}>
                <RichTextPlugin
                  ErrorBoundary={LexicalErrorBoundary}
                  contentEditable={
                    <div
                      className='editor'
                      style={{ height: '100%', position: 'relative' }}
                      ref={onAnchorRef}>
                      <ContentEditable
                        ref={contentEditableDomRef}
                        className={css(EditorStyles.contentEditor)}
                        style={{
                          paddingTop: props.level !== ContentEditorLevel.None ? 0 : 10,
                          paddingLeft: pageCanvas.paddingPx,
                          paddingRight: pageCanvas.paddingPx,
                          maxWidth: pageCanvas.widthPx,
                          marginLeft: pageCanvas.widthPx !== undefined ? 'auto' : undefined,
                          marginRight: pageCanvas.widthPx !== undefined ? 'auto' : undefined,
                          boxShadow:
                            pageCanvas.widthPx !== undefined
                              ? '0 0 0 1px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.08)'
                              : undefined,
                        }}
                        // Disable browser's built-in spellcheck red squiggles when
                        // our own SpellCheckPlugin is active — avoids double underlines.
                        spellCheck={!resolvedSpellCheck}
                        autoCorrect={resolvedSpellCheck ? 'off' : undefined}
                        autoCapitalize={resolvedSpellCheck ? 'off' : undefined}
                      />
                    </div>
                  }
                  placeholder={
                    <Stack className={css(EditorStyles.editorPlaceholder)}>
                      {props.placeholder}
                    </Stack>
                  }
                />

                {/* ── Content counters: sticky to bottom-right ── */}
                {(props.wordLimit !== undefined ||
                  props.maxWords !== undefined ||
                  props.minWords !== undefined ||
                  props.maxChars !== undefined ||
                  props.minChars !== undefined) && (
                    <div
                      style={{
                        position: 'sticky',
                        bottom: 0,
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: 10,
                        paddingRight: 14,
                        pointerEvents: 'none',
                        userSelect: 'none',
                      }}>
                      {(props.wordLimit !== undefined ||
                        props.maxWords !== undefined ||
                        props.minWords !== undefined) && (
                          <span
                            style={{
                              fontSize: '11px',
                              color: hasValidationError
                                ? '#c4272c'
                                : 'var(--colorNeutralForeground3, #aaa)',
                              fontWeight: hasValidationError ? 600 : 400,
                              transition: 'color 0.2s, font-weight 0.2s',
                            }}>
                            {wordCount}
                            {(props.maxWords ?? props.wordLimit) !== undefined &&
                              ` / ${props.maxWords ?? props.wordLimit}`}
                            {props.minWords !== undefined &&
                              props.maxWords === undefined &&
                              props.wordLimit === undefined &&
                              ` (min ${props.minWords})`}
                            {' words'}
                          </span>
                        )}
                      {(props.maxChars !== undefined || props.minChars !== undefined) && (
                        <span
                          style={{
                            fontSize: '11px',
                            color: hasValidationError
                              ? '#c4272c'
                              : 'var(--colorNeutralForeground3, #aaa)',
                            fontWeight: hasValidationError ? 600 : 400,
                            transition: 'color 0.2s, font-weight 0.2s',
                          }}>
                          {metrics.chars}
                          {props.maxChars !== undefined && ` / ${props.maxChars}`}
                          {props.minChars !== undefined &&
                            props.maxChars === undefined &&
                            ` (min ${props.minChars})`}
                          {' chars'}
                        </span>
                      )}
                    </div>
                  )}
              </div>

              <ReadOnlyPlugin readonly={isReadOnly} />
              <BrowserSpellCheckPlugin enabled={!resolvedSpellCheck} />
              <FocusEventsPlugin
                onFocus={props.onFocus}
                onBlur={props.onBlur}
                setFocused={setFocused}
                containerRef={containerRef}
              />

              {props.autoFocus && !isReadOnly && <AutoFocusPlugin />}

              <HistoryPlugin />
              <ListPlugin />
              <LinkPlugin validateUrl={validateUrl} />
              <AutoLinkPlugin matchers={MATCHERS} />
              <TablePlugin hasCellMerge hasCellBackgroundColor />

              {!isReadOnly && <YoutubeDeletePlugin />}

              {!isReadOnly && floatingAnchorElem && <TableActionMenuPlugin />}
              {!isReadOnly && floatingAnchorElem && (
                <TableCellResizerPlugin anchorElem={floatingAnchorElem} />
              )}

              {!isReadOnly && (
                <FloatingLinkEditorPlugin
                  anchorElem={floatingAnchorElem}
                  isLinkEditMode={isLinkEditMode}
                  setIsLinkEditMode={setIsLinkEditMode}
                />
              )}

              {!isReadOnly && <ImagesPlugin />}
              {!isReadOnly && <InlineImagePlugin />}
              {!isReadOnly && <PageBreakPlugin />}

              {/* ── Autocomplete (optimised) ────────────────────────────── */}
              {!!resolvedQuery && !isReadOnly && (
                <AutocompletePlugin
                  useQuery={resolvedQuery}
                  isReadOnly={isReadOnly}
                  onSuggestionShown={props.onSuggestionShown}
                  onSuggestionAccept={props.onSuggestionAccept}
                  idleMs={props.suggestIdleMs ?? 300}
                  minWords={4}
                  prefixWindow={300}
                />
              )}

              {/* ── Spell / grammar check (NEW) ─────────────────────────── */}
              {!!resolvedSpellCheck && !isReadOnly && (
                <SpellCheckPlugin
                  useSpellCheck={resolvedSpellCheck}
                  onSpellCheckAccept={props.onSpellCheckAccept}
                  idleMs={props.spellCheckIdleMs ?? 1200}
                  enabled={props.spellCheckEnabled !== false}
                />
              )}

              {!isReadOnly && props.showFloatingToolbar && <CharacterStylesPopupPlugin />}
              <CustomOnChangePlugin value={props.value} onChange={props.onChange} />

              {(props.wordLimit !== undefined ||
                props.required ||
                props.minWords !== undefined ||
                props.maxWords !== undefined ||
                props.minChars !== undefined ||
                props.maxChars !== undefined ||
                props.noImages ||
                props.maxImages !== undefined ||
                props.noLinks ||
                props.maxLinks !== undefined ||
                props.noTables) && <ContentMetricsPlugin onMetricsChange={handleMetrics} />}

              <RefApiPlugin
                forwardedRef={ref}
                contentEditableDomRef={contentEditableDomRef}
                focusedRef={focusedRef}
              />

              {/* ── Validation messages ─────────────────────────────────────────
                Inside the Stack so the height:100% chain is never broken.
                flex-shrink:0 keeps them at natural height; the scrollable
                content area (flex-grow:1) absorbs the remaining space. */}
              {(validationErrors.length > 0 || trimmedErrorMessage) && (
                <div style={{ flexShrink: 0, padding: '6px 20px 8px' }}>
                  {validationErrors.map((err) => (
                    <div
                      key={err.type}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 6,
                        marginTop: 2,
                        color: '#c4272c',
                        fontSize: 12,
                        lineHeight: '18px',
                      }}>
                      <span style={{ fontWeight: 600, flexShrink: 0 }}>⚠</span>
                      <span>{err.message}</span>
                    </div>
                  ))}
                  {trimmedErrorMessage && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 6,
                        marginTop: 2,
                        color: '#c4272c',
                        fontSize: 12,
                        lineHeight: '18px',
                      }}>
                      <span style={{ fontWeight: 600, flexShrink: 0 }}>⚠</span>
                      <span>{trimmedErrorMessage}</span>
                    </div>
                  )}
                </div>
              )}
            </Stack>
          </div>
          <EditorReadyPlugin onReady={props.onReady} />
        </LexicalComposer>
      </FluentProvider>
    );
  },
);
