import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { COMMAND_PRIORITY_CRITICAL, KEY_DOWN_COMMAND } from 'lexical';
import { useEffect } from 'react';

export default function DebugKeyPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand<KeyboardEvent>(
      KEY_DOWN_COMMAND,
      (event) => {
        if (event.key.toLowerCase() === 'k') {
          console.log('[DebugKeyPlugin] "k" key pressed', {
            key: event.key,
            code: event.code,
            ctrlKey: event.ctrlKey,
            metaKey: event.metaKey,
            altKey: event.altKey,
            shiftKey: event.shiftKey,
            defaultPrevented: event.defaultPrevented,
            target: event.target,
          });
        }
        return false;
      },
      COMMAND_PRIORITY_CRITICAL,
    );
  }, [editor]);

  return null;
}
