import { Stack, useTheme } from '@fluentui/react';
import {
  Button,
  Dropdown,
  makeStyles,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Option,
  ToolbarDivider,
} from '@fluentui/react-components';
import {
  AddRegular,
  CommentQuoteRegular,
  DocumentPageBreakRegular,
  HighlightAccentFilled,
  ImageAddRegular,
  ImageEditRegular,
  TableAddRegular,
  TextAlignCenterFilled,
  TextAlignJustifyFilled,
  TextAlignLeftFilled,
  TextAlignRightFilled,
  TextBold24Regular,
  TextBulletListLtrFilled,
  TextCaseLowercaseFilled,
  TextCaseTitleFilled,
  TextCaseUppercaseFilled,
  TextItalicFilled,
  TextNumberListLtrFilled,
  TextStrikethroughFilled,
  TextSubscriptFilled,
  TextSuperscriptFilled,
  TextUnderlineFilled,
  VideoClipRegular,
} from '@fluentui/react-icons';
import {
  $isListNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListNode,
  REMOVE_LIST_COMMAND,
} from '@lexical/list';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  HeadingTagType,
} from '@lexical/rich-text';
import { $setBlocksType } from '@lexical/selection';
import { $getNearestNodeOfType, mergeRegister } from '@lexical/utils';
import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  $setSelection,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  UNDO_COMMAND,
  type RangeSelection,
} from 'lexical';
import React, { useMemo, useState } from 'react';
import {
  HEADING_OPTION,
  IEditorProps,
  LOW_PRIORIRTY,
  RichTextPluginsType,
} from '../Types/EditorType';
import { getToolbarGroupsByLevel } from '../Utils/editorLevel';
import { formatParagraph } from '../Utils/Index';
import { ColorPickerPlugin } from './ColorBar';
import { FontFamilyPlugin } from './FontFamily';
import { FontSizePlugin } from './FontSize';
import { InsertImageDialog } from './ImagePlugin';
import { InsertInlineImageDialog } from './InlineImage';
import { InsertLinkPlugin } from './InsertLink';
import { INSERT_PAGE_BREAK } from './PageBreak';
import { TableItemPlugin } from './Table';
import { YoutubeUploadPlugin } from './Youtube';

const useStyles = makeStyles({
  dropdown: {
    minInlineSize: '90px',
    border: 'none',
    backgroundColor: 'transparent',
  },
  alignDropdown: {
    minInlineSize: '70px',
    border: 'none',
    backgroundColor: 'transparent',
  },
});

type ActiveInsertDialog = 'table' | 'image' | 'inlineImage' | 'youtube' | null;

/**
 * Toolbar token type = strings you already use in enabledPlugins.
 */
type ToolbarToken =
  | '|'
  | 'Bold'
  | 'Italic'
  | 'Underline'
  | 'ColorPicker'
  | 'Link'
  | 'Table'
  | 'Image'
  | 'InlineImage'
  | 'Youtube'
  | 'Insert'
  | 'Heading'
  | 'FontFamily'
  | 'FontSize'
  | 'Decorators'
  | 'CodeBlock'
  | 'Align';

const ALLOWED_TOKENS: Record<ToolbarToken, true> = {
  '|': true,
  Bold: true,
  Italic: true,
  Underline: true,
  ColorPicker: true,
  Link: true,
  Table: true,
  Image: true,
  InlineImage: true,
  Youtube: true,
  Insert: true,
  Heading: true,
  FontFamily: true,
  FontSize: true,
  Decorators: true,
  CodeBlock: true,
  Align: true,
};

/**
 * Utility: sanitize pluginGroups to avoid unknown tokens, and normalize separators.
 */
function sanitizePluginGroups(groups?: string[][]): ToolbarToken[][] {
  if (!groups || groups.length === 0) return [];
  return groups
    .map((g) =>
      (g || [])
        .map((t) => t.trim())
        .filter((t): t is ToolbarToken => (ALLOWED_TOKENS as any)[t] === true)
    )
    .filter((g) => g.length > 0);
}

export const ToolBarPlugins = (props: IEditorProps) => {
  const [editor] = useLexicalComposerContext();
  const theme = useTheme();
  const styles = useStyles();

  const [selectNodeType, setSelectNodeType] = useState('paragraph');
  const [isEditable, setIsEditable] = useState(() => editor.isEditable());

  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [isSuperscript, setIsSuperscript] = useState(false);
  const [isSubscript, setIsSubscript] = useState(false);
  const [isHighlight, setIsHighlight] = useState(false);
  const [isUppercase, setIsUppercase] = useState(false);
  const [isLowercase, setIsLowercase] = useState(false);
  const [isCapitalize, setIsCapitalize] = useState(false);
  const [alignment, setAlignment] = useState<string>('left');
  const [activeInsertDialog, setActiveInsertDialog] = useState<ActiveInsertDialog>(null);
  const lastSelectionRef = React.useRef<RangeSelection | null>(null);

  const presetGroups = getToolbarGroupsByLevel(props.level);

  const pluginGroups = useMemo(() => sanitizePluginGroups(presetGroups), [presetGroups]);

  const updateToolbarPlugins = () => {
    const selection: any = $getSelection();

    // reset when no range selection
    if (!$isRangeSelection(selection)) {
      setIsBold(false);
      setIsItalic(false);
      setIsUnderline(false);
      setIsStrikethrough(false);
      setIsSuperscript(false);
      setIsSubscript(false);
      setIsHighlight(false);
      setIsUppercase(false);
      setIsLowercase(false);
      setIsCapitalize(false);
      setSelectNodeType('paragraph');
      return;
    }

    setIsBold(selection.hasFormat('bold'));
    setIsItalic(selection.hasFormat('italic'));
    setIsUnderline(selection.hasFormat('underline'));
    setIsStrikethrough(selection.hasFormat('strikethrough'));
    setIsSuperscript(selection.hasFormat('superscript'));
    setIsSubscript(selection.hasFormat('subscript'));
    setIsHighlight(selection.hasFormat('highlight'));
    setIsUppercase(selection.hasFormat('uppercase'));
    setIsLowercase(selection.hasFormat('lowercase'));
    setIsCapitalize(selection.hasFormat('capitalize'));

    const anchorNode = selection.anchor.getNode();

    // root selection -> paragraph
    if (anchorNode.getKey() === 'root') {
      setSelectNodeType('paragraph');
      return;
    }

    // element = the cell-level block (paragraph / heading inside the cell),
    // or the top-level block when not in a table — correct for all toolbar state.
    const element = anchorNode.getTopLevelElementOrThrow();
    setAlignment(
      typeof (element as any).getFormatType === 'function'
        ? (element as any).getFormatType() || 'left'
        : 'left',
    );

    // ✅ critical: if block is empty, UI should show Normal (paragraph)
    const blockText = element.getTextContent();
    if (!blockText || blockText.trim().length === 0) {
      setSelectNodeType('paragraph');
      return;
    }

    if ($isListNode(element)) {
      const parentList = $getNearestNodeOfType(anchorNode, ListNode);
      const type = parentList ? parentList.getTag() : element.getTag();
      setSelectNodeType(type);
      return;
    }

    const type = $isHeadingNode(element) ? element.getTag() : element.getType();
    setSelectNodeType(
      ['paragraph', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'quote', 'code'].includes(type)
        ? type
        : 'paragraph',
    );

  };

  // Restores the last saved cursor/selection before applying any block-level
  // transform. Without this, clicking a toolbar dropdown loses the selection
  // and the transform applies to the wrong block (or the whole document).
  const applyToBlock = React.useCallback(
    (fn: (sel: RangeSelection) => void) => {
      editor.update(() => {
        const saved = lastSelectionRef.current;
        if (saved) $setSelection(saved.clone());
        const sel = $getSelection();
        if ($isRangeSelection(sel)) fn(sel);
      });
    },
    [editor],
  );

  const formatQuote = () => {
    applyToBlock((selection) => {
      if (selectNodeType === 'quote') {
        $setBlocksType(selection, () => $createParagraphNode());
      } else {
        $setBlocksType(selection, () => $createQuoteNode());
      }
    });
  };

  React.useEffect(() => {
    return mergeRegister(
      editor.registerEditableListener((editable) => {
        setIsEditable(editable);
      }),
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          updateToolbarPlugins();
        });
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          const sel = $getSelection();
          if ($isRangeSelection(sel)) lastSelectionRef.current = sel.clone();
          updateToolbarPlugins();
          return false;
        },
        LOW_PRIORIRTY
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  const onHandleSelectOption = (id: RichTextPluginsType) => {
    switch (id) {
      case RichTextPluginsType.Bold:
        editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold');
        break;
      case RichTextPluginsType.Italic:
        editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic');
        break;
      case RichTextPluginsType.Underline:
        editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline');
        break;
      case RichTextPluginsType.Strikethrough:
        editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough');
        break;
      case RichTextPluginsType.Superscript:
        editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'superscript');
        break;
      case RichTextPluginsType.Subscript:
        editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'subscript');
        break;
      case RichTextPluginsType.Highlight:
        editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'highlight');
        break;
      case RichTextPluginsType.LeftAlign:
        applyToBlock((sel) => { const seen = new Set<string>(); sel.getNodes().forEach(n => { const t = n.getTopLevelElementOrThrow(); if (!seen.has(t.getKey())) { seen.add(t.getKey()); (t as any).setFormat('left'); } }); });
        break;
      case RichTextPluginsType.RightAlign:
        applyToBlock((sel) => { const seen = new Set<string>(); sel.getNodes().forEach(n => { const t = n.getTopLevelElementOrThrow(); if (!seen.has(t.getKey())) { seen.add(t.getKey()); (t as any).setFormat('right'); } }); });
        break;
      case RichTextPluginsType.CenterAlign:
        applyToBlock((sel) => { const seen = new Set<string>(); sel.getNodes().forEach(n => { const t = n.getTopLevelElementOrThrow(); if (!seen.has(t.getKey())) { seen.add(t.getKey()); (t as any).setFormat('center'); } }); });
        break;
      case RichTextPluginsType.JustifyAlign:
        applyToBlock((sel) => { const seen = new Set<string>(); sel.getNodes().forEach(n => { const t = n.getTopLevelElementOrThrow(); if (!seen.has(t.getKey())) { seen.add(t.getKey()); (t as any).setFormat('justify'); } }); });
        break;
      case RichTextPluginsType.Undo:
        editor.dispatchCommand(UNDO_COMMAND, undefined);
        break;
      case RichTextPluginsType.Redo:
        editor.dispatchCommand(REDO_COMMAND, undefined);
        break;
      case RichTextPluginsType.Uppercase:
        editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'uppercase');
        break;
      case RichTextPluginsType.Lowercase:
        editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'lowercase');
        break;
      case RichTextPluginsType.Capitalize:
        editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'capitalize');
        break;
    }
  };

  const updateHeading = (heading: HeadingTagType) => {
    applyToBlock((selection) => {
      $setBlocksType(selection, () => $createHeadingNode(heading));
    });
  };

  /**
   * Token renderer registry
   * Each token returns a React element (button/plugin/divider).
   * If token should render nothing (e.g. unknown), return null.
   */
  const renderToken = (token: ToolbarToken, groupIndex: number, tokenIndex: number) => {
    const key = `${groupIndex}-${tokenIndex}-${token}`;

    // ---------- Fluent UI v8 theme.palette mapping ----------
    const palette = theme.palette;

    const fg = palette.neutralPrimary; // main icon/text
    const fgSubtle = palette.neutralSecondary; // subtle icons (chevrons)
    const fgDisabled = palette.neutralTertiary; // disabled

    const brand = palette.themePrimary; // active/toggled icon
    const brandHover = palette.themeDarkAlt ?? brand;
    const brandPressed = palette.themeDark ?? brand;

    const bgToolbar = palette.white; // toolbar background (you use white)
    const bgHover = palette.neutralLighter; // hover background
    const bgPressed = palette.neutralLight; // pressed background

    const bgActive = palette.neutralLighterAlt ?? palette.neutralLighter; // selected/toggled background
    const bgActiveHover = palette.neutralLighter ?? bgHover;
    const bgActivePressed = palette.neutralLight ?? bgPressed;

    const stroke = palette.neutralLight; // borders/divider

    // ---------- Shared button styling ----------
    const getIconColor = (active?: boolean) => {
      if (!isEditable) return fgDisabled;
      return active ? brand : fg;
    };

    const getButtonStyle = (active?: boolean): React.CSSProperties => {
      const baseBg = active ? bgActive : 'transparent';
      const hoverBg = active ? bgActiveHover : bgHover;
      const pressedBg = active ? bgActivePressed : bgPressed;

      return {
        border: '1px solid transparent',
        margin: 2,
        minWidth: 28,
        paddingInline: 6,
        background: baseBg,
        borderRadius: 4,

        // These CSS vars are used by Fluent v9 buttons in many builds.
        // If your version ignores them, the base `background` + icon styles still apply.
        ['--fui-Button__backgroundColor' as any]: baseBg,
        ['--fui-Button__backgroundColorHover' as any]: hoverBg,
        ['--fui-Button__backgroundColorPressed' as any]: pressedBg,
        ['--fui-Button__borderColorHover' as any]: stroke,
        ['--fui-Button__borderColorPressed' as any]: stroke,

        ['--fui-Button__iconColor' as any]: getIconColor(active),
        ['--fui-Button__iconColorHover' as any]: active ? brandHover : fg,
        ['--fui-Button__iconColorPressed' as any]: active ? brandPressed : fg,
      };
    };

    const dropdownButtonStyle: React.CSSProperties = {
      color: !isEditable || props.readOnly ? fgDisabled : fg,
      background: 'transparent',
    };

    const dropdownExpandIconStyle: React.CSSProperties = {
      color: isEditable ? fgSubtle : fgDisabled,
    };

    const optionIconStyle: React.CSSProperties = {
      fontSize: '20px',
      color: isEditable ? fg : fgDisabled,
      marginRight: 8,
      verticalAlign: 'middle',
    };

    const isDisabled = !isEditable || !!props.readOnly;

    switch (token) {
      case 'Bold':
        return (
          <Button
            key={key}
            size='small'
            disabled={!isEditable || props.readOnly!}
            icon={<TextBold24Regular style={{ color: getIconColor(isBold) }} />}
            style={getButtonStyle(isBold)}
            onClick={() => onHandleSelectOption(RichTextPluginsType.Bold)}
          />
        );

      case 'Italic':
        return (
          <Button
            key={key}
            size='small'
            disabled={!isEditable || props.readOnly!}
            icon={<TextItalicFilled style={{ color: getIconColor(isItalic) }} />}
            style={getButtonStyle(isItalic)}
            onClick={() => onHandleSelectOption(RichTextPluginsType.Italic)}
          />
        );

      case 'Underline':
        return (
          <Button
            key={key}
            size='small'
            disabled={!isEditable || props.readOnly!}
            icon={<TextUnderlineFilled style={{ color: getIconColor(isUnderline) }} />}
            style={getButtonStyle(isUnderline)}
            onClick={() => onHandleSelectOption(RichTextPluginsType.Underline)}
          />
        );

      case 'ColorPicker':
        return <ColorPickerPlugin key={key} disabled={!isEditable || props.readOnly!} />;

      case 'Link':
        return <InsertLinkPlugin key={key} disabled={!isEditable || props.readOnly!} />;

      case 'Table':
        return <TableItemPlugin key={key} disabled={!isEditable || props.readOnly!} />;

      case 'Image':
        return (
          <InsertImageDialog
            key={key}
            activeEditor={editor}
            disabled={!isEditable || props.readOnly!}
          />
        );

      case 'InlineImage':
        return (
          <InsertInlineImageDialog
            key={key}
            activeEditor={editor}
            disabled={!isEditable || props.readOnly!}
          />
        );

      case 'Youtube':
        return <YoutubeUploadPlugin key={key} disabled={!isEditable || props.readOnly!} />;

      case 'Insert': {
        const menuIconColor = isDisabled ? fgDisabled : fg;
        return (
          <React.Fragment key={key}>
            <Menu>
              <MenuTrigger disableButtonEnhancement>
                <Button
                  size='small'
                  disabled={isDisabled}
                  icon={<AddRegular style={{ color: menuIconColor }} />}
                  style={{
                    ...getButtonStyle(false),
                    gap: 4,
                    paddingInline: 8,
                  }}>
                  Insert
                </Button>
              </MenuTrigger>
              <MenuPopover>
                <MenuList>
                  <MenuItem
                    icon={<TableAddRegular style={{ color: menuIconColor }} />}
                    onClick={() => !isDisabled && setActiveInsertDialog('table')}>
                    Table
                  </MenuItem>
                  <MenuItem
                    icon={<ImageAddRegular style={{ color: menuIconColor }} />}
                    onClick={() => !isDisabled && setActiveInsertDialog('image')}>
                    Image
                  </MenuItem>
                  <MenuItem
                    icon={<ImageEditRegular style={{ color: menuIconColor }} />}
                    onClick={() => !isDisabled && setActiveInsertDialog('inlineImage')}>
                    Inline Image
                  </MenuItem>
                  <MenuItem
                    icon={<VideoClipRegular style={{ color: menuIconColor }} />}
                    onClick={() => !isDisabled && setActiveInsertDialog('youtube')}>
                    YouTube
                  </MenuItem>
                </MenuList>
              </MenuPopover>
            </Menu>

            <TableItemPlugin
              disabled={isDisabled}
              open={activeInsertDialog === 'table'}
              onClose={() => setActiveInsertDialog(null)}
            />
            <InsertImageDialog
              activeEditor={editor}
              disabled={isDisabled}
              open={activeInsertDialog === 'image'}
              onClose={() => setActiveInsertDialog(null)}
            />
            <InsertInlineImageDialog
              activeEditor={editor}
              disabled={isDisabled}
              open={activeInsertDialog === 'inlineImage'}
              onClose={() => setActiveInsertDialog(null)}
            />
            <YoutubeUploadPlugin
              disabled={isDisabled}
              open={activeInsertDialog === 'youtube'}
              onClose={() => setActiveInsertDialog(null)}
            />
          </React.Fragment>
        );
      }

      case 'Heading': {
        const headingLabel =
          selectNodeType === 'paragraph'
            ? 'Normal'
            : (HEADING_OPTION.find((h) => h.key === selectNodeType)?.text ?? selectNodeType);

        return (
          <Dropdown
            key={key}
            title='Add heading'
            id={`heading-option-${groupIndex}`}
            placeholder='Format'
            disabled={!isEditable}
            style={{ minWidth: '100px' }}
            className={styles.dropdown}
            value={headingLabel}
            selectedOptions={[selectNodeType]}
            onOptionSelect={(_, data) => {
              const val = data.optionValue as HeadingTagType | 'paragraph' | undefined;
              if (!val) return;

              if (val === 'paragraph') {
                applyToBlock((sel) => $setBlocksType(sel, () => $createParagraphNode()));
                setSelectNodeType('paragraph');
              } else {
                updateHeading(val);
                setSelectNodeType(val);
              }
            }}>
            <Option value='paragraph'>Normal</Option>

            {HEADING_OPTION.map((option, idx) => (
              <Option key={`${option.key}-${idx}`} value={option.key as HeadingTagType}>
                {option.text}
              </Option>
            ))}
          </Dropdown>
        );
      }

      case 'FontFamily':
        return <FontFamilyPlugin key={key} disabled={!isEditable || props.readOnly} />;

      case 'FontSize':
        return <FontSizePlugin key={key} disabled={!isEditable || props.readOnly!} />;

      case '|':
        return <ToolbarDivider key={key} />;

      case 'Decorators': {
        const activeDecorators: string[] = [
          ...(isUppercase ? ['uppercase'] : []),
          ...(isLowercase ? ['lowercase'] : []),
          ...(isCapitalize ? ['capitalize'] : []),
          ...(isStrikethrough ? ['strike'] : []),
          ...(isSubscript ? ['subscript'] : []),
          ...(isSuperscript ? ['superscript'] : []),
          ...(isHighlight ? ['highlight'] : []),
          ...(selectNodeType === 'ul' ? ['ul-list'] : []),
          ...(selectNodeType === 'ol' ? ['ol-list'] : []),
          ...(selectNodeType === 'quote' ? ['quote'] : []),
        ];

        const DECORATOR_LABEL: Record<string, string> = {
          uppercase: 'Uppercase', lowercase: 'Lowercase', capitalize: 'Capitalize',
          strike: 'Strikethrough', subscript: 'Subscript', superscript: 'Superscript',
          highlight: 'Highlight', 'ul-list': 'Bullet list', 'ol-list': 'Number list',
          quote: 'Quote',
        };

        const decoratorValue =
          activeDecorators.length === 0 ? '' :
          activeDecorators.length === 1 ? DECORATOR_LABEL[activeDecorators[0]] :
          `${DECORATOR_LABEL[activeDecorators[0]]} +${activeDecorators.length - 1}`;

        return (
          <Dropdown
            key={key}
            multiselect
            id={`${groupIndex}-set-decorators`}
            placeholder='Text'
            value={decoratorValue}
            selectedOptions={activeDecorators}
            disabled={!isEditable}
            className={styles.alignDropdown}
            button={{ style: dropdownButtonStyle }}
            expandIcon={{ style: dropdownExpandIconStyle }}
            listbox={{ style: { minInlineSize: '180px' } }}
            onOptionSelect={(_, data) => {
              switch (data.optionValue as string) {
                case 'uppercase':  editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'uppercase'); break;
                case 'lowercase':  onHandleSelectOption(RichTextPluginsType.Lowercase); break;
                case 'capitalize': onHandleSelectOption(RichTextPluginsType.Capitalize); break;
                case 'strike':     onHandleSelectOption(RichTextPluginsType.Strikethrough); break;
                case 'subscript':  onHandleSelectOption(RichTextPluginsType.Subscript); break;
                case 'superscript': onHandleSelectOption(RichTextPluginsType.Superscript); break;
                case 'highlight':  onHandleSelectOption(RichTextPluginsType.Highlight); break;
                case 'ul-list':
                  editor.dispatchCommand(selectNodeType === 'ul' ? REMOVE_LIST_COMMAND : INSERT_UNORDERED_LIST_COMMAND, undefined);
                  break;
                case 'ol-list':
                  editor.dispatchCommand(selectNodeType === 'ol' ? REMOVE_LIST_COMMAND : INSERT_ORDERED_LIST_COMMAND, undefined);
                  break;
                case 'page-break': editor.dispatchCommand(INSERT_PAGE_BREAK, undefined); break;
                case 'quote':      formatQuote(); break;
              }
            }}>
            <Option value='uppercase' text='Uppercase'>
              <TextCaseUppercaseFilled style={optionIconStyle} />Uppercase
            </Option>
            <Option value='lowercase' text='Lowercase'>
              <TextCaseLowercaseFilled style={optionIconStyle} />Lowercase
            </Option>
            <Option value='capitalize' text='Capitalize'>
              <TextCaseTitleFilled style={optionIconStyle} />Capitalize
            </Option>
            <Option value='strike' text='Strikethrough'>
              <TextStrikethroughFilled style={optionIconStyle} />Strikethrough
            </Option>
            <Option value='subscript' text='Subscript'>
              <TextSubscriptFilled style={optionIconStyle} />Subscript
            </Option>
            <Option value='superscript' text='Superscript'>
              <TextSuperscriptFilled style={optionIconStyle} />Superscript
            </Option>
            <Option value='highlight' text='Highlight'>
              <HighlightAccentFilled style={{ ...optionIconStyle, color: isEditable ? brand : fgDisabled }} />Highlight
            </Option>
            <Option value='ul-list' text='Bullet list'>
              <TextBulletListLtrFilled style={optionIconStyle} />Bullet list
            </Option>
            <Option value='ol-list' text='Number list'>
              <TextNumberListLtrFilled style={optionIconStyle} />Number list
            </Option>
            <Option value='page-break' text='Page Break'>
              <DocumentPageBreakRegular style={optionIconStyle} />Page break
            </Option>
            <Option value='quote' text='Quote'>
              <CommentQuoteRegular style={optionIconStyle} />Quote
            </Option>
          </Dropdown>
        );
      }

      // case 'CodeBlock':
      //   return (
      //     <CodeBlockPlugin
      //       key={key}
      //       codeLanguage={codeLanguage}
      //       selectNodeType={selectNodeType}
      //       selectedElementKey={selectedNodeKey}
      //       disabled={!isEditable}
      //     />
      //   );

      case 'Align': {
        const ALIGN_OPTIONS = [
          { value: 'left',    label: 'Left Align',    icon: <TextAlignLeftFilled style={optionIconStyle} />,    action: RichTextPluginsType.LeftAlign },
          { value: 'center',  label: 'Center Align',  icon: <TextAlignCenterFilled style={optionIconStyle} />,  action: RichTextPluginsType.CenterAlign },
          { value: 'right',   label: 'Right Align',   icon: <TextAlignRightFilled style={optionIconStyle} />,   action: RichTextPluginsType.RightAlign },
          { value: 'justify', label: 'Justify Align', icon: <TextAlignJustifyFilled style={optionIconStyle} />, action: RichTextPluginsType.JustifyAlign },
        ];
        const alignLabel = ALIGN_OPTIONS.find((o) => o.value === alignment)?.label ?? 'Left Align';

        return (
          <Dropdown
            key={key}
            id='set-alignment'
            disabled={!isEditable}
            placeholder='Left Align'
            value={alignLabel}
            selectedOptions={[alignment]}
            className={styles.alignDropdown}
            button={{ style: dropdownButtonStyle }}
            expandIcon={{ style: dropdownExpandIconStyle }}
            listbox={{ style: { minInlineSize: '170px' } }}
            onOptionSelect={(_, data) => {
              const opt = ALIGN_OPTIONS.find((o) => o.value === data.optionValue);
              if (opt) onHandleSelectOption(opt.action);
            }}>
            {ALIGN_OPTIONS.map((opt) => (
              <Option key={opt.value} value={opt.value} text={opt.label}>
                {opt.icon}
                {opt.label}
              </Option>
            ))}
          </Dropdown>
        );
      }

      default:
        return null;
    }
  };

  if (!pluginGroups || pluginGroups.length === 0) {
    return null;
  }

  return (
    <Stack>
      <div
        role='toolbar'
        aria-label='Editor toolbar'
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          borderBottom: '1px solid #ccced1',
          background: '#ffffff',
          padding: '0px',
          minHeight: 36,
        }}>
        {pluginGroups.map((group, groupIndex) => (
          <React.Fragment key={`group-${groupIndex}`}>
            {group.map((token, tokenIndex) => {
              try {
                return renderToken(token, groupIndex, tokenIndex);
              } catch {
                return null;
              }
            })}
          </React.Fragment>
        ))}
      </div>

    </Stack>
  );
};
