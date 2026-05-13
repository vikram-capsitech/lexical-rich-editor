import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $createRangeSelection,
  $createTextNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  LexicalNode,
  TextNode,
} from 'lexical';
import * as React from 'react';
import { createPortal } from 'react-dom';

import {
  $createSpellErrorNode,
  $isSpellErrorNode,
  SpellErrorMeta,
  SpellErrorNode,
  SpellIssueType,
} from '../Nodes/SpellErrorNode';

// ─── Public types ─────────────────────────────────────────────────────────────

export type SpellCheckIssue = {
  offset: number;
  length: number;
  message: string;
  suggestions: string[];
  type?: SpellIssueType;
  word?: string;
};

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

// ─── CSS (injected once, outside Lexical) ─────────────────────────────────────

const CSS_ID = '__sc_styles__';

function injectCSS() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement('style');
  s.id = CSS_ID;
  s.textContent = `
    .sc-err-spelling { text-decoration: underline dotted #e53e3e 1.5px; cursor: pointer; text-underline-offset: 3px; }
    .sc-err-grammar  { text-decoration: underline dotted #3182ce 1.5px; cursor: pointer; text-underline-offset: 3px; }
    .sc-err-style    { text-decoration: underline dotted #d97706 1.5px; cursor: pointer; text-underline-offset: 3px; }
    .sc-popover {
      position:fixed; z-index:10000000; background:#fff; border:1px solid #e2e8f0;
      border-radius:10px; box-shadow:0 6px 24px rgba(0,0,0,.15);
      padding:6px 0 4px; min-width:200px; max-width:300px;
      font-family:system-ui,sans-serif; font-size:13px; user-select:none;
    }
    .sc-popover-header { display:flex; align-items:center; gap:6px; padding:4px 12px 6px; border-bottom:1px solid #f0f0f0; margin-bottom:2px; }
    .sc-popover-badge { font-size:10px; font-weight:700; text-transform:uppercase; padding:2px 6px; border-radius:4px; color:#fff; flex-shrink:0; }
    .sc-popover-badge-spelling { background:#e53e3e; }
    .sc-popover-badge-grammar  { background:#3182ce; }
    .sc-popover-badge-style    { background:#d69e2e; }
    .sc-popover-message { color:#4a5568; font-size:12px; flex:1; }
    .sc-popover-item { padding:7px 14px; cursor:pointer; color:#1a202c; display:flex; align-items:center; gap:8px; font-size:13.5px; font-weight:500; }
    .sc-popover-item:hover { background:#f0fff4; }
    .sc-popover-empty { padding:8px 14px; color:#a0aec0; font-style:italic; font-size:12px; }
    .sc-popover-footer { border-top:1px solid #f0f0f0; margin-top:2px; padding:5px 14px 2px; display:flex; gap:8px; }
    .sc-popover-action { cursor:pointer; font-size:11px; color:#a0aec0; padding:3px 0; }
    .sc-popover-action:hover { color:#e53e3e; }
    .sc-popover-improve { border-top:1px solid #f0f0f0; margin-top:2px; padding:8px 12px 6px; }
    .sc-popover-improve-label { font-size:10px; font-weight:700; text-transform:uppercase; color:#d69e2e; margin-bottom:6px; }
    .sc-popover-improve-text { font-size:12px; color:#4a5568; font-style:italic; margin-bottom:8px; line-height:1.45; }
    .sc-popover-improve-accept { background:#d69e2e; color:#fff; border:none; border-radius:6px; padding:5px 12px; font-size:12px; font-weight:600; cursor:pointer; width:100%; }
    .sc-popover-improve-accept:hover { background:#b7791f; }
  `;
  document.head.appendChild(s);
}

// ─── Tree helpers ─────────────────────────────────────────────────────────────

function escRx(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

type Seg = { node: TextNode; start: number; end: number; text: string };

/**
 * Walk the Lexical tree and return all wrappable TextNode segments with their
 * absolute character offsets. SpellErrorNodes are counted but not returned.
 * Block separators (\n) are counted between top-level blocks, not after the last.
 */
function getSegments(root: LexicalNode): Seg[] {
  const segs: Seg[] = [];
  let pos = 0;

  function walk(node: LexicalNode) {
    if ($isSpellErrorNode(node)) {
      pos += node.getTextContent().length;
      return;
    }
    if ($isTextNode(node)) {
      const t = node.getTextContent();
      if (t.length > 0)
        segs.push({ node: node as TextNode, start: pos, end: pos + t.length, text: t });
      pos += t.length;
      return;
    }
    if ($isElementNode(node)) node.getChildren().forEach(walk);
  }

  if (!$isElementNode(root)) return segs;
  root.getChildren().forEach((block, i) => {
    if (i > 0) pos += 1;
    walk(block);
  });
  return segs;
}

function removeAllSpellNodes(root: LexicalNode) {
  if ($isSpellErrorNode(root)) {
    (root as SpellErrorNode).replace($createTextNode(root.getTextContent()));
    return;
  }
  if ($isElementNode(root)) {
    [...root.getChildren()].forEach(removeAllSpellNodes);
  }
}

/** Split TextNode at [start, start+len) and wrap that slice with a SpellErrorNode */
function wrapWord(node: TextNode, start: number, len: number, meta: SpellErrorMeta) {
  const full = node.getTextContent();
  const before = full.slice(0, start);
  const word = full.slice(start, start + len);
  const after = full.slice(start + len);
  if (!word) return;

  const err = $createSpellErrorNode(word, meta);
  if (before && after) {
    node.setTextContent(before);
    node.insertAfter(err);
    err.insertAfter($createTextNode(after));
  } else if (before) {
    node.setTextContent(before);
    node.insertAfter(err);
  } else if (after) {
    node.replace(err);
    err.insertAfter($createTextNode(after));
  } else {
    node.replace(err);
  }
}

/** Move caret to the very end of the last text node in the document */
function moveCursorToEnd(editor: ReturnType<typeof useLexicalComposerContext>[0]) {
  editor.update(
    () => {
      const root = $getRoot();
      const lastBlock = root.getLastChild();
      if (!lastBlock || !$isElementNode(lastBlock)) return;
      // Walk to the last leaf TextNode (skip SpellErrorNodes and element nodes)
      let lastTextNode: TextNode | null = null;
      const findLast = (node: LexicalNode): void => {
        if ($isSpellErrorNode(node) || ($isTextNode(node) && !$isSpellErrorNode(node))) {
          lastTextNode = node as TextNode;
          return;
        }
        if ($isElementNode(node)) node.getChildren().forEach(findLast);
      };
      findLast(lastBlock);
      if (!lastTextNode) return;
      const sel = $createRangeSelection();
      const key = (lastTextNode as TextNode).getKey();
      const off = (lastTextNode as TextNode).getTextContent().length;
      sel.anchor.set(key, off, 'text');
      sel.focus.set(key, off, 'text');
      $setSelection(sel);
    },
    { tag: 'spell-clear' },
  );
}

/** Replace all content of the first paragraph with plain text */
function replaceFirstParagraph(
  editor: ReturnType<typeof useLexicalComposerContext>[0],
  text: string,
  onUpdate?: () => void,
) {
  editor.update(
    () => {
      removeAllSpellNodes($getRoot());
      const first = $getRoot().getFirstChild();
      if (first && $isElementNode(first)) {
        first.getChildren().forEach((c) => c.remove());
        first.append($createTextNode(text));
      }
    },
    { tag: 'spell-clear', onUpdate },
  );
}

// ─── Popover component ────────────────────────────────────────────────────────

type PopoverState = {
  x: number;
  y: number;
  issue: SpellCheckIssue;
  nodeKey: string;
  improvedText?: string;
  grammarCorrection?: string;
};

function SpellPopover({
  state,
  onAccept,
  onDismiss,
  onClose,
  onImprove,
  onAcceptGrammar,
}: {
  state: PopoverState;
  onAccept: (replacement: string, nodeKey: string) => void;
  onDismiss: (nodeKey: string) => void;
  onClose: () => void;
  onImprove?: (text: string, nodeKey: string) => void;
  onAcceptGrammar?: (corrected: string) => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const type = state.issue.type ?? 'spelling';

  // Viewport-aware position
  const [pos, setPos] = React.useState({ left: state.x, top: state.y });
  React.useEffect(() => {
    if (!ref.current) return;
    const { offsetHeight: h, offsetWidth: w } = ref.current;
    const top = state.y + h > window.innerHeight - 8 ? state.y - h - 32 : state.y;
    setPos({ left: Math.min(state.x, window.innerWidth - w - 8), top });
  }, [state.x, state.y]);

  // Close on outside click
  React.useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', h, true);
    return () => document.removeEventListener('mousedown', h, true);
  }, [onClose]);

  React.useEffect(() => {
    const h = () => onClose();
    window.addEventListener('scroll', h, { capture: true, passive: true });
    return () => window.removeEventListener('scroll', h, true);
  }, [onClose]);

  React.useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', h, true);
    return () => document.removeEventListener('keydown', h, true);
  }, [onClose]);

  // Grammar correction takes priority over legacy improvedText
  const grammar = state.grammarCorrection;
  const improved = !grammar ? state.improvedText : undefined;

  return createPortal(
    <div
      ref={ref}
      className='sc-popover'
      style={{ left: pos.left, top: pos.top }}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}>
      {' '}
      <div className='sc-popover-header'>
        <span className={`sc-popover-badge sc-popover-badge-${type}`}>{type.toUpperCase()}</span>
        <span className='sc-popover-message'>{state.issue.message}</span>
      </div>
      {state.issue.suggestions.length > 0 ? (
        state.issue.suggestions.slice(0, 5).map((s) => (
          <div
            key={s}
            className='sc-popover-item'
            onClick={(e) => {
              e.stopPropagation();
              onAccept(s, state.nodeKey);
            }}>
            → {s}
          </div>
        ))
      ) : (
        <div className='sc-popover-empty'>No suggestions</div>
      )}
      <div className='sc-popover-footer'>
        <span
          className='sc-popover-action'
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(state.nodeKey);
          }}>
          Ignore
        </span>
        <span
          className='sc-popover-action'
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}>
          Close
        </span>
      </div>
      {grammar && onAcceptGrammar && (
        <div className='sc-popover-improve'>
          <div className='sc-popover-improve-label'>✦ Grammar Suggestion</div>
          <div className='sc-popover-improve-text'>"{grammar}"</div>
          <button
            className='sc-popover-improve-accept'
            onClick={(e) => {
              e.stopPropagation();
              onAcceptGrammar(grammar);
              onClose();
            }}>
            Accept correction
          </button>
        </div>
      )}
      {improved && onImprove && (
        <div className='sc-popover-improve'>
          <div className='sc-popover-improve-label'>✦ Suggested Improvement</div>
          <div className='sc-popover-improve-text'>"{improved}"</div>
          <button
            className='sc-popover-improve-accept'
            onClick={(e) => {
              e.stopPropagation();
              onImprove(improved, state.nodeKey);
            }}>
            Accept improvement
          </button>
        </div>
      )}
    </div>,
    document.body,
  );
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export default function SpellCheckPlugin({
  useSpellCheck,
  onSpellCheckAccept,
  idleMs = 1200,
  enabled = true,
}: {
  /** Return `{ promise, dismiss }` for the given text. */
  useSpellCheck?: (text: string) => SpellCheckResult;
  /** Called after the user accepts any suggestion or correction. */
  onSpellCheckAccept?: (info: {
    original: string;
    replacement: string;
    message: string;
    type?: string;
  }) => void;
  /** Debounce delay in ms before calling the API. Default 1200. */
  idleMs?: number;
  /** Set false to disable without unmounting (clears existing underlines). Default true. */
  enabled?: boolean;
}) {
  const [editor] = useLexicalComposerContext();

  const timerRef = React.useRef<number | null>(null);
  const dismissRef = React.useRef<(() => void) | null>(null);
  const reqIdRef = React.useRef(0);
  const lastTextRef = React.useRef('');
  const applyingRef = React.useRef(false);
  const grammarCorrectionRef = React.useRef<string | undefined>(undefined);

  const [popover, setPopover] = React.useState<PopoverState | null>(null);

  React.useEffect(() => {
    injectCSS();
  }, []);

  // ── Clear all underlines ─────────────────────────────────────────────────

  const clearErrors = React.useCallback(() => {
    setPopover(null);
    grammarCorrectionRef.current = undefined;
    applyingRef.current = true;
    editor.update(
      () => {
        removeAllSpellNodes($getRoot());
      },
      {
        tag: 'spell-clear',
        onUpdate: () => {
          applyingRef.current = false;
        },
      },
    );
  }, [editor]);

  // ── Apply issues ─────────────────────────────────────────────────────────

  const applyIssues = React.useCallback(
    (issues: SpellCheckIssue[], improvedText?: string, trimOffset = 0) => {
      // Capture cursor as absolute char offset — stable across node splits
      let savedCharOffset = -1;
      editor.getEditorState().read(() => {
        const sel = $getSelection();
        if (!$isRangeSelection(sel)) return;
        const anchorKey = sel.anchor.key;
        const anchorOff = sel.anchor.offset;
        let pos = 0;
        let found = false;
        const visit = (node: LexicalNode): void => {
          if (found) return;
          if ($isSpellErrorNode(node) || $isTextNode(node)) {
            if (node.getKey() === anchorKey) {
              savedCharOffset = pos + anchorOff;
              found = true;
              return;
            }
            pos += node.getTextContent().length;
            return;
          }
          if ($isElementNode(node)) node.getChildren().forEach(visit);
        };
        $getRoot()
          .getChildren()
          .forEach((block, i) => {
            if (found) return;
            if (i > 0) pos += 1;
            visit(block);
          });
      });

      applyingRef.current = true;

      editor.update(
        () => {
          try {
            const root = $getRoot();
            removeAllSpellNodes(root);

            const sorted = [...issues].sort((a, b) => a.offset - b.offset);

            for (const issue of sorted) {
              const word = issue.word ?? '';
              if (!word) continue;

              const meta: SpellErrorMeta = {
                message: issue.message,
                suggestions: issue.suggestions,
                type: issue.type ?? 'spelling',
                offset: issue.offset,
              };

              const absOffset = issue.offset + trimOffset;
              let segs = getSegments(root);
              let placed = false;

              // Pass 1: exact offset + text match, with per-segment regex fallback
              for (const seg of segs) {
                if (absOffset < seg.start || absOffset >= seg.end) continue;
                const local = absOffset - seg.start;
                const slice = seg.text.slice(local, local + word.length);
                if (slice.toLowerCase() === word.toLowerCase()) {
                  wrapWord(seg.node, local, word.length, meta);
                  placed = true;
                  break;
                }
                const m =
                  seg.text.match(new RegExp('\\b' + escRx(word) + '\\b', 'i')) ??
                  seg.text.match(new RegExp(escRx(word), 'i'));
                if (m?.index != null) {
                  wrapWord(seg.node, m.index, m[0].length, meta);
                  placed = true;
                  break;
                }
              }

              // Pass 2: full-tree regex scan (handles trimOffset drift)
              if (!placed) {
                segs = getSegments(root); // re-collect after any prior wraps
                for (const seg of segs) {
                  if (!seg.text.trim()) continue;
                  const m =
                    seg.text.match(new RegExp('\\b' + escRx(word) + '\\b', 'i')) ??
                    seg.text.match(new RegExp(escRx(word), 'i'));
                  if (m?.index != null) {
                    wrapWord(seg.node, m.index, m[0].length, meta);
                    placed = true;
                    break;
                  }
                }
              }
            }

            // Grammar-only: no spelling issues but grammar correction exists.
            // We need a click target — underline the first word of text with
            // a 'grammar' style node so the popover can open and show the correction.
            if (issues.length === 0 && !improvedText) {
              // grammarCorrection is stored in grammarCorrectionRef by the caller —
              // we just need any node to be clickable. Wrap first word of first segment.
              const target = getSegments(root).find((s) => s.text.trim());
              if (target) {
                const firstWord = target.text.trim().match(/^\S+/)?.[0] ?? target.text;
                const wordStart = target.text.indexOf(firstWord);
                wrapWord(target.node, wordStart, firstWord.length, {
                  message: 'Grammar suggestion available — click to review',
                  suggestions: [],
                  type: 'grammar',
                  offset: target.start + wordStart,
                });
              }
            }

            // Legacy: full-text style underline for improvedText
            if (improvedText) {
              const target = getSegments(root).find((s) => s.text.trim());
              if (target) {
                wrapWord(target.node, 0, target.text.length, {
                  message: 'AI suggested improvement available',
                  suggestions: [],
                  type: 'style',
                  offset: -1,
                  improvedText,
                });
              }
            }

            // Restore cursor to saved absolute position in new tree
            if (savedCharOffset >= 0) {
              let pos = 0;
              let restored = false;
              const restoreVisit = (node: LexicalNode): void => {
                if (restored) return;
                if ($isSpellErrorNode(node) || $isTextNode(node)) {
                  const len = node.getTextContent().length;
                  if (savedCharOffset <= pos + len) {
                    const sel = $createRangeSelection();
                    const off = savedCharOffset - pos;
                    sel.anchor.set(node.getKey(), off, 'text');
                    sel.focus.set(node.getKey(), off, 'text');
                    $setSelection(sel);
                    restored = true;
                    return;
                  }
                  pos += len;
                  return;
                }
                if ($isElementNode(node)) node.getChildren().forEach(restoreVisit);
              };
              root.getChildren().forEach((block, i) => {
                if (restored) return;
                if (i > 0) pos += 1;
                restoreVisit(block);
              });
            }
          } catch (err) {
            console.error('[SpellCheckPlugin] applyIssues error:', err);
          }
        },
        {
          tag: 'spell-apply',
          onUpdate: () => {
            applyingRef.current = false;
          },
        },
      );
    },
    [editor],
  );

  // ── Click → open popover ─────────────────────────────────────────────────

  React.useEffect(() => {
    let currentRoot: HTMLElement | null = null;

    const onClick = (e: MouseEvent) => {
      const span = (e.target as HTMLElement).closest('[data-spell-offset]') as HTMLElement | null;
      if (!span) return;
      if (!currentRoot?.contains(span)) return;

      editor.getEditorState().read(() => {
        const visit = (node: LexicalNode): void => {
          if ($isSpellErrorNode(node)) {
            const meta = (node as SpellErrorNode).getMeta();
            if (String(meta.offset) === span.dataset.spellOffset) {
              const rect = span.getBoundingClientRect();
              setPopover({
                x: rect.left,
                y: rect.bottom + 8,
                issue: {
                  offset: meta.offset,
                  length: node.getTextContent().length,
                  message: meta.message,
                  suggestions: meta.suggestions,
                  type: meta.type,
                },
                nodeKey: node.getKey(),
                improvedText: meta.improvedText,
                grammarCorrection: grammarCorrectionRef.current,
              });
            }
            return;
          }
          if ($isElementNode(node)) node.getChildren().forEach(visit);
        };
        visit($getRoot());
      });
    };

    // registerRootListener fires immediately with current root, then again on
    // every root change (e.g. Panel mount gives a new contenteditable element).
    const unregister = editor.registerRootListener((nextRoot, prevRoot) => {
      // Detach from old root
      if (prevRoot) prevRoot.removeEventListener('click', onClick);
      // Attach to new root
      if (nextRoot) nextRoot.addEventListener('click', onClick);
      currentRoot = nextRoot;
    });

    return () => {
      unregister();
      if (currentRoot) currentRoot.removeEventListener('click', onClick);
    };
  }, [editor]);

  // ── Accept spelling suggestion ───────────────────────────────────────────

  const handleAccept = React.useCallback(
    (replacement: string, nodeKey: string) => {
      let original = '';
      editor.getEditorState().read(() => {
        const n = $getNodeByKey(nodeKey);
        if ($isSpellErrorNode(n)) original = n.getTextContent();
      });
      editor.update(
        () => {
          const n = $getNodeByKey(nodeKey);
          if ($isSpellErrorNode(n)) (n as SpellErrorNode).replace($createTextNode(replacement));
        },
        { tag: 'spell-clear' },
      );
      moveCursorToEnd(editor);
      setPopover(null);
      lastTextRef.current = '';
      onSpellCheckAccept?.({
        original,
        replacement,
        message: popover?.issue.message ?? '',
        type: popover?.issue.type,
      });
    },
    [editor, onSpellCheckAccept, popover],
  );

  // ── Ignore (remove underline, keep word) ────────────────────────────────

  const handleDismiss = React.useCallback(
    (nodeKey: string) => {
      editor.update(
        () => {
          const n = $getNodeByKey(nodeKey);
          if ($isSpellErrorNode(n))
            (n as SpellErrorNode).replace($createTextNode(n.getTextContent()));
        },
        { tag: 'spell-clear' },
      );
      setPopover(null);
    },
    [editor],
  );

  // ── Accept legacy improved text ──────────────────────────────────────────

  const handleImprove = React.useCallback(
    (text: string) => {
      const original = lastTextRef.current;
      applyingRef.current = true;
      replaceFirstParagraph(editor, text, () => {
        applyingRef.current = false;
      });
      moveCursorToEnd(editor);
      setPopover(null);
      lastTextRef.current = '';
      grammarCorrectionRef.current = undefined;
      onSpellCheckAccept?.({
        original,
        replacement: text,
        message: 'Accepted improved text',
        type: 'style',
      });
    },
    [editor, onSpellCheckAccept],
  );

  // ── Accept grammar correction ────────────────────────────────────────────

  const handleAcceptGrammar = React.useCallback(
    (corrected: string) => {
      const original = lastTextRef.current;
      applyingRef.current = true;
      replaceFirstParagraph(editor, corrected, () => {
        applyingRef.current = false;
      });
      moveCursorToEnd(editor);
      setPopover(null);
      lastTextRef.current = '';
      grammarCorrectionRef.current = undefined;
      onSpellCheckAccept?.({
        original,
        replacement: corrected,
        message: 'Accepted grammar correction',
        type: 'style',
      });
    },
    [editor, onSpellCheckAccept],
  );

  // ── Debounced API trigger ────────────────────────────────────────────────

  React.useEffect(() => {
    if (!enabled || !useSpellCheck) return;

    return editor.registerUpdateListener(({ tags }) => {
      if (applyingRef.current) return;
      if (tags.has('spell-apply') || tags.has('spell-clear') || tags.has('autocomplete-ghost'))
        return;

      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = window.setTimeout(async () => {
        timerRef.current = null;

        let rawText = '';
        editor.getEditorState().read(() => {
          rawText = $getRoot().getTextContent();
        });
        const text = rawText.trim();

        if (!text || text === lastTextRef.current) return;

        dismissRef.current?.();
        const myId = ++reqIdRef.current;
        const { promise, dismiss } = useSpellCheck(text);
        dismissRef.current = dismiss;

        try {
          const payload = await promise;
          if (myId !== reqIdRef.current) return; // superseded

          lastTextRef.current = text;

          const hasContent =
            payload?.issues?.length || payload?.grammarCorrection || payload?.improvedText;
          if (!payload || !hasContent) {
            clearErrors();
            return;
          }

          grammarCorrectionRef.current = payload.grammarCorrection ?? undefined;

          const improved =
            payload.improvedText && payload.improvedText.trim() !== text
              ? payload.improvedText
              : undefined;

          applyIssues(payload.issues ?? [], improved, rawText.length - rawText.trimStart().length);
        } catch (e) {
          console.error('[SpellCheckPlugin] request failed:', e);
          lastTextRef.current = '';
        }
      }, idleMs);
    });
  }, [editor, useSpellCheck, enabled, idleMs, applyIssues, clearErrors]);

  // ── enabled toggle ───────────────────────────────────────────────────────

  React.useEffect(() => {
    if (!enabled) {
      clearErrors();
      lastTextRef.current = '';
    }
  }, [enabled, clearErrors]);

  // ── Unmount cleanup ──────────────────────────────────────────────────────

  React.useEffect(
    () => () => {
      dismissRef.current?.();
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return popover ? (
    <SpellPopover
      state={popover}
      onAccept={handleAccept}
      onDismiss={handleDismiss}
      onClose={() => setPopover(null)}
      onImprove={handleImprove}
      onAcceptGrammar={handleAcceptGrammar}
    />
  ) : null;
}
