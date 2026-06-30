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
  SKIP_SELECTION_FOCUS_TAG,
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

  // Captured once, synchronously, the instant a picker's trigger button is
  // clicked — i.e. before Fluent's Callout (setInitialFocus) has a chance to
  // move DOM focus into the portaled popover. Checking "is the editor the
  // active surface" at any later point is meaningless, since by then focus
  // already belongs to the open popover.
  const wasEditorActiveRef = React.useRef(false);

  const handleOpenChange = (open: boolean) => {
    if (open) {
      const root = editor.getRootElement();
      wasEditorActiveRef.current =
        !!root && (document.activeElement === root || root.contains(document.activeElement as Node));
    } else if (wasEditorActiveRef.current) {
      // Restore focus once the popover closes, so the user can keep typing
      // immediately — but only if the editor actually owned focus before
      // the picker opened (don't steal focus from unrelated fields, e.g.
      // To/CC/BCC in an email form).
      editor.focus();
    }
  };

  const applyStyle = (args: { property: 'background-color' | 'color'; color: string }) => {
    if (disabled) return;

    editor.update(
      () => {
        const saved = lastRangeSelectionRef.current;
        if (saved) {
          $setSelection(saved.clone());
        }

        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $patchStyleText(selection, { [args.property]: args.color });
        }
      },
      // Without this tag, Lexical's reconciler force-focuses the editor root
      // whenever this update's selection diff finds the root isn't already
      // focused — which it isn't while the color picker's Callout holds
      // focus. The picker now only calls applyStyle once, on Apply, so this
      // is no longer fighting for focus on every drag pixel, but there's no
      // reason to force a focus change here at all — handleOpenChange above
      // already does that deliberately, once, on close.
      { tag: SKIP_SELECTION_FOCUS_TAG },
    );
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
        onOpenChange={handleOpenChange}
      />

      <ColorPickerControl
        value={bgColor}
        title='Background color'
        disabled={disabled}
        icon={<PaintBucket16Filled style={{ color: iconColor }} />}
        onChange={(c) => applyStyle({ property: 'background-color', color: c })}
        onOpenChange={handleOpenChange}
      />
    </Stack>
  );
};
