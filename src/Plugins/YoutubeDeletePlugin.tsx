import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection,
  $isDecoratorNode,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
} from 'lexical';
import { useEffect } from 'react';

// If you have an exported guard, use it instead of $isDecoratorNode:
// import { $isYoutubeNode } from "../Nodes/YoutubeNode";

function isYoutubeLikeNode(node: any) {
  // Prefer your node type check if available:
  // return $isYoutubeNode(node);

  // Fallback: check by type string (common for custom nodes)
  try {
    return node?.getType?.() === 'youtube';
  } catch {
    return false;
  }
}

export default function YoutubeDeletePlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const removeIfYoutubeAtCursor = (direction: 'backward' | 'forward') => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return false;

      const anchor = selection.anchor;

      // Only when caret selection (not text range)
      if (!selection.isCollapsed()) return false;

      const currentNode = anchor.getNode();

      // Case 1: selection is on the node itself (sometimes happens)
      if (isYoutubeLikeNode(currentNode)) {
        currentNode.remove();
        return true;
      }

      // Case 2: cursor is in a text node next to the youtube node
      const sibling =
        direction === 'backward' ? currentNode.getPreviousSibling() : currentNode.getNextSibling();

      if (
        sibling &&
        (isYoutubeLikeNode(sibling) || ($isDecoratorNode(sibling) && isYoutubeLikeNode(sibling)))
      ) {
        sibling.remove();
        return true;
      }

      // Case 3: cursor is inside a paragraph and youtube is outside paragraph
      const parent = currentNode.getParent();
      if (parent) {
        const parentSibling =
          direction === 'backward' ? parent.getPreviousSibling() : parent.getNextSibling();

        if (parentSibling && isYoutubeLikeNode(parentSibling)) {
          parentSibling.remove();
          return true;
        }
      }

      return false;
    };

    return editor.registerCommand(
      KEY_BACKSPACE_COMMAND,
      () => removeIfYoutubeAtCursor('backward'),
      COMMAND_PRIORITY_HIGH
    );
  }, [editor]);

  useEffect(() => {
    return editor.registerCommand(
      KEY_DELETE_COMMAND,
      () => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;
        const currentNode = selection.anchor.getNode();
        const next =
          currentNode.getNextSibling() ?? currentNode.getParent()?.getNextSibling() ?? null;
        if (next && next.getType?.() === 'youtube') {
          next.remove();
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_HIGH
    );
  }, [editor]);

  return null;
}
