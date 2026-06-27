import { css, mergeStyleSets, Stack } from '@fluentui/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { ErrorCircleRegular } from '@fluentui/react-icons';
import { CodeHighlightNode, CodeNode } from '@lexical/code';
import { AutoLinkNode, LinkNode } from '@lexical/link';
import { ListItemNode, ListNode } from '@lexical/list';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { AutoLinkPlugin, createLinkMatcherWithRegExp } from '@lexical/react/LexicalAutoLinkPlugin';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
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
import React, { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import {
  ContentEditorLevel,
  ContentEditorProps,
  ContentEditorRef,
  SearchPromise,
  SpellCheckIssue,
  SpellCheckPayload,
  SpellCheckResult,
} from './ContentEditorComponent.types';

import './Editor.css';

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
import { $getRoot } from 'lexical';
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

function WordCountPlugin({ onCountChange }: { onCountChange: (count: number) => void }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const text = $getRoot().getTextContent();
        const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
        onCountChange(words);
      });
    });
  }, [editor, onCountChange]);
  return null;
}

function CharCountPlugin({ onCountChange }: { onCountChange: (count: number) => void }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        onCountChange($getRoot().getTextContent().length);
      });
    });
  }, [editor, onCountChange]);
  return null;
}

function FocusEventsPlugin({
  onFocus,
  onBlur,
  setFocused,
}: {
  onFocus?: () => void;
  onBlur?: () => void;
  setFocused: (focused: boolean) => void;
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
      const next = e.relatedTarget as Node | null;
      const stillInside = !!next && root.contains(next);
      if (stillInside) return;

      setFocused(false);
      onBlur?.();
    };

    root.addEventListener('focusin', handleFocusIn);
    root.addEventListener('focusout', handleFocusOut);

    return () => {
      root.removeEventListener('focusin', handleFocusIn);
      root.removeEventListener('focusout', handleFocusOut);
    };
  }, [editor, onBlur, onFocus, setFocused]);

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

    const [wordCount, setWordCount] = useState(0);
    const handleWordCount = useCallback((count: number) => setWordCount(count), []);

    const [charCount, setCharCount] = useState(0);
    const handleCharCount = useCallback((count: number) => setCharCount(count), []);

    const [refErrors, setRefErrors] = useState<string[]>([]);

    const contentEditableDomRef = useRef<HTMLDivElement>(null);
    const previousOverLimitRef = useRef(false);

    const focusedRef = useRef(false);
    const setFocused = (focused: boolean) => {
      focusedRef.current = focused;
    };

    const onAnchorRef = (elem: HTMLDivElement | null) => {
      if (elem) setFloatingAnchorElem(elem);
    };

    const initialConfig: any = {
      namespace: props.namespace,
      theme,
      onError: () => {},
      nodes: [
        HeadingNode,
        QuoteNode,

        CodeHighlightNode,
        CodeNode,

        ListNode,
        ListItemNode,

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

    const EditorStyles = mergeStyleSets({
      editorPlaceholder: {
        color: 'var(--colorNeutralForeground3, grey)',
        position: 'absolute',
        top: props.level !== ContentEditorLevel.None ? '17px' : '27px',
        left: 20,
        right: 20,
        fontSize: '14px',
        pointerEvents: 'none',
        userSelect: 'none',
      },
      contentEditor: {
        zIndex: 0,
        flex: 'auto',
        outline: 'none',
        overflow: 'auto',
        marginTop: '0px',
        paddingLeft: '20px',
        paddingRight: '20px',
        position: 'relative',
        background: 'var(--colorNeutralBackground1, #ffffff)',
        justifyContent: 'center',
        height: props.contentHeight ?? '100%',
        ...(isReadOnly && {
          cursor: 'not-allowed',
          opacity: 0.75,
          userSelect: 'text',
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

    const [touched, setTouched] = useState(false);

    const isOverLimit = props.wordLimit !== undefined && wordCount > props.wordLimit;

    // Built-in validation messages generated automatically by the editor.
    const internalErrors: string[] = [];

    if (isOverLimit) {
      const m = props.errorMessages?.wordLimitExceeded;
      internalErrors.push(
        typeof m === 'function'
          ? m(wordCount, props.wordLimit!)
          : m ?? `Word limit exceeded (${wordCount} / ${props.wordLimit} words used)`,
      );
    }

    if (props.required && touched && wordCount === 0) {
      internalErrors.push(
        props.errorMessages?.required ?? 'This field is required',
      );
    }

    if (props.minWords !== undefined && touched && wordCount < props.minWords) {
      const m = props.errorMessages?.minWords;
      internalErrors.push(
        typeof m === 'function'
          ? m(wordCount, props.minWords)
          : m ?? `Minimum ${props.minWords} words required (${wordCount} entered)`,
      );
    }

    if (props.maxChars !== undefined && charCount > props.maxChars) {
      const m = props.errorMessages?.maxCharsExceeded;
      internalErrors.push(
        typeof m === 'function'
          ? m(charCount, props.maxChars)
          : m ?? `Character limit exceeded (${charCount} / ${props.maxChars} characters used)`,
      );
    }

    if (props.minChars !== undefined && touched && charCount < props.minChars && charCount > 0) {
      const m = props.errorMessages?.minCharsRequired;
      internalErrors.push(
        typeof m === 'function'
          ? m(charCount, props.minChars)
          : m ?? `Minimum ${props.minChars} characters required (${charCount} entered)`,
      );
    }

    const allErrors: string[] = [...internalErrors, ...(props.errors ?? []), ...refErrors];
    const hasErrors = allErrors.length > 0;
    const hasRedBorder = hasErrors;

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

    return (
      <FluentProvider theme={webLightTheme} style={{ height: '100%' }}>
        <LexicalComposer initialConfig={initialConfig}>
          <Stack
            style={{
              zIndex: 1000,
              background: '#fff',
              borderRadius: '2px',
              width: props.width ?? '100%',
              height: props.height ?? '100%',
              margin: props.margin ?? '5px auto',
              border: `1px solid ${
                hasRedBorder ? '#c4272c' : 'var(--colorNeutralStroke1, #ccced1)'
              }`,
              transition: 'border-color 0.2s',
              display: 'flex',
              flexDirection: 'column',
            }}>
            <div
              style={{
                pointerEvents: isReadOnly ? 'none' : 'auto',
                position: 'sticky',
                opacity: isReadOnly ? 0.85 : 1,
              }}>
              <ToolBarPlugins
                level={props.level ?? ContentEditorLevel.Basic}
                readOnly={props.readOnly}
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
                      style={{ paddingTop: props.level !== ContentEditorLevel.None ? 0 : 10 }}
                      // Disable browser's built-in spellcheck red squiggles when
                      // our own SpellCheckPlugin is active — avoids double underlines.
                      spellCheck={!resolvedSpellCheck}
                      autoCorrect={resolvedSpellCheck ? 'off' : undefined}
                      autoCapitalize={resolvedSpellCheck ? 'off' : undefined}
                    />
                  </div>
                }
                placeholder={
                  <Stack className={css(EditorStyles.editorPlaceholder)}>{props.placeholder}</Stack>
                }
              />

              {/* ── Word count: sticky to the bottom-right of the scroll area ── */}
              {props.wordLimit !== undefined && (
                <div
                  style={{
                    position: 'sticky',
                    bottom: 0,
                    display: 'flex',
                    justifyContent: 'flex-end',
                    paddingRight: 14,
                    pointerEvents: 'none',
                    userSelect: 'none',
                  }}>
                  <span
                    style={{
                      fontSize: '11px',
                      color: isOverLimit ? '#c4272c' : 'var(--colorNeutralForeground3, #aaa)',
                      fontWeight: isOverLimit ? 600 : 400,
                      transition: 'color 0.2s, font-weight 0.2s',
                    }}>
                    {wordCount} / {props.wordLimit} words
                  </span>
                </div>
              )}
            </div>

            {hasErrors && (
              <div
                style={{
                  borderTop: '1px solid #fbd5d5',
                  background: '#fff8f8',
                  padding: '6px 12px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}>
                {allErrors.map((err, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ErrorCircleRegular style={{ fontSize: 14, color: '#c4272c', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#c4272c' }}>{err}</span>
                  </div>
                ))}
              </div>
            )}

            <ReadOnlyPlugin readonly={isReadOnly} />
            <BrowserSpellCheckPlugin enabled={!resolvedSpellCheck} />
            <FocusEventsPlugin
              onFocus={props.onFocus}
              onBlur={() => { setTouched(true); props.onBlur?.(); }}
              setFocused={setFocused}
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

            {(props.wordLimit !== undefined || props.required || props.minWords !== undefined) && (
              <WordCountPlugin onCountChange={handleWordCount} />
            )}

            {(props.maxChars !== undefined || props.minChars !== undefined) && (
              <CharCountPlugin onCountChange={handleCharCount} />
            )}

            <RefApiPlugin
              forwardedRef={ref}
              contentEditableDomRef={contentEditableDomRef}
              focusedRef={focusedRef}
              setRefErrors={setRefErrors}
            />
          </Stack>
        </LexicalComposer>
      </FluentProvider>
    );
  },
);
