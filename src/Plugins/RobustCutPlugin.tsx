import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection,
  $isNodeSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  KEY_DOWN_COMMAND,
} from 'lexical';
import { useEffect } from 'react';

/**
 * Chrome (and other browsers) map Shift+Delete to the OS-level "Cut"
 * shortcut, which fires a native `cut` ClipboardEvent instead of an ordinary
 * delete keystroke. Lexical's default CUT_COMMAND handler awaits an async
 * clipboard write before it deletes the selection — in hosts where clipboard
 * access is restricted, or the native `cut` event never reaches Lexical's own
 * listener at all (sandboxed iframes, some embedded/Electron contexts,
 * stricter Permissions-Policy setups), that chain can silently never reach
 * the delete step, making Shift+Delete look like it does nothing.
 *
 * This intercepts the keydown directly and deletes the selection
 * synchronously, independent of the native cut/clipboard event pipeline.
 * Clipboard population is still attempted afterward as a best-effort,
 * fire-and-forget step — its failure never blocks the deletion above.
 */
export default function RobustCutPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand<KeyboardEvent>(
      KEY_DOWN_COMMAND,
      (event) => {
        const isShiftDelete =
          event.key === 'Delete' && event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey;
        if (!isShiftDelete) return false;

        let plainText: string | null = null;

        editor.getEditorState().read(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection) && !selection.isCollapsed()) {
            plainText = selection.getTextContent();
          } else if ($isNodeSelection(selection) && selection.getNodes().length > 0) {
            plainText = '';
          }
        });

        if (plainText === null) return false;

        event.preventDefault();

        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            selection.removeText();
          } else if ($isNodeSelection(selection)) {
            selection.getNodes().forEach((node) => node.remove());
          }
        });

        if (plainText && navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(plainText).catch(() => {});
        }

        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor]);

  return null;
}
