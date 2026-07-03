import { Stack, useTheme } from '@fluentui/react';
import { Button, Dropdown, makeStyles, Option, ToolbarDivider } from '@fluentui/react-components';
import {
  CommentQuoteRegular,
  DocumentPageBreakRegular,
  HighlightAccentFilled,
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
  $getSelection,
  $isRangeSelection,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  UNDO_COMMAND,
} from 'lexical';
import React, { useMemo, useState } from 'react';
import {
  HEADING_OPTION,
  IEditorProps,
  LOW_PRIORIRTY,
  RichTextPluginsType,
} from '../Types/EditorType';
import { $isAlphaListNode, $toggleAlphaList } from '../Nodes/AlphaListNode';
import { getToolbarGroupsByLevel } from '../Utils/editorLevel';
import { $splitBlockAtPartialSelection, $splitBlocksAtLineBreaks, formatParagraph } from '../Utils/Index';
import { ColorPickerPlugin } from './ColorBar';
import { FontFamilyPlugin } from './FontFamily';
import { FontSizePlugin } from './FontSize';
import { InsertImageDialog } from './ImagePlugin';
import { InsertInlineImageDialog } from './InlineImage';
import { InsertLinkPlugin } from './InsertLink';
import { INSERT_PAGE_BREAK } from './PageBreak';
import { PageSetupPlugin } from './PageSetup';
import { TableItemPlugin } from './Table';
import { YoutubeUploadPlugin } from './Youtube';

const TextAlphaListLtrFilled: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
  <svg width="1em" height="1em" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" style={style}>
    <path d="M8.75 4a.75.75 0 1 0 0 1.5h7.5a.75.75 0 0 0 0-1.5h-7.5Z" />
    <path d="M8.75 9a.75.75 0 1 0 0 1.5h7.5a.75.75 0 0 0 0-1.5h-7.5Z" />
    <path d="M8 14.75c0-.41.34-.75.75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1-.75-.75Z" />
    <text x="3.5" y="6" fontSize="5.5" fontWeight="bold" textAnchor="middle">a</text>
    <text x="3.5" y="11" fontSize="5.5" fontWeight="bold" textAnchor="middle">b</text>
    <text x="3.5" y="16" fontSize="5.5" fontWeight="bold" textAnchor="middle">c</text>
  </svg>
);

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

/**
 * Toolbar token type = strings you already use in enabledPlugins.
 */
type ToolbarToken =
  | '|'
  // ── Text formatting (standalone toggle buttons) ──────────────────────────
  | 'Bold'
  | 'Italic'
  | 'Underline'
  | 'Strikethrough'
  | 'Subscript'
  | 'Superscript'
  | 'Highlight'
  | 'Uppercase'
  | 'Lowercase'
  | 'Capitalize'
  // ── Lists (standalone toggle buttons) ────────────────────────────────────
  | 'BulletList'
  | 'NumberList'
  | 'AlphabeticalList'
  // ── Block-level (standalone buttons) ─────────────────────────────────────
  | 'Quote'
  | 'PageBreak'
  // ── Heading levels (standalone toggle buttons) ────────────────────────────
  | 'H1'
  | 'H2'
  | 'H3'
  | 'H4'
  | 'H5'
  | 'H6'
  // ── Rich media / plugins ──────────────────────────────────────────────────
  | 'ColorPicker'
  | 'Link'
  | 'Table'
  | 'Image'
  | 'InlineImage'
  | 'Youtube'
  | 'FontFamily'
  | 'FontSize'
  | 'Align'
  | 'PageSetup'
  // ── Aggregate dropdowns (show ALL options of that category) ───────────────
  | 'Heading'    // dropdown: Normal + H1–H6
  | 'Decorators' // dropdown: all text / list / block decorators
  | 'CodeBlock';

const ALLOWED_TOKENS: Record<ToolbarToken, true> = {
  '|': true,
  Bold: true,
  Italic: true,
  Underline: true,
  Strikethrough: true,
  Subscript: true,
  Superscript: true,
  Highlight: true,
  Uppercase: true,
  Lowercase: true,
  Capitalize: true,
  BulletList: true,
  NumberList: true,
  AlphabeticalList: true,
  Quote: true,
  PageBreak: true,
  H1: true,
  H2: true,
  H3: true,
  H4: true,
  H5: true,
  H6: true,
  ColorPicker: true,
  Link: true,
  Table: true,
  Image: true,
  InlineImage: true,
  Youtube: true,
  FontFamily: true,
  FontSize: true,
  Align: true,
  Heading: true,
  Decorators: true,
  CodeBlock: true,
  PageSetup: true,
};

/**
 * Utility: sanitize pluginGroups to avoid unknown tokens, and normalize separators.
 */
function sanitizePluginGroups(groups?: string[][]): ToolbarToken[][] {
  // Guard against non-array values (e.g. {} passed by Storybook's "Set object" control).
  if (!Array.isArray(groups) || groups.length === 0) return [];
  return groups
    .map((g) =>
      (Array.isArray(g) ? g : [])
        .map((t) => (typeof t === 'string' ? t.trim() : ''))
        .filter((t): t is ToolbarToken => (ALLOWED_TOKENS as any)[t] === true),
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

  // Controlled open state for the decorator dropdown so it stays open
  // after an option is selected (only closes on click-outside / Escape).
  const [decoratorOpen, setDecoratorOpen] = useState(false);
  const decoratorSelectingRef = React.useRef(false);

  const presetGroups = props.customToolbar ?? getToolbarGroupsByLevel(props.level);

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

    // Alpha list must be checked before the generic $isListNode branch because
    // AlphaListNode extends ListNode — $isListNode would match it too.
    if ($isAlphaListNode(element)) {
      setSelectNodeType('alpha');
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

  const formatQuote = () => {
    editor.update(() => {
      const selection = $getSelection();

      if (!$isRangeSelection(selection)) return;

      if (selectNodeType === 'quote') {
        // toggle back to paragraph
        formatParagraph(editor);
      } else {
        // Split multi-line blocks first so only the selected line(s) become a quote.
        $splitBlocksAtLineBreaks(selection);
        $setBlocksType($getSelection(), () => $createQuoteNode());
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
          updateToolbarPlugins();
          return false;
        },
        LOW_PRIORIRTY,
      ),
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
        applyAlignmentWithSplit('left');
        break;
      case RichTextPluginsType.RightAlign:
        applyAlignmentWithSplit('right');
        break;
      case RichTextPluginsType.CenterAlign:
        applyAlignmentWithSplit('center');
        break;
      case RichTextPluginsType.JustifyAlign:
        applyAlignmentWithSplit('justify');
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

  /**
   * Apply an alignment format to only the selected block(s).
   *
   * Problem: FORMAT_ELEMENT_COMMAND applies to every top-level element that
   * is touched by the selection — so if the user has several Shift+Enter
   * "lines" in one block, or selects a single word in the middle of a
   * paragraph, alignment spreads to the entire block.
   *
   * Fix (same two-step strategy as updateHeading):
   *   1. Split multi-line blocks at LineBreakNode boundaries so each visual
   *      line is its own block.
   *   2. Split the block at the selection edges when only part of a line is
   *      selected, isolating the selected words into their own block.
   *
   * After the splits the selection sits on the isolated block(s).  We then
   * dispatch FORMAT_ELEMENT_COMMAND which applies alignment only to whatever
   * blocks the current selection covers — i.e. just the isolated block.
   *
   * For non-range selections (e.g. a YouTube node selected as a node
   * selection), the update() returns early and the command still fires,
   * so YouTube / image alignment continues to work unchanged.
   */
  const applyAlignmentWithSplit = (formatType: 'left' | 'center' | 'right' | 'justify') => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;

      // Step 1 – split Shift+Enter multi-line blocks.
      $splitBlocksAtLineBreaks(selection);

      // Step 2 – split at partial-selection boundaries (word / phrase selection).
      const sel = $getSelection();
      if ($isRangeSelection(sel)) {
        $splitBlockAtPartialSelection(sel);
      }
    });

    // Dispatch AFTER the split update so the command sees the repositioned
    // selection and aligns only the isolated block(s).
    editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, formatType);
  };

  const updateHeading = (heading: HeadingTagType) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        // Step 1 – split multi-line blocks (Shift+Enter) so only the selected
        //           line(s) are affected.
        $splitBlocksAtLineBreaks(selection);

        // Step 2 – if the selection covers only part of a single block (e.g.
        //           one word in the middle of a paragraph), split the block at
        //           the selection edges so the heading applies only to the
        //           selected words, leaving the surrounding text as paragraphs.
        const sel = $getSelection();
        if ($isRangeSelection(sel)) {
          $splitBlockAtPartialSelection(sel);
        }

        $setBlocksType($getSelection(), () => $createHeadingNode(heading));
      }
    });

    editor.getEditorState().read(() => {
      updateToolbarPlugins();
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

    switch (token) {
      case 'Bold':
        return (
          <Button
            key={key}
            size='small'
            aria-label='Bold'
            aria-pressed={isBold}
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
            aria-label='Italic'
            aria-pressed={isItalic}
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
            aria-label='Underline'
            aria-pressed={isUnderline}
            disabled={!isEditable || props.readOnly!}
            icon={<TextUnderlineFilled style={{ color: getIconColor(isUnderline) }} />}
            style={getButtonStyle(isUnderline)}
            onClick={() => onHandleSelectOption(RichTextPluginsType.Underline)}
          />
        );

      case 'ColorPicker':
        return <ColorPickerPlugin key={key} disabled={!isEditable || props.readOnly!} />;

      case 'Link':
        return (
          <InsertLinkPlugin
            key={key}
            disabled={!isEditable || props.readOnly!}
            setIsLinkEditMode={props.setIsLinkEditMode}
          />
        );

      case 'Table':
        return <TableItemPlugin key={key} disabled={!isEditable || props.readOnly!} />;

      case 'Image':
        return (
          <InsertImageDialog
            key={key}
            activeEditor={editor}
            disabled={!isEditable || props.readOnly!}
            maxImageSizeMB={props.maxImageSizeMB}
            validationMessages={props.validationMessages}
          />
        );

      case 'InlineImage':
        return (
          <InsertInlineImageDialog
            key={key}
            activeEditor={editor}
            disabled={!isEditable || props.readOnly!}
            maxImageSizeMB={props.maxImageSizeMB}
            validationMessages={props.validationMessages}
          />
        );

      case 'Youtube':
        return <YoutubeUploadPlugin key={key} disabled={!isEditable || props.readOnly!} />;

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
                formatParagraph(editor);
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

      // ── Standalone text-format toggle buttons ─────────────────────────────
      // These were previously only accessible inside the 'Decorators' dropdown.
      // Use them directly in customToolbar to show individual buttons instead.

      case 'Strikethrough':
        return (
          <Button
            key={key}
            size='small'
            aria-label='Strikethrough'
            aria-pressed={isStrikethrough}
            disabled={!isEditable || props.readOnly!}
            icon={<TextStrikethroughFilled style={{ color: getIconColor(isStrikethrough) }} />}
            style={getButtonStyle(isStrikethrough)}
            onClick={() => onHandleSelectOption(RichTextPluginsType.Strikethrough)}
          />
        );

      case 'Subscript':
        return (
          <Button
            key={key}
            size='small'
            aria-label='Subscript'
            aria-pressed={isSubscript}
            disabled={!isEditable || props.readOnly!}
            icon={<TextSubscriptFilled style={{ color: getIconColor(isSubscript) }} />}
            style={getButtonStyle(isSubscript)}
            onClick={() => onHandleSelectOption(RichTextPluginsType.Subscript)}
          />
        );

      case 'Superscript':
        return (
          <Button
            key={key}
            size='small'
            aria-label='Superscript'
            aria-pressed={isSuperscript}
            disabled={!isEditable || props.readOnly!}
            icon={<TextSuperscriptFilled style={{ color: getIconColor(isSuperscript) }} />}
            style={getButtonStyle(isSuperscript)}
            onClick={() => onHandleSelectOption(RichTextPluginsType.Superscript)}
          />
        );

      case 'Highlight':
        return (
          <Button
            key={key}
            size='small'
            aria-label='Highlight'
            aria-pressed={isHighlight}
            disabled={!isEditable || props.readOnly!}
            icon={
              <HighlightAccentFilled
                style={{ color: isEditable ? (isHighlight ? brand : fg) : fgDisabled }}
              />
            }
            style={getButtonStyle(isHighlight)}
            onClick={() => onHandleSelectOption(RichTextPluginsType.Highlight)}
          />
        );

      case 'Uppercase':
        return (
          <Button
            key={key}
            size='small'
            aria-label='Uppercase'
            aria-pressed={isUppercase}
            disabled={!isEditable || props.readOnly!}
            icon={<TextCaseUppercaseFilled style={{ color: getIconColor(isUppercase) }} />}
            style={getButtonStyle(isUppercase)}
            onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'uppercase')}
          />
        );

      case 'Lowercase':
        return (
          <Button
            key={key}
            size='small'
            aria-label='Lowercase'
            aria-pressed={isLowercase}
            disabled={!isEditable || props.readOnly!}
            icon={<TextCaseLowercaseFilled style={{ color: getIconColor(isLowercase) }} />}
            style={getButtonStyle(isLowercase)}
            onClick={() => onHandleSelectOption(RichTextPluginsType.Lowercase)}
          />
        );

      case 'Capitalize':
        return (
          <Button
            key={key}
            size='small'
            aria-label='Capitalize'
            aria-pressed={isCapitalize}
            disabled={!isEditable || props.readOnly!}
            icon={<TextCaseTitleFilled style={{ color: getIconColor(isCapitalize) }} />}
            style={getButtonStyle(isCapitalize)}
            onClick={() => onHandleSelectOption(RichTextPluginsType.Capitalize)}
          />
        );

      // ── Standalone list toggle buttons ────────────────────────────────────

      case 'BulletList':
        return (
          <Button
            key={key}
            size='small'
            aria-label='Bullet list'
            aria-pressed={selectNodeType === 'ul'}
            disabled={!isEditable || props.readOnly!}
            icon={
              <TextBulletListLtrFilled style={{ color: getIconColor(selectNodeType === 'ul') }} />
            }
            style={getButtonStyle(selectNodeType === 'ul')}
            onClick={() =>
              editor.dispatchCommand(
                selectNodeType === 'ul' ? REMOVE_LIST_COMMAND : INSERT_UNORDERED_LIST_COMMAND,
                undefined,
              )
            }
          />
        );

      case 'NumberList':
        return (
          <Button
            key={key}
            size='small'
            aria-label='Number list'
            aria-pressed={selectNodeType === 'ol'}
            disabled={!isEditable || props.readOnly!}
            icon={
              <TextNumberListLtrFilled style={{ color: getIconColor(selectNodeType === 'ol') }} />
            }
            style={getButtonStyle(selectNodeType === 'ol')}
            onClick={() =>
              editor.dispatchCommand(
                selectNodeType === 'ol' ? REMOVE_LIST_COMMAND : INSERT_ORDERED_LIST_COMMAND,
                undefined,
              )
            }
          />
        );

      case 'AlphabeticalList':
        return (
          <Button
            key={key}
            size='small'
            aria-label='Alphabetical list'
            aria-pressed={selectNodeType === 'alpha'}
            disabled={!isEditable || props.readOnly!}
            icon={
              <TextAlphaListLtrFilled
                style={{ color: getIconColor(selectNodeType === 'alpha') }}
              />
            }
            style={getButtonStyle(selectNodeType === 'alpha')}
            onClick={() => editor.update(() => $toggleAlphaList())}
          />
        );

      // ── Standalone block buttons ──────────────────────────────────────────

      case 'Quote':
        return (
          <Button
            key={key}
            size='small'
            aria-label='Quote'
            aria-pressed={selectNodeType === 'quote'}
            disabled={!isEditable || props.readOnly!}
            icon={<CommentQuoteRegular style={{ color: getIconColor(selectNodeType === 'quote') }} />}
            style={getButtonStyle(selectNodeType === 'quote')}
            onClick={() => formatQuote()}
          />
        );

      case 'PageBreak':
        return (
          <Button
            key={key}
            size='small'
            aria-label='Page break'
            disabled={!isEditable || props.readOnly!}
            icon={<DocumentPageBreakRegular style={{ color: getIconColor() }} />}
            style={getButtonStyle()}
            onClick={() => editor.dispatchCommand(INSERT_PAGE_BREAK, undefined)}
          />
        );

      // ── Standalone heading-level toggle buttons ───────────────────────────
      // Each button sets (or toggles off) that specific heading level.
      // Clicking an active heading reverts to normal paragraph.

      case 'H1':
        return (
          <Button
            key={key}
            size='small'
            aria-label='Heading 1'
            aria-pressed={selectNodeType === 'h1'}
            disabled={!isEditable || props.readOnly!}
            style={{
              ...getButtonStyle(selectNodeType === 'h1'),
              color: getIconColor(selectNodeType === 'h1'),
              fontSize: 12,
              fontWeight: 600,
            }}
            onClick={() => {
              if (selectNodeType === 'h1') {
                formatParagraph(editor);
                setSelectNodeType('paragraph');
              } else {
                updateHeading('h1');
                setSelectNodeType('h1');
              }
            }}>
            H1
          </Button>
        );

      case 'H2':
        return (
          <Button
            key={key}
            size='small'
            aria-label='Heading 2'
            aria-pressed={selectNodeType === 'h2'}
            disabled={!isEditable || props.readOnly!}
            style={{
              ...getButtonStyle(selectNodeType === 'h2'),
              color: getIconColor(selectNodeType === 'h2'),
              fontSize: 12,
              fontWeight: 600,
            }}
            onClick={() => {
              if (selectNodeType === 'h2') {
                formatParagraph(editor);
                setSelectNodeType('paragraph');
              } else {
                updateHeading('h2');
                setSelectNodeType('h2');
              }
            }}>
            H2
          </Button>
        );

      case 'H3':
        return (
          <Button
            key={key}
            size='small'
            aria-label='Heading 3'
            aria-pressed={selectNodeType === 'h3'}
            disabled={!isEditable || props.readOnly!}
            style={{
              ...getButtonStyle(selectNodeType === 'h3'),
              color: getIconColor(selectNodeType === 'h3'),
              fontSize: 12,
              fontWeight: 600,
            }}
            onClick={() => {
              if (selectNodeType === 'h3') {
                formatParagraph(editor);
                setSelectNodeType('paragraph');
              } else {
                updateHeading('h3');
                setSelectNodeType('h3');
              }
            }}>
            H3
          </Button>
        );

      case 'H4':
        return (
          <Button
            key={key}
            size='small'
            aria-label='Heading 4'
            aria-pressed={selectNodeType === 'h4'}
            disabled={!isEditable || props.readOnly!}
            style={{
              ...getButtonStyle(selectNodeType === 'h4'),
              color: getIconColor(selectNodeType === 'h4'),
              fontSize: 12,
              fontWeight: 600,
            }}
            onClick={() => {
              if (selectNodeType === 'h4') {
                formatParagraph(editor);
                setSelectNodeType('paragraph');
              } else {
                updateHeading('h4');
                setSelectNodeType('h4');
              }
            }}>
            H4
          </Button>
        );

      case 'H5':
        return (
          <Button
            key={key}
            size='small'
            aria-label='Heading 5'
            aria-pressed={selectNodeType === 'h5'}
            disabled={!isEditable || props.readOnly!}
            style={{
              ...getButtonStyle(selectNodeType === 'h5'),
              color: getIconColor(selectNodeType === 'h5'),
              fontSize: 12,
              fontWeight: 600,
            }}
            onClick={() => {
              if (selectNodeType === 'h5') {
                formatParagraph(editor);
                setSelectNodeType('paragraph');
              } else {
                updateHeading('h5');
                setSelectNodeType('h5');
              }
            }}>
            H5
          </Button>
        );

      case 'H6':
        return (
          <Button
            key={key}
            size='small'
            aria-label='Heading 6'
            aria-pressed={selectNodeType === 'h6'}
            disabled={!isEditable || props.readOnly!}
            style={{
              ...getButtonStyle(selectNodeType === 'h6'),
              color: getIconColor(selectNodeType === 'h6'),
              fontSize: 12,
              fontWeight: 600,
            }}
            onClick={() => {
              if (selectNodeType === 'h6') {
                formatParagraph(editor);
                setSelectNodeType('paragraph');
              } else {
                updateHeading('h6');
                setSelectNodeType('h6');
              }
            }}>
            H6
          </Button>
        );

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
          ...(selectNodeType === 'alpha' ? ['al-list'] : []),
          ...(selectNodeType === 'quote' ? ['quote'] : []),
        ];

        const DECORATOR_LABEL: Record<string, string> = {
          uppercase: 'Uppercase',
          lowercase: 'Lowercase',
          capitalize: 'Capitalize',
          strike: 'Strikethrough',
          subscript: 'Subscript',
          superscript: 'Superscript',
          highlight: 'Highlight',
          'ul-list': 'Bullet list',
          'ol-list': 'Number list',
          'al-list': 'Alphabetical list',
          quote: 'Quote',
        };

        const decoratorValue =
          activeDecorators.length === 0
            ? ''
            : activeDecorators.length === 1
              ? DECORATOR_LABEL[activeDecorators[0]]
              : `${DECORATOR_LABEL[activeDecorators[0]]} +${activeDecorators.length - 1}`;

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
            open={decoratorOpen}
            onOpenChange={(_, data) => {
              // Suppress the close that Fluent UI fires right after an option is
              // selected — we only want to close on click-outside or Escape.
              if (decoratorSelectingRef.current) {
                decoratorSelectingRef.current = false;
                return;
              }
              setDecoratorOpen(data.open);
            }}
            onOptionSelect={(_, data) => {
              decoratorSelectingRef.current = true;
              switch (data.optionValue as string) {
                case 'uppercase':
                  editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'uppercase');
                  break;
                case 'lowercase':
                  onHandleSelectOption(RichTextPluginsType.Lowercase);
                  break;
                case 'capitalize':
                  onHandleSelectOption(RichTextPluginsType.Capitalize);
                  break;
                case 'strike':
                  onHandleSelectOption(RichTextPluginsType.Strikethrough);
                  break;
                case 'subscript':
                  onHandleSelectOption(RichTextPluginsType.Subscript);
                  break;
                case 'superscript':
                  onHandleSelectOption(RichTextPluginsType.Superscript);
                  break;
                case 'highlight':
                  onHandleSelectOption(RichTextPluginsType.Highlight);
                  break;
                case 'ul-list':
                  editor.dispatchCommand(
                    selectNodeType === 'ul' ? REMOVE_LIST_COMMAND : INSERT_UNORDERED_LIST_COMMAND,
                    undefined,
                  );
                  break;
                case 'ol-list':
                  editor.dispatchCommand(
                    selectNodeType === 'ol' ? REMOVE_LIST_COMMAND : INSERT_ORDERED_LIST_COMMAND,
                    undefined,
                  );
                  break;
                case 'al-list':
                  editor.update(() => $toggleAlphaList());
                  break;
                case 'page-break':
                  editor.dispatchCommand(INSERT_PAGE_BREAK, undefined);
                  break;
                case 'quote':
                  formatQuote();
                  break;
              }
            }}>
            <Option value='uppercase' text='Uppercase'>
              <TextCaseUppercaseFilled style={optionIconStyle} />
              Uppercase
            </Option>
            <Option value='lowercase' text='Lowercase'>
              <TextCaseLowercaseFilled style={optionIconStyle} />
              Lowercase
            </Option>
            <Option value='capitalize' text='Capitalize'>
              <TextCaseTitleFilled style={optionIconStyle} />
              Capitalize
            </Option>
            <Option value='strike' text='Strikethrough'>
              <TextStrikethroughFilled style={optionIconStyle} />
              Strikethrough
            </Option>
            <Option value='subscript' text='Subscript'>
              <TextSubscriptFilled style={optionIconStyle} />
              Subscript
            </Option>
            <Option value='superscript' text='Superscript'>
              <TextSuperscriptFilled style={optionIconStyle} />
              Superscript
            </Option>
            <Option value='highlight' text='Highlight'>
              <HighlightAccentFilled
                style={{ ...optionIconStyle, color: isEditable ? brand : fgDisabled }}
              />
              Highlight
            </Option>
            <Option value='ul-list' text='Bullet list'>
              <TextBulletListLtrFilled style={optionIconStyle} />
              Bullet list
            </Option>
            <Option value='ol-list' text='Number list'>
              <TextNumberListLtrFilled style={optionIconStyle} />
              Number list
            </Option>
            <Option value='al-list' text='Alphabetical list'>
              <TextAlphaListLtrFilled style={optionIconStyle} />
              Alphabetical list
            </Option>
            <Option value='page-break' text='Page Break'>
              <DocumentPageBreakRegular style={optionIconStyle} />
              Page break
            </Option>
            <Option value='quote' text='Quote'>
              <CommentQuoteRegular style={optionIconStyle} />
              Quote
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
          {
            value: 'left',
            label: 'Left Align',
            icon: <TextAlignLeftFilled style={optionIconStyle} />,
            action: RichTextPluginsType.LeftAlign,
          },
          {
            value: 'center',
            label: 'Center Align',
            icon: <TextAlignCenterFilled style={optionIconStyle} />,
            action: RichTextPluginsType.CenterAlign,
          },
          {
            value: 'right',
            label: 'Right Align',
            icon: <TextAlignRightFilled style={optionIconStyle} />,
            action: RichTextPluginsType.RightAlign,
          },
          {
            value: 'justify',
            label: 'Justify Align',
            icon: <TextAlignJustifyFilled style={optionIconStyle} />,
            action: RichTextPluginsType.JustifyAlign,
          },
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

      case 'PageSetup':
        return (
          <PageSetupPlugin
            key={key}
            disabled={!isEditable || props.readOnly}
            value={props.pageSetup}
            onChange={props.onPageSetupChange}
          />
        );

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
