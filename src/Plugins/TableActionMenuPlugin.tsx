import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $deleteTableColumnAtSelection,
  $deleteTableRowAtSelection,
  $getTableNodeFromLexicalNodeOrThrow,
  $insertTableColumnAtSelection,
  $insertTableRowAtSelection,
  $isTableCellNode,
  $isTableNode,
  $isTableSelection,
} from '@lexical/table';
import { mergeRegister } from '@lexical/utils';
import {
  $findMatchingParent,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  KEY_DOWN_COMMAND,
  SELECTION_CHANGE_COMMAND,
} from 'lexical';
import * as React from 'react';
import { createPortal } from 'react-dom';

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

export default function TableActionMenuPlugin({ disabled = false }: { disabled?: boolean }) {
  const [editor] = useLexicalComposerContext();

  const [isInTable, setIsInTable] = React.useState(false);
  const [anchorRect, setAnchorRect] = React.useState<DOMRect | null>(null);
  const [open, setOpen] = React.useState(false);

  const updateFromSelection = React.useCallback(() => {
    const root = editor.getRootElement();
    if (!root) return;

    editor.getEditorState().read(() => {
      const selection = $getSelection();

      if ($isTableSelection(selection)) {
        const tableNode = selection.getNodes().find((n) => $isTableNode(n));
        if (tableNode) {
          const dom = editor.getElementByKey(tableNode.getKey());
          if (dom) {
            setIsInTable(true);
            setAnchorRect(dom.getBoundingClientRect());
            return;
          }
        }
      }

      if (!$isRangeSelection(selection)) {
        setIsInTable(false);
        setAnchorRect(null);
        return;
      }

      const anchorNode = selection.anchor.getNode();
      const cellNode = $isTableCellNode(anchorNode)
        ? anchorNode
        : $findMatchingParent(anchorNode, (n) => $isTableCellNode(n));

      if (!cellNode || !$isTableCellNode(cellNode)) {
        setIsInTable(false);
        setAnchorRect(null);
        return;
      }

      const cellDom = editor.getElementByKey(cellNode.getKey());
      if (!cellDom) {
        setIsInTable(false);
        setAnchorRect(null);
        return;
      }

      setIsInTable(true);
      setAnchorRect(cellDom.getBoundingClientRect());
    });
  }, [editor]);

  React.useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          updateFromSelection();
          return false;
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerUpdateListener(() => {
        updateFromSelection();
      })
    );
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
      COMMAND_PRIORITY_HIGH
    );
  }, [editor, disabled]);

  React.useEffect(() => {
    if (!isInTable && open) setOpen(false);
  }, [isInTable, open]);

  const canShow = isInTable && !!anchorRect && !disabled;

  const handleStyle: React.CSSProperties | undefined = React.useMemo(() => {
    if (!anchorRect) return undefined;

    const top = Math.max(8, anchorRect.top + 6);
    const left = Math.max(8, anchorRect.right - 34);

    return {
      position: 'fixed',
      top,
      left,
      zIndex: 9999,
    };
  }, [anchorRect]);

  const dangerStyle: React.CSSProperties = {
    color: 'var(--colorPaletteRedForeground1)',
  };

  const run = React.useCallback(
    (fn: () => void) => {
      if (disabled) return;

      editor.focus();
      editor.update(() => fn());
      setOpen(false);
    },
    [disabled, editor]
  );

  const insertRowBelow = () => run(() => $insertTableRowAtSelection(true));
  const insertRowAbove = () => run(() => $insertTableRowAtSelection(false));

  const insertColRight = () => run(() => $insertTableColumnAtSelection(true));
  const insertColLeft = () => run(() => $insertTableColumnAtSelection(false));

  const deleteRow = () => run(() => $deleteTableRowAtSelection());
  const deleteCol = () => run(() => $deleteTableColumnAtSelection());

  const deleteTable = () =>
    run(() => {
      const selection = $getSelection();

      if ($isTableSelection(selection)) {
        const tableNode = selection.getNodes().find((n) => $isTableNode(n));
        if (tableNode) tableNode.remove();
        return;
      }

      if (!$isRangeSelection(selection)) return;

      const node = selection.anchor.getNode();
      const cell =
        $findMatchingParent(node, (n) => $isTableCellNode(n)) ??
        ($isTableCellNode(node) ? node : null);

      if (!cell) return;

      const table = $getTableNodeFromLexicalNodeOrThrow(cell);
      table.remove();
    });

  if (!canShow || !handleStyle) return null;

  return createPortal(
    <div style={handleStyle} className='aoTableActionHandleRoot'>
      <Menu open={open} onOpenChange={(_, data) => setOpen(data.open)}>
        <MenuTrigger disableButtonEnhancement>
          <button
            type='button'
            className='aoTableActionHandleBtn'
            aria-label='Table options'
            onMouseDown={(e) => {
              e.preventDefault();
            }}>
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
    document.body
  );
}
