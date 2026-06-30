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
    const isRange = $isRangeSelection(selection);
    // eslint-disable-next-line no-console
    console.log('[AO-ColorPicker] updateToolbar', {
      isRangeSelection: isRange,
      isCollapsed: isRange ? (selection as RangeSelection).isCollapsed() : null,
    });
    if (isRange) {
      lastRangeSelectionRef.current = selection!.clone();

      const c = $getSelectionStyleValueForProperty(selection as RangeSelection, 'color', '#000000');
      const bg = $getSelectionStyleValueForProperty(
        selection as RangeSelection,
        'background-color',
        '#ffffff',
      );
      // eslint-disable-next-line no-console
      console.log('[AO-ColorPicker] updateToolbar readback', { color: c, bgColor: bg });
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
  // active surface" at any later point (inside applyStyle) is meaningless,
  // since by then focus already belongs to the open popover.
  const wasEditorActiveRef = React.useRef(false);

  const handleOpenChange = (open: boolean) => {
    if (open) {
      const root = editor.getRootElement();
      wasEditorActiveRef.current =
        !!root && (document.activeElement === root || root.contains(document.activeElement as Node));
    } else if (wasEditorActiveRef.current) {
      // Restore focus exactly once, when the popover actually closes — not
      // on every intermediate color commit while it's open. Lexical's own
      // reconciler will also try to force focus onto the root whenever an
      // update touches selection and the root doesn't currently have it
      // (see SKIP_SELECTION_FOCUS_TAG below); doing this repeatedly while
      // the popover is open fights Fluent's Callout for focus on every
      // single drag move, which was producing a focus tug-of-war that
      // intermittently cleared the selection mid-drag.
      editor.focus();
    }
  };

  const applyStyle = (args: { property: 'background-color' | 'color'; color: string }) => {
    if (disabled) return;

    // eslint-disable-next-line no-console
    console.log('[AO-ColorPicker] applyStyle called', {
      property: args.property,
      color: args.color,
      hasSavedSelection: !!lastRangeSelectionRef.current,
      savedSelectionIsCollapsed: lastRangeSelectionRef.current?.isCollapsed() ?? null,
      wasEditorActiveAtOpen: wasEditorActiveRef.current,
      activeElementTag: document.activeElement?.tagName,
      activeElementClass: (document.activeElement as HTMLElement | null)?.className,
    });

    editor.update(
      () => {
        const saved = lastRangeSelectionRef.current;
        if (saved) {
          $setSelection(saved.clone());
        }

        const selection = $getSelection();
        const isRange = $isRangeSelection(selection);

        // eslint-disable-next-line no-console
        console.log('[AO-ColorPicker] applyStyle inside editor.update', {
          hadSavedSelection: !!saved,
          selectionAfterRestoreIsRange: isRange,
          selectionAfterRestoreIsCollapsed: isRange ? (selection as RangeSelection).isCollapsed() : null,
        });

        if (isRange) {
          $patchStyleText(selection as RangeSelection, { [args.property]: args.color });

          const verify = $getSelectionStyleValueForProperty(
            selection as RangeSelection,
            args.property,
            '<none>',
          );
          // eslint-disable-next-line no-console
          console.log('[AO-ColorPicker] applyStyle after patchStyleText, readback in same update', {
            property: args.property,
            appliedColor: args.color,
            readBack: verify,
          });
        } else {
          // eslint-disable-next-line no-console
          console.warn(
            '[AO-ColorPicker] applyStyle: no range selection available — style was NOT applied',
            { property: args.property, color: args.color },
          );
        }
      },
      // Without this tag, Lexical's reconciler force-focuses the editor root
      // whenever this update's selection diff finds the root isn't already
      // focused (see Lexical.dev.mjs ~8112) — which it never is while the
      // color picker's Callout legitimately holds focus. That forced focus
      // then fights Fluent's Callout for focus on every single drag-driven
      // commit, repeatedly bouncing focus (and, via FocusEventsPlugin,
      // nulling and restoring the selection) between the editor and the
      // popover until the drag's tracked color desynced from the cursor.
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
