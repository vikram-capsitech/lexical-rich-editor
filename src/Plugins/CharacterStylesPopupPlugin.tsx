// CharacterStylesPopupPlugin.tsx (RTP FIX: popup behind Fluent UI Panel)
// Paste as-is. This version portals into the closest Panel/Layer and uses position: fixed.

import { useTheme } from '@fluentui/react';
import { Button } from '@fluentui/react-components';
import {
  CodeFilled,
  LinkFilled,
  TextBold24Regular,
  TextItalicFilled,
  TextStrikethroughFilled,
  TextSubscriptFilled,
  TextSuperscriptFilled,
  TextUnderlineFilled,
} from '@fluentui/react-icons';
import { $isCodeHighlightNode } from '@lexical/code';
import { $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $isAtNodeEnd } from '@lexical/selection';
import { mergeRegister } from '@lexical/utils';
import {
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_LOW,
  ElementNode,
  FORMAT_TEXT_COMMAND,
  LexicalEditor,
  RangeSelection,
  SELECTION_CHANGE_COMMAND,
  TextNode,
} from 'lexical';
import { JSX, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getFixedPositionOrigin, useFloatingPortalContainer } from '../Utils/FloatingPortal';

type UseCharacterStylesPopupOptions = {
  /** Overrides editor.isEditable() */
  isEditable?: boolean;
  /** show popup but disable actions */
  readOnly?: boolean;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function setPopupPositionFixed(popupEl: HTMLElement, rect: DOMRect, topBoundary: number): void {
  const GAP = 8;
  const MARGIN = 8;

  // Prefer above the cursor, with the popup's left edge starting at the
  // cursor position — i.e. anchored to the bottom-right of the caret —
  // rather than right-aligning the popup's edge to it.
  let top = rect.top - popupEl.offsetHeight - GAP;
  let left = rect.left;

  // If there isn't room above the selection without crossing the toolbar
  // (or the viewport edge), show below the selection instead.
  if (top < topBoundary) top = rect.bottom + GAP;

  // Clamp to viewport
  left = clamp(left, MARGIN, window.innerWidth - popupEl.offsetWidth - MARGIN);

  // rect/window math above is all viewport coordinates, but if popupEl is
  // portaled inside an ancestor that creates a new containing block (e.g. a
  // sliding Fluent Panel animated with `transform`), `position: fixed`
  // resolves against that ancestor's box instead of the viewport — shift
  // into that ancestor's coordinate space so the popup lands next to the caret.
  const origin = getFixedPositionOrigin(popupEl);
  top -= origin.top;
  left -= origin.left;

  popupEl.style.top = `${top}px`;
  popupEl.style.left = `${left}px`;
}

type FloatingProps = {
  editor: LexicalEditor;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  isStrikethrough: boolean;
  isSubscript: boolean;
  isSuperscript: boolean;
  isCode: boolean;
  isLink: boolean;
  isEditable?: boolean;
  readOnly?: boolean;
};

function FloatingCharacterStylesEditor({
  editor,
  isBold,
  isItalic,
  isUnderline,
  isStrikethrough,
  isSubscript,
  isSuperscript,
  isCode,
  isLink,
  isEditable,
  readOnly,
}: FloatingProps): JSX.Element {
  const popupRef = useRef<HTMLDivElement | null>(null);
  const mouseDownRef = useRef(false);
  const theme = useTheme();

  const disabled = !(isEditable ?? editor.isEditable()) || !!readOnly;

  const format = useCallback(
    (
      type:
        | 'bold'
        | 'italic'
        | 'underline'
        | 'strikethrough'
        | 'subscript'
        | 'superscript'
        | 'code',
    ) => {
      if (disabled) return;
      editor.dispatchCommand(FORMAT_TEXT_COMMAND, type);
    },
    [editor, disabled],
  );

  const toggleLink = useCallback(() => {
    if (disabled) return;
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, isLink ? null : 'https://');
  }, [editor, disabled, isLink]);

  const updatePosition = useCallback(() => {
    const popupEl = popupRef.current;
    if (!popupEl) return;

    const sel = window.getSelection();
    const root = editor.getRootElement();

    if (!sel || sel.isCollapsed || !root || !root.contains(sel.anchorNode)) {
      popupEl.classList.remove('is-open');
      return;
    }

    // Anchor to the selection's focus point (where the user's cursor
    // currently sits) rather than the full range's bounding box. For a
    // multi-line selection the range's bounding rect spans every selected
    // line — right-aligning to that box's edge can land the popup far from
    // any actual text. A collapsed rect at the focus offset always sits
    // exactly at the caret, matching how Lexical's own playground behaves.
    let rect: DOMRect;
    try {
      const focusRange = document.createRange();
      focusRange.setStart(sel.focusNode!, sel.focusOffset);
      focusRange.setEnd(sel.focusNode!, sel.focusOffset);
      rect = focusRange.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0 && rect.top === 0 && rect.left === 0) {
        throw new Error('empty focus rect');
      }
    } catch {
      rect = sel.getRangeAt(0).getBoundingClientRect();
    }

    // Never render above the top of the editor's own chrome (toolbar) — the
    // toolbar is a sibling of the content-editable root, not an ancestor, so
    // walk up to their shared wrapper first.
    const toolbarEl = root
      ?.closest('.lexical-rich-editor-root')
      ?.querySelector('.editor-toolbar-root') as HTMLElement | null;
    const topBoundary = toolbarEl
      ? toolbarEl.getBoundingClientRect().bottom + 8
      : 8;

    if (!mouseDownRef.current) {
      setPopupPositionFixed(popupEl, rect as DOMRect, topBoundary);
    }

    popupEl.classList.add('is-open');
  }, [editor]);

  useEffect(() => {
    const onResize = () => editor.getEditorState().read(updatePosition);
    const onScroll = () => editor.getEditorState().read(updatePosition);

    const root = editor.getRootElement();

    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, true);
    root?.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
      root?.removeEventListener('scroll', onScroll as any);
    };
  }, [editor, updatePosition]);

  useEffect(() => {
    editor.getEditorState().read(updatePosition);

    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(updatePosition);
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          updatePosition();
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );
  }, [editor, updatePosition]);

  // Fluent v8 palette
  const p = theme.palette;
  const fg = p.neutralPrimary;
  const fgDisabled = p.neutralTertiary;
  const brand = p.themePrimary;

  const bgHover = p.neutralLighter;
  const bgPressed = p.neutralLight;
  const bgActive = p.neutralLighterAlt ?? p.neutralLighter;
  const stroke = p.neutralLight;

  const iconColor = (active?: boolean) => (disabled ? fgDisabled : active ? brand : fg);

  const btnStyle = (active?: boolean): React.CSSProperties => {
    const baseBg = active ? bgActive : 'transparent';
    return {
      border: '1px solid transparent',
      borderRadius: 8,
      minWidth: 32,
      height: 32,
      paddingInline: 6,
      background: baseBg,

      ['--fui-Button__backgroundColor' as any]: baseBg,
      ['--fui-Button__backgroundColorHover' as any]: bgHover,
      ['--fui-Button__backgroundColorPressed' as any]: bgPressed,
      ['--fui-Button__borderColorHover' as any]: stroke,
      ['--fui-Button__borderColorPressed' as any]: stroke,
      ['--fui-Button__iconColor' as any]: iconColor(active),
    };
  };

  return (
    <div
      ref={popupRef}
      className='character-style-popup'
      onMouseDown={(e) => {
        // RTP: prevents selection collapse when clicking toolbar
        e.preventDefault();
        mouseDownRef.current = true;
      }}
      onMouseUp={() => (mouseDownRef.current = false)}>
      <Button
        size='small'
        disabled={disabled}
        title='Bold'
        aria-label='Bold'
        aria-pressed={isBold}
        icon={<TextBold24Regular style={{ color: iconColor(isBold) }} />}
        style={btnStyle(isBold)}
        onClick={() => format('bold')}
      />

      <Button
        size='small'
        disabled={disabled}
        title='Italic'
        aria-label='Italic'
        aria-pressed={isItalic}
        icon={<TextItalicFilled style={{ color: iconColor(isItalic) }} />}
        style={btnStyle(isItalic)}
        onClick={() => format('italic')}
      />

      <Button
        size='small'
        disabled={disabled}
        title='Underline'
        aria-label='Underline'
        aria-pressed={isUnderline}
        icon={<TextUnderlineFilled style={{ color: iconColor(isUnderline) }} />}
        style={btnStyle(isUnderline)}
        onClick={() => format('underline')}
      />

      <Button
        size='small'
        disabled={disabled}
        title='Strikethrough'
        aria-label='Strikethrough'
        aria-pressed={isStrikethrough}
        icon={<TextStrikethroughFilled style={{ color: iconColor(isStrikethrough) }} />}
        style={btnStyle(isStrikethrough)}
        onClick={() => format('strikethrough')}
      />

      <div className='divider' aria-hidden='true' />

      <Button
        size='small'
        disabled={disabled}
        title='Subscript'
        aria-label='Subscript'
        aria-pressed={isSubscript}
        icon={<TextSubscriptFilled style={{ color: iconColor(isSubscript) }} />}
        style={btnStyle(isSubscript)}
        onClick={() => format('subscript')}
      />

      <Button
        size='small'
        disabled={disabled}
        title='Superscript'
        aria-label='Superscript'
        aria-pressed={isSuperscript}
        icon={<TextSuperscriptFilled style={{ color: iconColor(isSuperscript) }} />}
        style={btnStyle(isSuperscript)}
        onClick={() => format('superscript')}
      />

      <div className='divider' aria-hidden='true' />

      <Button
        size='small'
        disabled={disabled}
        title='Code'
        aria-label='Code'
        aria-pressed={isCode}
        icon={<CodeFilled style={{ color: iconColor(isCode) }} />}
        style={btnStyle(isCode)}
        onClick={() => format('code')}
      />

      <Button
        size='small'
        disabled={disabled}
        title='Link'
        aria-label='Link'
        aria-pressed={isLink}
        icon={<LinkFilled style={{ color: iconColor(isLink) }} />}
        style={btnStyle(isLink)}
        onClick={toggleLink}
      />
    </div>
  );
}

function getSelectedNode(selection: RangeSelection): TextNode | ElementNode {
  const anchorNode = selection.anchor.getNode();
  const focusNode = selection.focus.getNode();
  if (anchorNode === focusNode) return anchorNode;

  const isBackward = selection.isBackward();
  return isBackward
    ? $isAtNodeEnd(selection.focus)
      ? anchorNode
      : focusNode
    : $isAtNodeEnd(selection.anchor)
      ? focusNode
      : anchorNode;
}

function useCharacterStylesPopup(
  editor: LexicalEditor,
  opts?: UseCharacterStylesPopupOptions,
): JSX.Element | null {
  const [isText, setIsText] = useState(false);
  const [isLink, setIsLink] = useState(false);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [isSubscript, setIsSubscript] = useState(false);
  const [isSuperscript, setIsSuperscript] = useState(false);
  const [isCode, setIsCode] = useState(false);

  const isEditable = opts?.isEditable ?? editor.isEditable();
  const portalContainer = useFloatingPortalContainer(editor);

  const updatePopupState = useCallback(() => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      const nativeSelection = window.getSelection();
      const rootElement = editor.getRootElement();

      if (
        nativeSelection !== null &&
        (!$isRangeSelection(selection) ||
          rootElement === null ||
          !rootElement.contains(nativeSelection.anchorNode))
      ) {
        setIsText(false);
        return;
      }

      // A Callout/Popover (color picker, insert-link, insert-table, …) can be
      // open while the browser's document selection still sits inside the
      // editor — hide this popup whenever focus has actually moved into one
      // of those, so the two floating surfaces never overlap.
      const activeElement = document.activeElement;
      if (
        activeElement &&
        activeElement !== document.body &&
        rootElement &&
        !rootElement.contains(activeElement)
      ) {
        setIsText(false);
        return;
      }

      if (!$isRangeSelection(selection)) return;

      const node = getSelectedNode(selection);

      setIsBold(selection.hasFormat('bold'));
      setIsItalic(selection.hasFormat('italic'));
      setIsUnderline(selection.hasFormat('underline'));
      setIsStrikethrough(selection.hasFormat('strikethrough'));
      setIsSubscript(selection.hasFormat('subscript'));
      setIsSuperscript(selection.hasFormat('superscript'));
      setIsCode(selection.hasFormat('code'));

      const parent = node.getParent();
      setIsLink($isLinkNode(parent) || $isLinkNode(node));

      if (!$isCodeHighlightNode(selection.anchor.getNode()) && selection.getTextContent() !== '') {
        setIsText($isTextNode(node));
      } else {
        setIsText(false);
      }
    });
  }, [editor]);

  useEffect(() => {
    document.addEventListener('selectionchange', updatePopupState);
    // Focusing a Callout/Popover control doesn't always fire selectionchange,
    // so listen for focus moves directly too (see the activeElement check
    // inside updatePopupState).
    document.addEventListener('focusin', updatePopupState);
    return () => {
      document.removeEventListener('selectionchange', updatePopupState);
      document.removeEventListener('focusin', updatePopupState);
    };
  }, [updatePopupState]);

  useEffect(() => editor.registerUpdateListener(updatePopupState), [editor, updatePopupState]);

  // Hide when not text selection or when in link selection state
  if (!portalContainer || !isText || isLink) return null;

  return createPortal(
    <FloatingCharacterStylesEditor
      editor={editor}
      isLink={isLink}
      isBold={isBold}
      isItalic={isItalic}
      isStrikethrough={isStrikethrough}
      isSubscript={isSubscript}
      isSuperscript={isSuperscript}
      isUnderline={isUnderline}
      isCode={isCode}
      isEditable={isEditable}
      readOnly={opts?.readOnly}
    />,
    portalContainer,
  );
}

export default function CharacterStylesPopupPlugin(
  props: UseCharacterStylesPopupOptions,
): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  return useCharacterStylesPopup(editor, props);
}
