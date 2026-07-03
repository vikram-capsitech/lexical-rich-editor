import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $isDecoratorNode, $isElementNode, $isLineBreakNode, $isTextNode, LexicalEditor } from 'lexical';
import React, { useImperativeHandle } from 'react';
import { ContentEditorRef } from '../ContentEditorComponent.types';
import { $isHtmlBlockNode } from '../Nodes/HtmlBlockNode';
import { BlockSpec, hasBlock, removeBlock, upsertBlock } from '../Utils/Helper';
import { normalizeToBlockHtml, postProcessOutput, sanitizeHtml } from '../Utils/Sanitize';
import { splitHeadingsAtBrSequences } from './CustomOnChange';

/**
 * Builds a stable string that represents only the user-typed content in the
 * editor, including text, inline formatting, and block structure.
 *
 * Captures:
 *   • TextNode text content + format bitmask (bold/italic/underline/etc.)
 *     and inline style — so formatting-only changes (e.g. bolding a word)
 *     are detected even when the plain text is unchanged.
 *   • ElementNode type + tag + listType + format so heading-level, list-type,
 *     quote, and alignment changes are also detected.
 *   • Decorator node keys (images, YouTube) so adding/removing media is
 *     detected even when text is unchanged.
 *
 * Excluded: HtmlBlockNode children (signature, footer, banner — system blocks).
 */
function getUserContentSignature(editor: LexicalEditor): string {
  const parts: string[] = [];

  editor.getEditorState().read(() => {
    const root = $getRoot();

    const collectNode = (node: any) => {
      if ($isHtmlBlockNode(node)) return;

      if ($isDecoratorNode(node)) {
        parts.push(`D:${node.getKey()}`);
        return;
      }

      if ($isLineBreakNode(node)) {
        parts.push('BR');
        return;
      }

      if ($isTextNode(node)) {
        // Include format bitmask so bold/italic/underline changes are detected.
        // Include style so colour/font changes are detected.
        parts.push(`T${node.getFormat()}:${node.getStyle()}:${node.getTextContent()}`);
        return;
      }

      if ($isElementNode(node)) {
        const type = node.getType();
        // Heading level (h1–h6) via HeadingNode.getTag()
        const tag   = typeof (node as any).getTag      === 'function' ? (node as any).getTag()      : '';
        // List type (bullet / number / check) via ListNode.getListType()
        const list  = typeof (node as any).getListType === 'function' ? (node as any).getListType() : '';
        // Paragraph/element alignment format
        const fmt   = typeof (node as any).getFormat   === 'function' ? (node as any).getFormat()   : '';
        parts.push(`[${type}:${tag}:${list}:${fmt}]`);
        for (const child of node.getChildren()) {
          collectNode(child);
        }
        parts.push('[/]');
      }
    };

    for (const child of root.getChildren()) {
      if ($isHtmlBlockNode(child)) continue;
      collectNode(child);
    }
  });

  return JSON.stringify(parts);
}

export default function RefApiPlugin({
  forwardedRef,
  contentEditableDomRef,
  focusedRef,
}: {
  forwardedRef: React.Ref<ContentEditorRef>;
  contentEditableDomRef: React.RefObject<HTMLDivElement>;
  focusedRef: React.MutableRefObject<boolean>;
}) {
  const [editor] = useLexicalComposerContext();
  // Clean baseline for checkDirty().
  //
  // null  = not yet captured; checkDirty() returns false during this window.
  // ""    = editor was empty when it first loaded.
  // text  = whatever getUserContentSignature() returned after the initial load.
  //
  // We capture lazily via a one-shot updateListener so the baseline always
  // reflects the actual first loaded state (whether that is an empty editor,
  // a pre-populated signature via the value prop, or anything else).
  // getUserContentSignature() is text-based and always stable, so this
  // comparison is reliable across any Lexical version or empty-state variant.
  const cleanBaselineRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    // Strategy: capture the baseline from whatever content is in the editor
    // after the initial load settles, so the default value (signature, etc.)
    // is always treated as clean.
    //
    // Two mechanisms work together:
    //
    // 1. registerUpdateListener  — fires when CustomOnChangePlugin's
    //    editor.update() commits the initial value prop as a Lexical microtask.
    //    This is the fast path when the editor has pre-populated content.
    //
    // 2. setTimeout(0) fallback  — macrotasks run after all pending microtasks,
    //    so it fires AFTER Lexical has flushed any scheduled updates.
    //    If the editor loaded with content the listener already captured it and
    //    this is a no-op.  If the editor is empty (no update was scheduled)
    //    this captures "" so the empty state is also treated as clean.

    const capture = () => {
      if (cleanBaselineRef.current === null) {
        cleanBaselineRef.current = getUserContentSignature(editor);
      }
    };

    const unregister = editor.registerUpdateListener(({ dirtyElements, dirtyLeaves }) => {
      if (cleanBaselineRef.current !== null) { unregister(); return; }
      if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return;
      capture();
      unregister();
    });

    const timerId = setTimeout(capture, 0);

    return () => {
      clearTimeout(timerId);
      unregister();
    };
  }, [editor]);

  useImperativeHandle(
    forwardedRef,
    (): ContentEditorRef =>
      ({
        setValue: (html: string) => {
          editor.update(() => {
            const safe = normalizeToBlockHtml(sanitizeHtml(html || ''));
            const parser = new DOMParser();
            const dom = parser.parseFromString(safe || '<p></p>', 'text/html');
            const nodes = $generateNodesFromDOM(editor, dom);
            const root = $getRoot();
            root.clear();
            root.append(...nodes);
          });
        },

        getValue: () => {
          let html = '';
          editor.getEditorState().read(() => {
            html = postProcessOutput(splitHeadingsAtBrSequences($generateHtmlFromNodes(editor, null)));
          });
          return html;
        },

        clear: () => {
          editor.update(() => {
            $getRoot().clear();
          });
        },

        focus: () => contentEditableDomRef.current?.focus(),
        blur: () => contentEditableDomRef.current?.blur(),

        isEmpty: () => {
          let empty = true;
          editor.getEditorState().read(() => {
            empty = $getRoot().getTextContent().trim().length === 0;
          });
          return empty;
        },

        isFocused: () => focusedRef.current,
        getEditor: () => editor,

        // Generic blocks (signature, footer, banner, etc.)
        upsertBlock: (spec: BlockSpec) => upsertBlock(editor, spec),
        removeBlock: (kind: string) => removeBlock(editor, kind),
        hasBlock: (kind: string) => hasBlock(editor, kind),

        checkDirty: () => {
          if (cleanBaselineRef.current === null) return false;
          const current = getUserContentSignature(editor);
          return current !== cleanBaselineRef.current;
        },

        markClean: () => {
          cleanBaselineRef.current = getUserContentSignature(editor);
        },
      }) as any,
    [editor, contentEditableDomRef, focusedRef],
  );

  return null;
}
