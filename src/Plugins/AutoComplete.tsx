import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $createTextNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  KEY_DOWN_COMMAND,
  SELECTION_CHANGE_COMMAND,
} from 'lexical';
import * as React from 'react';

import type { AcceptMethod, SearchPromise } from '../ContentEditorComponent.types';
import { $createAutocompleteNode, AutocompleteNode } from '../Nodes/AutoCompleteNode';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const normalize = (s?: string) => (s ?? '').replace(/\s+/g, ' ').trim();

function readContextWindow(maxChars = 300, cursorIndex?: number): string {
  const full = normalize($getRoot().getTextContent());
  const upTo = cursorIndex != null ? full.slice(0, cursorIndex) : full;
  return upTo.slice(Math.max(0, upTo.length - maxChars));
}

function readCursorIndex(): number {
  const sel = $getSelection();
  if (!$isRangeSelection(sel)) return -1;

  const anchorNode = sel.anchor.getNode();
  const anchorOffset = sel.anchor.offset;
  if (anchorNode instanceof AutocompleteNode) return -1;

  const root = $getRoot();
  let index = 0;
  let found = false;

  const visitLeaves = (node: any): void => {
    if (found) return;
    if (node === anchorNode) {
      index += anchorOffset;
      found = true;
      return;
    }
    if (typeof node.getChildren !== 'function') {
      if (!(node instanceof AutocompleteNode)) index += node.getTextContent().length;
      return;
    }
    for (const child of node.getChildren()) {
      if (found) return;
      visitLeaves(child);
    }
  };

  const blocks = root.getChildren();
  for (let i = 0; i < blocks.length; i++) {
    if (found) break;
    if (i > 0) index += 1;
    visitLeaves(blocks[i]);
  }
  return found ? index : -1;
}

/** Text before caret in the current node — used for prefix-stripping */
function readPrefixBeforeCaret(maxChars = 300): string {
  const sel = $getSelection();
  if (!$isRangeSelection(sel)) return '';
  const node = sel.anchor.getNode();
  if (node instanceof AutocompleteNode) return '';
  const text = node.getTextContent();
  const upto = text.slice(0, sel.anchor.offset);
  return normalize(upto.slice(Math.max(0, upto.length - maxChars)));
}

/**
 * Pick the best suggestion from the list.
 * If the top suggestion starts with the current prefix, strip it to avoid duplication.
 */
function selectBestSuggestion(list: string[] | null, prefix: string): string | null {
  if (!list?.length) return null;
  const sorted = list
    .map(normalize)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  if (!sorted.length) return null;
  const s0 = sorted[0];
  const p = prefix.toLowerCase();
  if (s0.toLowerCase().startsWith(p)) {
    const rest = normalize(s0.slice(p.length));
    return rest || null;
  }
  return s0;
}

// ─── Types ────────────────────────────────────────────────────────────────────

/** Exported so ContentEditorComponent can disable browser spellcheck when active */
export const DISABLE_BROWSER_SPELLCHECK = true;

type InflightRequest = {
  id: number;
  sentContext: string;
  sentCursorIndex: number;
  dismiss: () => void;
};

// ─── Plugin ───────────────────────────────────────────────────────────────────

export default function AutocompletePlugin({
  useQuery,
  onSuggestionShown,
  onSuggestionAccept,
  isReadOnly = false,
  minWords = 4,
  idleMs = 800,
  prefixWindow = 300,
}: {
  /**
   * Called with `(contextText, cursorIndex)`. Return `{ promise, dismiss }` where
   * `promise` resolves to `string[] | null`.
   */
  useQuery?: (searchText?: string, cursorIndex?: number) => SearchPromise;
  onSuggestionShown?: (info: { suggestionText: string; triggerText?: string }) => void;
  onSuggestionAccept?: (info: {
    suggestionText: string;
    triggerText?: string;
    method: AcceptMethod;
  }) => void;
  isReadOnly?: boolean;

  minWords?: number;
  idleMs?: number;
  prefixWindow?: number;
}) {
  const [editor] = useLexicalComposerContext();

  const ghostKeyRef = React.useRef<string | null>(null);
  const idleTimerRef = React.useRef<number | null>(null);
  const inflightRef = React.useRef<InflightRequest | null>(null);
  const reqCounterRef = React.useRef(0);
  const lastTriggerRef = React.useRef<string>('');
  const lastShownCtxRef = React.useRef<string>('');

  // ── Ghost helpers ─────────────────────────────────────────────────────────

  const clearGhost = React.useCallback(() => {
    editor.update(
      () => {
        const key = ghostKeyRef.current;
        if (!key) return;
        const node = $getNodeByKey(key);
        if (node instanceof AutocompleteNode) node.remove();
        ghostKeyRef.current = null;
      },
      { tag: 'autocomplete-ghost' },
    );
  }, [editor]);

  /**
   * Insert (or update) ghost text at the given absolute char offset.
   * Walks the live tree at call time — immune to spell-check node splits.
   */
  const upsertGhost = React.useCallback(
    (text: string, insertAtCharOffset: number) => {
      editor.update(
        () => {
          // Update existing ghost if still present
          if (ghostKeyRef.current) {
            const existing = $getNodeByKey(ghostKeyRef.current);
            if (existing instanceof AutocompleteNode) {
              if (existing.getTextContent() !== text) existing.setTextContent(text);
              return;
            }
            ghostKeyRef.current = null;
          }

          // Find the node containing insertAtCharOffset
          const root = $getRoot();
          let pos = 0;
          let targetNode: any = null;
          let localOffset = 0;

          const findNode = (node: any): boolean => {
            if (node instanceof AutocompleteNode) return false;
            if (typeof node.getChildren !== 'function') {
              const len = node.getTextContent().length;
              if (insertAtCharOffset <= pos + len) {
                targetNode = node;
                localOffset = insertAtCharOffset - pos;
                return true;
              }
              pos += len;
              return false;
            }
            for (const child of node.getChildren()) {
              if (findNode(child)) return true;
            }
            return false;
          };

          const blocks = root.getChildren();
          let found = false;
          for (let i = 0; i < blocks.length && !found; i++) {
            if (i > 0) pos += 1;
            found = findNode(blocks[i]);
          }

          if (!targetNode) return;

          const nodeText = targetNode.getTextContent();
          const before = nodeText.slice(0, localOffset);
          const after = nodeText.slice(localOffset);

          const charBefore = before ? before[before.length - 1] : '';
          const needsSpace = charBefore && charBefore !== ' ' && !text.startsWith(' ');
          const ghostText = needsSpace ? ' ' + text : text;
          const ghost = $createAutocompleteNode(
            ghostText,
            crypto?.randomUUID?.() ?? String(Date.now()),
          );
          ghostKeyRef.current = ghost.getKey();

          if (before) {
            targetNode.setTextContent(before);
            targetNode.insertAfter(ghost);
            ghost.insertAfter($createTextNode(after.length ? after : ''));
          } else {
            targetNode.insertBefore(ghost);
          }
        },
        { tag: 'autocomplete-ghost' },
      );
    },
    [editor],
  );

  // ── Cancel inflight ───────────────────────────────────────────────────────

  const cancelInflight = React.useCallback(() => {
    if (!inflightRef.current) return;
    inflightRef.current.dismiss();
    inflightRef.current = null;
  }, []);

  // ── Idle timer reset ──────────────────────────────────────────────────────

  const resetIdleTimer = React.useCallback(
    (callback: () => void) => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      cancelInflight();
      clearGhost();
      idleTimerRef.current = window.setTimeout(() => {
        idleTimerRef.current = null;
        callback();
      }, idleMs);
    },
    [idleMs, cancelInflight, clearGhost],
  );

  // ── Fire API ──────────────────────────────────────────────────────────────

  const fireQuery = React.useCallback(() => {
    if (!useQuery || isReadOnly) return;

    let context = '';
    let prefix = '';
    let cursorIndex = -1;
    let wordCount = 0;

    editor.getEditorState().read(() => {
      cursorIndex = readCursorIndex();
      context = readContextWindow(prefixWindow, cursorIndex >= 0 ? cursorIndex : undefined);
      prefix = readPrefixBeforeCaret(prefixWindow);
      wordCount = context.trim().split(/\s+/).filter(Boolean).length;
    });
    if (wordCount < minWords) return;
    if (cursorIndex === -1) return;
    if (context === lastShownCtxRef.current) return;

    cancelInflight();

    const myId = ++reqCounterRef.current;
    const sentContext = context;
    const sentPrefix = prefix;
    const sentCursorIndex = cursorIndex;

    const { promise, dismiss } = useQuery(sentContext, cursorIndex);
    inflightRef.current = { id: myId, sentContext, sentCursorIndex, dismiss };

    promise.then(
      (list) => {
        if (myId !== reqCounterRef.current) return; // superseded

        let currentContext = '';
        let currentCursorIndex = -1;
        let currentPrefix = '';

        editor.getEditorState().read(() => {
          currentCursorIndex = readCursorIndex();
          currentContext = readContextWindow(
            prefixWindow,
            currentCursorIndex >= 0 ? currentCursorIndex : undefined,
          );
          currentPrefix = readPrefixBeforeCaret(prefixWindow);
        });

        // Discard if text changed while in-flight
        if (normalize(currentContext) !== normalize(sentContext)) {
          inflightRef.current = null;
          return;
        }

        const CURSOR_TOLERANCE = 2;
        if (
          currentCursorIndex !== -1 &&
          Math.abs(currentCursorIndex - sentCursorIndex) > CURSOR_TOLERANCE
        ) {
          inflightRef.current = null;
          return;
        }

        const suggestion = selectBestSuggestion(list, currentPrefix || sentPrefix);
        if (!suggestion) {
          clearGhost();
          inflightRef.current = null;
          return;
        }

        inflightRef.current = null;
        lastTriggerRef.current = sentContext;
        lastShownCtxRef.current = sentContext;

        upsertGhost(suggestion, sentCursorIndex);
        onSuggestionShown?.({ suggestionText: suggestion, triggerText: sentContext });
      },
      () => {
        inflightRef.current = null;
      },
    );
  }, [
    editor,
    useQuery,
    isReadOnly,
    minWords,
    prefixWindow,
    cancelInflight,
    clearGhost,
    upsertGhost,
    onSuggestionShown,
  ]);

  // ── Update listener (typing) ──────────────────────────────────────────────

  React.useEffect(() => {
    if (!useQuery || isReadOnly) return;
    return editor.registerUpdateListener(({ tags }) => {
      if (tags.has('history-merge') || tags.has('collaboration')) return;
      if (tags.has('autocomplete-ghost') || tags.has('spell-apply') || tags.has('spell-clear'))
        return;
      resetIdleTimer(fireQuery);
    });
  }, [editor, useQuery, isReadOnly, resetIdleTimer, fireQuery]);

  // ── Selection change listener (cursor moves, no typing) ───────────────────

  React.useEffect(() => {
    if (!useQuery || isReadOnly) return;
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        // Don't clear ghost if cursor is inside or immediately after it
        let insideGhost = false;
        editor.getEditorState().read(() => {
          const sel = $getSelection();
          if (!$isRangeSelection(sel)) return;
          const node = sel.anchor.getNode();
          if (node instanceof AutocompleteNode) {
            insideGhost = true;
            return;
          }
          const prev = (node as any).getPreviousSibling?.();
          if (prev instanceof AutocompleteNode) insideGhost = true;
        });
        if (insideGhost) return false;

        if (inflightRef.current || idleTimerRef.current) resetIdleTimer(fireQuery);
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor, useQuery, isReadOnly, resetIdleTimer, fireQuery]);

  // ── Keyboard: Tab = accept, Escape = dismiss ──────────────────────────────

  React.useEffect(() => {
    return editor.registerCommand<KeyboardEvent>(
      KEY_DOWN_COMMAND,
      (e) => {
        if (!ghostKeyRef.current) return false;

        if (e.key === 'Tab' || e.key === 'ArrowRight') {
          e.preventDefault();
          editor.update(() => {
            const node = $getNodeByKey(ghostKeyRef.current!);
            if (!(node instanceof AutocompleteNode)) return;
            const text = node.getTextContent();
            const replaced = $createTextNode(text);
            node.replace(replaced);
            // Move cursor to end of the accepted text
            replaced.select(text.length, text.length);
            ghostKeyRef.current = null;
            lastShownCtxRef.current = '';
            onSuggestionAccept?.({
              suggestionText: text.trimStart() || text,
              triggerText: lastTriggerRef.current,
              method: 'tab',
            });
          });
          return true;
        }

        if (e.key === 'Escape') {
          e.preventDefault();
          clearGhost();
          editor.getEditorState().read(() => {
            lastShownCtxRef.current = readContextWindow(prefixWindow);
          });
          return true;
        }

        // Printable key or delete — clear ghost, pass through
        if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') {
          clearGhost();
          return false;
        }

        return false;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor, clearGhost, onSuggestionAccept, prefixWindow]);

  // ── Unmount cleanup ───────────────────────────────────────────────────────

  React.useEffect(() => {
    return () => {
      cancelInflight();
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [cancelInflight]);

  return null;
}
