import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { $getRoot } from 'lexical';
import { useEffect, useRef } from 'react';

interface ICustomOnChangePluginProps {
  value: string;
  onChange: (value: string) => void;
}

export const CustomOnChangePlugin = ({ value, onChange }: ICustomOnChangePluginProps) => {
  const [editor] = useLexicalComposerContext();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!value || initializedRef.current) return;

    initializedRef.current = true;

    editor.update(() => {
      const root = $getRoot();
      root.clear();

      const parser = new DOMParser();
      const dom = parser.parseFromString(value, 'text/html');
      const nodes = $generateNodesFromDOM(editor, dom);

      root.append(...nodes);
    });
  }, [editor, value]);

  return (
    <OnChangePlugin
      onChange={(editorState) => {
        editorState.read(() => {
          onChange($generateHtmlFromNodes(editor));
        });
      }}
    />
  );
};
