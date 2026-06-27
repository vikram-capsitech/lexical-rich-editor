import { Dropdown, makeStyles, Option } from '@fluentui/react-components';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelectionStyleValueForProperty, $patchStyleText } from '@lexical/selection';
import { mergeRegister } from '@lexical/utils';
import { $getSelection, $isRangeSelection, SELECTION_CHANGE_COMMAND } from 'lexical';
import { useCallback, useEffect, useState } from 'react';
import { LOW_PRIORIRTY } from '../Types/EditorType';

const useStyles = makeStyles({
  fontFamily: {
    border: 'none',
    minInlineSize: '70px',
    backgroundColor: 'transparent',
  },
});

const FONT_FAMILY_OPTIONS: [string, string][] = [
  ['Arial', 'Arial'],
  ['Courier New', 'Courier'],
  ['Comic Sans MS', 'Comic'],
  ['Georgia', 'Georgia'],
  ['Times New Roman', 'Times'],
  ['Verdana', 'Verdana'],
  ['Lucida Serif', 'Lucida'],
  ['Trebuchet MS', 'Trebuchet'],
  ['Tahoma', 'Tahoma'],
];

export const FontFamilyPlugin = ({ disabled = false }: { disabled?: boolean }) => {
  const [editor] = useLexicalComposerContext();
  const styles = useStyles();

  const [fontFamily, setFontFamily] = useState<string>('');

  const fg = disabled ? 'var(--colorNeutralForegroundDisabled, #A6A6A6)' : '#333333';

  useEffect(() => {
    const readFontFamily = () => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const raw = $getSelectionStyleValueForProperty(selection, 'font-family', '');
        setFontFamily(raw.replace(/['"]/g, '').trim());
      }
    };

    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(readFontFamily);
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          readFontFamily();
          return false;
        },
        LOW_PRIORIRTY,
      ),
    );
  }, [editor]);

  const handleClick = useCallback(
    (option: string) => {
      if (disabled) return;

      editor.update(() => {
        const selection = $getSelection();
        if (selection) {
          $patchStyleText(selection, {
            ['font-family']: option,
          });
        }
      });
    },
    [editor, disabled]
  );

  return (
    <Dropdown
      disabled={disabled}
      key='font-family'
      id='font-family-option'
      placeholder='Style'
      value={fontFamily}
      selectedOptions={fontFamily ? [fontFamily] : []}
      className={styles.fontFamily}
      style={{
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      button={{
        style: {
          color: fg,
          backgroundColor: 'transparent',
          border: 'none',
        },
      }}
      expandIcon={{ style: { color: fg } }}
      listbox={{ style: { minInlineSize: '170px' } }}
      onOptionSelect={(_, data) => {
        const val = data.optionValue as string;
        if (val) handleClick(val);
      }}>
      {FONT_FAMILY_OPTIONS.map(([option, text]) => (
        <Option key={option} value={option} text={option}>
          <span style={{ fontFamily: option }}>{option}</span>
        </Option>
      ))}
    </Dropdown>
  );
};
