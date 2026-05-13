import { Stack, useTheme } from '@fluentui/react'; // v8 theme
import { Button, Dropdown, makeStyles, Option } from '@fluentui/react-components';
import { CodeRegular } from '@fluentui/react-icons';
import {
  $createCodeNode,
  $isCodeNode,
  getCodeLanguages,
  getDefaultCodeLanguage,
  registerCodeHighlighting,
} from '@lexical/code';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $setBlocksType } from '@lexical/selection';
import { $getNodeByKey, $getSelection, $isRangeSelection } from 'lexical';
import { useCallback, useEffect, useMemo } from 'react';

interface ICodeBlockPlugin {
  disabled: boolean;
  codeLanguage: string;
  selectNodeType: string;
  selectedElementKey: string;
}

// Compute once at module load (already good)
const LANGUAGES = getCodeLanguages();

const useStyles = makeStyles({
  dropdown: {
    minInlineSize: '100px',
    border: 'none',
    backgroundColor: 'transparent',
  },
});

export const CodeBlockPlugin = (props: ICodeBlockPlugin) => {
  const [editor] = useLexicalComposerContext();
  const v8Theme = useTheme(); // Fluent UI v8 theme (palette)
  const styles = useStyles();

  // Register highlighting once per editor instance
  useEffect(() => {
    return registerCodeHighlighting(editor);
  }, [editor]);

  // derive instead of state: show dropdown only when selection is a code node
  const isInCodeBlock = props.selectNodeType === 'code';

  // Theme-driven colors (v8 palette)
  const colors = useMemo(() => {
    const p = v8Theme.palette;
    return {
      icon: props.disabled ? p.neutralTertiary : p.neutralPrimary,
      hoverBg: p.neutralLighter,
      pressedBg: p.neutralLight,
      listFg: p.neutralSecondary,
      stroke: p.neutralLight,
      bg: p.white,
    };
  }, [v8Theme, props.disabled]);

  const onAddCodeBlock = useCallback(() => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createCodeNode());
      }
    });
  }, [editor]);

  const onSelectLanguage = useCallback(
    (_e: unknown, o: any) => {
      const language: string | undefined = o?.optionValue;
      if (!language) return;

      editor.update(() => {
        if (!props.selectedElementKey) return;
        const node = $getNodeByKey(props.selectedElementKey);
        if ($isCodeNode(node)) {
          node.setLanguage(language);
        }
      });
    },
    [editor, props.selectedElementKey]
  );

  // Prefer a stable value for dropdown (fallback to default)
  const dropdownValue = props.codeLanguage || getDefaultCodeLanguage();

  return (
    <Stack horizontal verticalAlign='center'>
      <Button
        size='small'
        disabled={props.disabled}
        icon={<CodeRegular style={{ color: colors.icon }} />}
        onClick={onAddCodeBlock}
        style={{
          background: 'transparent',
          border: 'none',
          margin: 2,
          // better hit target
          minWidth: 28,
          paddingInline: 6,

          // Try to influence v9 state colors (works in many builds)
          ['--fui-Button__backgroundColor' as any]: 'transparent',
          ['--fui-Button__backgroundColorHover' as any]: colors.hoverBg,
          ['--fui-Button__backgroundColorPressed' as any]: colors.pressedBg,
        }}
      />

      {isInCodeBlock && (
        <Dropdown
          id='language-option'
          placeholder='Language'
          value={dropdownValue}
          disabled={props.disabled}
          className={styles.dropdown}
          onOptionSelect={onSelectLanguage}
          listbox={{
            style: {
              // minInlineSize: '160px',
              color: colors.listFg,
              background: colors.bg,
              border: `1px solid ${colors.stroke}`,
            },
          }}
          // Theme the trigger button text/icon
          button={{
            style: {
              color: props.disabled
                ? v8Theme.palette.neutralTertiary
                : v8Theme.palette.neutralPrimary,
            },
          }}>
          {LANGUAGES.map((lang) => (
            <Option key={lang} text={lang} value={lang} style={{ color: colors.listFg }}>
              {lang}
            </Option>
          ))}
        </Dropdown>
      )}
    </Stack>
  );
};
