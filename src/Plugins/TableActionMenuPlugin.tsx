import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $deleteTableColumnAtSelection,
  $deleteTableRowAtSelection,
  $insertTableColumnAtSelection,
  $insertTableRowAtSelection,
  $isTableCellNode,
  $isTableNode,
  $isTableSelection,
} from '@lexical/table';
import { mergeRegister } from '@lexical/utils';
import {
  $createRangeSelection,
  $findMatchingParent,
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  $setSelection,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  KEY_DOWN_COMMAND,
  SELECTION_CHANGE_COMMAND,
} from 'lexical';
import * as React from 'react';
import { createPortal } from 'react-dom';

import { useFloatingPortalContainer } from '../Utils/FloatingPortal';

import {
  Menu,
  MenuDivider,
  MenuGroup,
  MenuGroupHeader,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
} from '@fluentui/react-components';

import {
  ArrowDownRegular,
  ArrowLeftRegular,
  ArrowRightRegular,
  ArrowUpRegular,
  ChevronDown12Regular,
  ColumnTripleRegular,
  DeleteRegular,
  RowTripleRegular,
} from '@fluentui/react-icons';

import './TableActionMenu.css';

// Walks up from the cell to find the nearest ancestor that actually clips
// overflow (an `overflow: auto|scroll` container whose content overflows it),
// e.g. the editor's own scrollable panel — distinct from the window viewport.
function getScrollClipAncestor(el: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const style = getComputedStyle(node);
    if (
      (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
      node.scrollHeight > node.clientHeight
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

// A cell that has scrolled above/below its scroll container (or off the
// window viewport entirely) still returns a DOMRect from
// getBoundingClientRect — it's just clipped out of view. Without this check
// the button keeps tracking that rect and, once the clamp in handleStyle
// pins it to the viewport edge, appears to hover on its own with nothing
// beneath it instead of disappearing along with the table.
function isRectVisible(rect: DOMRect, cellDom: HTMLElement): boolean {
  if (rect.width === 0 && rect.height === 0) return false;
  if (rect.bottom <= 0 || rect.top >= window.innerHeight) return false;
  if (rect.right <= 0 || rect.left >= window.innerWidth) return false;

  const clipAncestor = getScrollClipAncestor(cellDom);
  if (clipAncestor) {
    const containerRect = clipAncestor.getBoundingClientRect();
    if (rect.bottom <= containerRect.top || rect.top >= containerRect.bottom) return false;
    if (rect.right <= containerRect.left || rect.left >= containerRect.right) return false;
  }

  return true;
}

export default function TableActionMenuPlugin({ disabled = false }: { disabled?: boolean }) {
  const [editor] = useLexicalComposerContext();
  const portalContainer = useFloatingPortalContainer(editor);

  const [isInTable, setIsInTable] = React.useState(false);
  const [anchorRect, setAnchorRect] = React.useState<DOMRect | null>(null);
  const [isAnchorVisible, setIsAnchorVisible] = React.useState(false);
  const [contentRight, setContentRight] = React.useState<number | null>(null);
  const [open, setOpen] = React.useState(false);
  const openRef = React.useRef(false);
  const savedAnchorRef = React.useRef<{ key: string; offset: number; type: 'text' | 'element' } | null>(null);

  const measureContentRight = React.useCallback((cellDom: HTMLElement): number | null => {
    try {
      const range = document.createRange();
      range.selectNodeContents(cellDom);
      const cr = range.getBoundingClientRect();
      return cr.width > 2 ? cr.right : null;
    } catch {
      return null;
    }
  }, []);

  const updateFromSelection = React.useCallback(() => {
    if (openRef.current) return;
    const root = editor.getRootElement();
    if (!root) return;

    editor.getEditorState().read(() => {
      const selection = $getSelection();

      if ($isTableSelection(selection)) {
        const tableNode = selection.getNodes().find((n) => $isTableNode(n));
        if (tableNode) {
          const dom = editor.getElementByKey(tableNode.getKey());
          if (dom) {
            const rect = dom.getBoundingClientRect();
            setIsInTable(true);
            setAnchorRect(rect);
            setIsAnchorVisible(isRectVisible(rect, dom as HTMLElement));
            setContentRight(null);
            return;
          }
        }
      }

      if (!$isRangeSelection(selection)) {
        setIsInTable(false);
        setAnchorRect(null);
        setIsAnchorVisible(false);
        setContentRight(null);
        return;
      }

      const anchorNode = selection.anchor.getNode();
      const cellNode = $isTableCellNode(anchorNode)
        ? anchorNode
        : $findMatchingParent(anchorNode, (n) => $isTableCellNode(n));

      if (!cellNode || !$isTableCellNode(cellNode)) {
        setIsInTable(false);
        setAnchorRect(null);
        setIsAnchorVisible(false);
        setContentRight(null);
        return;
      }

      const cellDom = editor.getElementByKey(cellNode.getKey());
      if (!cellDom) {
        setIsInTable(false);
        setAnchorRect(null);
        setIsAnchorVisible(false);
        setContentRight(null);
        return;
      }

      const cellRect = cellDom.getBoundingClientRect();
      setIsInTable(true);
      setAnchorRect(cellRect);
      setIsAnchorVisible(isRectVisible(cellRect, cellDom as HTMLElement));
      setContentRight(measureContentRight(cellDom as HTMLElement));

      if ($isRangeSelection(selection)) {
        savedAnchorRef.current = {
          key: selection.anchor.key,
          offset: selection.anchor.offset,
          type: selection.anchor.type as 'text' | 'element',
        };
      }
    });
  }, [editor, measureContentRight]);

  React.useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          updateFromSelection();
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerUpdateListener(() => {
        updateFromSelection();
      }),
    );
  }, [editor, updateFromSelection]);

  // anchorRect is a viewport-relative snapshot (getBoundingClientRect) taken
  // once on selection change — without this, scrolling the page or the
  // editor's own scroll container leaves the button anchored to that stale
  // snapshot while the cell it's supposed to sit next to moves away underneath
  // it, exactly like FloatLinkEditor/CharacterStylesPopupPlugin already guard
  // against for their own floating surfaces.
  React.useEffect(() => {
    const root = editor.getRootElement();
    const reposition = () => updateFromSelection();

    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    root?.addEventListener('scroll', reposition, { passive: true });

    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
      root?.removeEventListener('scroll', reposition);
    };
  }, [editor, updateFromSelection]);

  React.useEffect(() => {
    return editor.registerCommand<KeyboardEvent>(
      KEY_DOWN_COMMAND,
      (event) => {
        if (disabled) return false;

        const selection = $getSelection();

        const inTable =
          $isTableSelection(selection) ||
          ($isRangeSelection(selection) &&
            (() => {
              const node = selection.anchor.getNode();
              const cellNode = $isTableCellNode(node)
                ? node
                : $findMatchingParent(node, (n) => $isTableCellNode(n));
              return !!cellNode;
            })());

        if (!inTable) return false;

        if (!(event.altKey && event.shiftKey)) return false;

        switch (event.key) {
          case 'ArrowUp': {
            event.preventDefault();
            editor.update(() => $insertTableRowAtSelection(false));
            return true;
          }
          case 'ArrowDown': {
            event.preventDefault();
            editor.update(() => $insertTableRowAtSelection(true));
            return true;
          }
          case 'ArrowLeft': {
            event.preventDefault();
            editor.update(() => $insertTableColumnAtSelection(false));
            return true;
          }
          case 'ArrowRight': {
            event.preventDefault();
            editor.update(() => $insertTableColumnAtSelection(true));
            return true;
          }
          default:
            return false;
        }
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor, disabled]);


  const canShow = isInTable && !!anchorRect && isAnchorVisible && !disabled;

  const handleStyle: React.CSSProperties | undefined = React.useMemo(() => {
    if (!anchorRect) return undefined;

    const top = Math.max(8, anchorRect.top + 6);
    const clampedCellRight = Math.min(anchorRect.right, window.innerWidth - 8);
    // Place button right beside the content; fall back to near left edge when cell is empty
    const left = contentRight !== null
      ? Math.max(anchorRect.left + 4, Math.min(contentRight + 4, clampedCellRight - 32))
      : Math.max(8, anchorRect.left + 8);

    return {
      position: 'fixed',
      top,
      left,
      // Matches the other floating surfaces (see FloatingPortal.ts): must clear
      // Fluent's Panel/Modal Layer host (z-index 1000000), otherwise this
      // button renders behind the modal chrome in a full-page/Panel view.
      zIndex: 10000010,
    };
  }, [anchorRect, contentRight]);

  const dangerStyle: React.CSSProperties = {
    color: 'var(--colorPaletteRedForeground1)',
  };

  const run = React.useCallback(
    (fn: () => void) => {
      if (disabled) return;

      openRef.current = false;
      setOpen(false);
      editor.update(() => {
        const saved = savedAnchorRef.current;
        if (saved && $getNodeByKey(saved.key)) {
          const sel = $createRangeSelection();
          sel.anchor.set(saved.key, saved.offset, saved.type);
          sel.focus.set(saved.key, saved.offset, saved.type);
          $setSelection(sel);
        }
        fn();
      });
    },
    [disabled, editor],
  );

  const insertRowBelow = () => run(() => $insertTableRowAtSelection(true));
  const insertRowAbove = () => run(() => $insertTableRowAtSelection(false));

  const insertColRight = () => run(() => $insertTableColumnAtSelection(true));
  const insertColLeft = () => run(() => $insertTableColumnAtSelection(false));

  const deleteRow = () => run(() => $deleteTableRowAtSelection());
  const deleteCol = () => run(() => $deleteTableColumnAtSelection());

  const deleteTable = () => {
    if (disabled) return;
    openRef.current = false;
    setOpen(false);
    editor.update(() => {
      const saved = savedAnchorRef.current;
      if (!saved) return;
      const anchorNode = $getNodeByKey(saved.key);
      if (!anchorNode) return;
      // Walk up the tree to find the enclosing table node, then remove it.
      const tableNode = $findMatchingParent(anchorNode, (n) => $isTableNode(n));
      if (tableNode) tableNode.remove();
    });
  };


  if (!canShow || !handleStyle || !portalContainer) return null;

  return createPortal(
    <div style={handleStyle} className='aoTableActionHandleRoot' data-lexical-editor-portal='true'>
      <Menu open={open} onOpenChange={(_, data) => { openRef.current = data.open; setOpen(data.open); }}>
        <MenuTrigger disableButtonEnhancement>
          <button
            type='button'
            className='aoTableActionHandleBtn'
            aria-label='Table options'>
            <ChevronDown12Regular />
          </button>
        </MenuTrigger>

        <MenuPopover className='aoTableActionPopover'>
          <MenuList>
            <MenuGroup>
              <MenuGroupHeader>Insert</MenuGroupHeader>

              <MenuItem icon={<RowTripleRegular />} onClick={insertRowAbove}>
                <span className='aoMenuRow'>
                  <span className='aoMenuLabel'>
                    <ArrowUpRegular /> Row above
                  </span>
                  <span className='aoMenuShortcut'>Alt ⇧ ↑</span>
                </span>
              </MenuItem>

              <MenuItem icon={<RowTripleRegular />} onClick={insertRowBelow}>
                <span className='aoMenuRow'>
                  <span className='aoMenuLabel'>
                    <ArrowDownRegular /> Row below
                  </span>
                  <span className='aoMenuShortcut'>Alt ⇧ ↓</span>
                </span>
              </MenuItem>

              <MenuDivider />

              <MenuItem icon={<ColumnTripleRegular />} onClick={insertColLeft}>
                <span className='aoMenuRow'>
                  <span className='aoMenuLabel'>
                    <ArrowLeftRegular /> Column left
                  </span>
                  <span className='aoMenuShortcut'>Alt ⇧ ←</span>
                </span>
              </MenuItem>

              <MenuItem icon={<ColumnTripleRegular />} onClick={insertColRight}>
                <span className='aoMenuRow'>
                  <span className='aoMenuLabel'>
                    <ArrowRightRegular /> Column right
                  </span>
                  <span className='aoMenuShortcut'>Alt ⇧ →</span>
                </span>
              </MenuItem>
            </MenuGroup>

            <MenuDivider />

            <MenuGroup>
              <MenuGroupHeader>Delete</MenuGroupHeader>

              <MenuItem icon={<DeleteRegular />} onClick={deleteRow} style={dangerStyle}>
                Delete row
              </MenuItem>

              <MenuItem icon={<DeleteRegular />} onClick={deleteCol} style={dangerStyle}>
                Delete column
              </MenuItem>

              <MenuItem icon={<DeleteRegular />} onClick={deleteTable} style={dangerStyle}>
                Delete table
              </MenuItem>

            </MenuGroup>
          </MenuList>
        </MenuPopover>
      </Menu>
    </div>,
    portalContainer,
  );
}
