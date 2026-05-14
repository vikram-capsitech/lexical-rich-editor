import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { $getRoot, $setSelection } from 'lexical';
import { useCallback, useEffect, useRef } from 'react';

interface ICustomOnChangePluginProps {
  value: string;
  onChange: (value: string) => void;
}

export const CustomOnChangePlugin = ({ value, onChange }: ICustomOnChangePluginProps) => {
  const [editor] = useLexicalComposerContext();
  const initializedRef = useRef(false);

  // Always-current ref so the stable handleChange below never goes stale.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

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

      // Prevent Lexical from placing a DOM cursor after this programmatic update.
      // Without this, Lexical's commitPendingUpdates tries to sync the selection
      // into the contenteditable, which causes some browsers to focus the element
      // even when the user is typing in another field (e.g. To / CC / BCC).
      $setSelection(null);
    });
  }, [editor, value]);

  // Stable reference — never changes across renders because it only depends on
  // `editor` (which is stable for the lifetime of the composer).
  // This prevents OnChangePlugin from re-registering its Lexical update listener
  // on every render. Without stability, each re-registration can flush Lexical's
  // pending selection state (the cursor from the user's last edit), which causes
  // the browser to re-focus the contenteditable even when the user has already
  // moved to another field (e.g. Subject).
  const handleChange = useCallback((editorState: any) => {
    editorState.read(() => {
      onChangeRef.current($generateHtmlFromNodes(editor));
    });
  }, [editor]);

  return (
    <OnChangePlugin
      onChange={handleChange}
      ignoreSelectionChange
    />
  );
};
