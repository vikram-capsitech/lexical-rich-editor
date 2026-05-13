import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot } from 'lexical';
import React, { useImperativeHandle } from 'react';
import { ContentEditorRef } from '../ContentEditorComponent.types';
import { BlockSpec, hasBlock, removeBlock, upsertBlock } from '../Utils/Helper';

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

  useImperativeHandle(
    forwardedRef,
    (): ContentEditorRef =>
      ({
        setValue: (html: string) => {
          editor.update(() => {
            const parser = new DOMParser();
            const dom = parser.parseFromString(html || '<p></p>', 'text/html');
            const nodes = $generateNodesFromDOM(editor, dom);
            const root = $getRoot();
            root.clear();
            root.append(...nodes);
          });
        },

        getValue: () => {
          let html = '';
          editor.getEditorState().read(() => {
            html = $generateHtmlFromNodes(editor, null);
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
      }) as any,
    [editor, contentEditableDomRef, focusedRef],
  );

  return null;
}
