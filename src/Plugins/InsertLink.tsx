import { Button } from '@fluentui/react-components';
import { LinkAddRegular } from '@fluentui/react-icons';
import { $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $findMatchingParent } from '@lexical/utils';
import { $getSelection, $isRangeSelection } from 'lexical';
import { getSelectedNode } from './FloatLinkEditor';

/**
 * Toolbar entry point for inserting a link. Wraps the current selection in a
 * link node (if it isn't one already) and hands off to the floating
 * `FloatingLinkEditor` — the exact same UI used when editing an existing
 * link — instead of a separate popover form.
 */
export const InsertLinkPlugin = ({
  disabled,
  setIsLinkEditMode,
}: {
  disabled: boolean;
  setIsLinkEditMode: (isLinkEditMode: boolean) => void;
}) => {
  const [editor] = useLexicalComposerContext();

  const iconColor = disabled ? 'var(--colorNeutralForegroundDisabled, #A6A6A6)' : '#333333';

  const insertLink = () => {
    if (disabled) return;

    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;

      const node = getSelectedNode(selection);
      const linkParent = $findMatchingParent(node, $isLinkNode);

      if (!linkParent && !$isLinkNode(node)) {
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, 'https://');
      }
    });

    setIsLinkEditMode(true);
  };

  return (
    <Button
      size='small'
      title='Add link'
      key='insert-link'
      disabled={disabled}
      icon={<LinkAddRegular style={{ color: iconColor }} />}
      style={{
        background: 'none',
        border: 'none',
        margin: 2,
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      onMouseDown={(event) => event.preventDefault()}
      onClick={insertLink}
    />
  );
};
