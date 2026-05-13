import { Stack } from '@fluentui/react';
import { Dropdown, makeStyles, Option } from '@fluentui/react-components';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelectionStyleValueForProperty, $patchStyleText } from '@lexical/selection';
import { mergeRegister } from '@lexical/utils';
import { $getSelection, $isRangeSelection, SELECTION_CHANGE_COMMAND } from 'lexical';
import * as React from 'react';
import { LOW_PRIORIRTY } from '../Types/EditorType';
import { DEFAULT_FONT_SIZE } from '../Utils/Index';

const FONT_SIZE_OPTIONS = [
  '8',
  '9',
  '10',
  '11',
  '12',
  '13',
  '14',
  '15',
  '16',
  '17',
  '18',
  '19',
  '20',
  '21',
  '22',
  '23',
  '24',
  '25',
  '26',
  '27',
  '28',
  '29',
  '30',
  '31',
  '32',
  '36',
  '40',
  '42',
  '46',
  '48',
  '50',
  '52',
  '54',
  '56',
  '58',
  '60',
  '62',
  '64',
  '66',
  '67',
  '68',
  '70',
  '72',
  '74',
  '76',
];

const useStyles = makeStyles({
  dropdown: {
    minInlineSize: '50px',
    border: 'none',
    backgroundColor: 'transparent',
  },
});

export const FontSizePlugin = ({ disabled }: { disabled: boolean }) => {
  const [editor] = useLexicalComposerContext();
  const styles = useStyles();

  const [fontSize, setFontSize] = React.useState<string>(String(DEFAULT_FONT_SIZE));

  const fg = disabled ? 'var(--colorNeutralForegroundDisabled, #A6A6A6)' : '#333333';

  React.useEffect(() => {
    const readFontSize = () => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const raw = $getSelectionStyleValueForProperty(
          selection,
          'font-size',
          `${DEFAULT_FONT_SIZE}px`,
        );
        const numeric = raw.replace('px', '').trim();
        if (numeric) setFontSize(numeric);
      }
    };

    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(readFontSize);
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          readFontSize();
          return false;
        },
        LOW_PRIORIRTY,
      ),
    );
  }, [editor]);

  const updateFontSizeInSelection = (newFontSizePx: string) => {
    if (disabled) return;

    editor.update(() => {
      const selection = $getSelection();
      if (selection) {
        $patchStyleText(selection, { 'font-size': `${newFontSizePx}px` });
      }
    });
  };

  return (
    <Stack horizontal tokens={{ childrenGap: 4 }}>
      <Dropdown
        key='fontsize'
        value={fontSize}
        selectedOptions={[fontSize]}
        disabled={disabled}
        className={styles.dropdown}
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
        onOptionSelect={(_, o) => {
          if (disabled) return;
          const v = String(o.optionValue ?? '');
          if (!v) return;

          setFontSize(v);
          updateFontSizeInSelection(v);
        }}
        listbox={{
          style: {
            minInlineSize: '100px',
            color: '#707070',
          },
        }}>
        <Stack style={{ maxHeight: 250, overflowY: 'auto' }}>
          {FONT_SIZE_OPTIONS.map((size) => (
            <Option key={size} value={size} text={size}>
              {size} px
            </Option>
          ))}
        </Stack>
      </Dropdown>
    </Stack>
  );
};
