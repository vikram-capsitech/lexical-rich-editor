import { Stack } from '@fluentui/react';
import { PaintBucket16Filled, TextColorRegular } from '@fluentui/react-icons';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelectionStyleValueForProperty, $patchStyleText } from '@lexical/selection';
import { mergeRegister } from '@lexical/utils';
import {
  $getSelection,
  $isRangeSelection,
  $setSelection,
  SELECTION_CHANGE_COMMAND,
  type RangeSelection,
} from 'lexical';
import React from 'react';
import { ColorPickerControl } from '../Nodes/ColorPickerComponent';
import { LOW_PRIORIRTY } from '../Types/EditorType';

export const ColorPickerPlugin = ({ disabled }: { disabled: boolean }) => {
  const [editor] = useLexicalComposerContext();
  const [{ color, bgColor }, setColors] = React.useState({ color: '#000000', bgColor: '#ffffff' });

  const lastRangeSelectionRef = React.useRef<RangeSelection | null>(null);

  const updateToolbar = () => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      lastRangeSelectionRef.current = selection.clone();

      const c = $getSelectionStyleValueForProperty(selection, 'color', '#000000');
      const bg = $getSelectionStyleValueForProperty(selection, 'background-color', '#ffffff');
      setColors({ color: c, bgColor: bg });
    }
  };

  React.useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => updateToolbar());
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          updateToolbar();
          return false;
        },
        LOW_PRIORIRTY
      )
    );
  }, [editor]);

  const applyStyle = (args: { property: 'background-color' | 'color'; color: string }) => {
    if (disabled) return;

    // Only refocus the editor if it currently owns focus or had a saved selection
    // (i.e., the user was working in the editor). This prevents the color picker
    // from stealing focus from other fields (e.g. To/CC/BCC in email forms).
    const root = editor.getRootElement();
    const editorIsActive =
      !!lastRangeSelectionRef.current &&
      !!root &&
      (document.activeElement === root || root.contains(document.activeElement as Node));
    if (editorIsActive) editor.focus();

    editor.update(() => {
      const saved = lastRangeSelectionRef.current;
      if (saved) {
        $setSelection(saved.clone());
      }

      const selection = $getSelection();

      if ($isRangeSelection(selection)) {
        $patchStyleText(selection, { [args.property]: args.color });
      }
    });
  };

  const containerStyle: React.CSSProperties = disabled
    ? {
        display: 'flex',
        gap: 6,
        alignItems: 'center',
        opacity: 0.55,
        cursor: 'not-allowed',
        pointerEvents: 'none',
        filter: 'grayscale(0.25)',
      }
    : {
        display: 'flex',
        gap: 6,
        alignItems: 'center',
      };

  const iconColor = disabled ? 'var(--colorNeutralForegroundDisabled, #A6A6A6)' : '#333333';

  return (
    <Stack horizontal verticalAlign='center' style={containerStyle}>
      <ColorPickerControl
        value={color}
        title='Text color'
        disabled={disabled}
        icon={<TextColorRegular style={{ color: iconColor }} />}
        onChange={(c) => applyStyle({ property: 'color', color: c })}
      />

      <ColorPickerControl
        value={bgColor}
        title='Background color'
        disabled={disabled}
        icon={<PaintBucket16Filled style={{ color: iconColor }} />}
        onChange={(c) => applyStyle({ property: 'background-color', color: c })}
      />
    </Stack>
  );
};
