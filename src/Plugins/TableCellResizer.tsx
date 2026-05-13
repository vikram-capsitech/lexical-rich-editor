// TableCellResizerPlugin.tsx (UPDATED)
// - Adds anchorElem prop so the portal mounts INSIDE the editor wrapper (fixes bottom-left/position issues)
// - Uses anchorElem for mousemove listener instead of document (scopes events, avoids weird positioning in Storybook)
// - Avoids re-registering SELECTION_CHANGE_COMMAND every render (adds deps + cleanup correctly)

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getTableColumnIndexFromTableCellNode,
  $getTableNodeFromLexicalNodeOrThrow,
  $getTableRowIndexFromTableCellNode,
  $isTableCellNode,
  $isTableRowNode,
  getDOMCellFromTarget,
  getTableObserverFromTableElement,
} from '@lexical/table';
import type { LexicalEditor } from 'lexical';
import {
  $getNearestNodeFromDOMNode,
  COMMAND_PRIORITY_HIGH,
  SELECTION_CHANGE_COMMAND,
} from 'lexical';
import type { MouseEvent as ReactMouseEvent } from 'react';
import React, { ReactPortal, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './TableCellResizer.css';

type MousePosition = { x: number; y: number };
type MouseDraggingDirection = 'right' | 'bottom';

const MIN_ROW_HEIGHT = 33;
const MIN_COLUMN_WIDTH = 50;

type DOMCell = { elem: HTMLElement };

function TableCellResizer({
  editor,
  anchorElem,
}: {
  editor: LexicalEditor;
  anchorElem: HTMLElement;
}): JSX.Element {
  const targetRef = useRef<HTMLElement | null>(null);
  const resizerRef = useRef<HTMLDivElement | null>(null);
  const tableRectRef = useRef<ClientRect | null>(null);

  const mouseStartPosRef = useRef<MousePosition | null>(null);
  const [mouseCurrentPos, updateMouseCurrentPos] = useState<MousePosition | null>(null);

  const [activeCell, updateActiveCell] = useState<DOMCell | null>(null);
  const [isSelectingGrid, updateIsSelectingGrid] = useState<boolean>(false);
  const [draggingDirection, updateDraggingDirection] = useState<MouseDraggingDirection | null>(
    null
  );

  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        let isGridSelection = false;

        const nativeSelection = window.getSelection();
        const anchorNode = nativeSelection?.anchorNode || null;

        const anchorElement =
          (anchorNode as any) instanceof Element
            ? (anchorNode as Element)
            : (anchorNode as Node | null)?.parentElement || null;

        if (anchorElement) {
          const cell = getDOMCellFromTarget(anchorElement as HTMLElement) as DOMCell | null;
          const tableEl = (cell?.elem?.closest?.('table') as HTMLTableElement | null) || null;

          if (tableEl) {
            const observer = getTableObserverFromTableElement(tableEl) as any;
            const tableSelection =
              observer?.getTableSelection?.() ?? observer?.tableSelection ?? null;
            isGridSelection = !!tableSelection;
          }
        }

        updateIsSelectingGrid((prev) => (prev !== isGridSelection ? isGridSelection : prev));
        return false;
      },
      COMMAND_PRIORITY_HIGH
    );
  }, [editor]);

  const resetState = useCallback(() => {
    updateActiveCell(null);
    targetRef.current = null;
    updateDraggingDirection(null);
    mouseStartPosRef.current = null;
    tableRectRef.current = null;
    updateMouseCurrentPos(null);
  }, []);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      // If user is dragging, just update current mouse position
      if (draggingDirection) {
        updateMouseCurrentPos({ x: event.clientX, y: event.clientY });
        return;
      }

      const target = event.target as HTMLElement | null;
      if (!target) return;

      if (resizerRef.current && resizerRef.current.contains(target)) return;

      if (targetRef.current !== target) {
        targetRef.current = target;

        const cell = getDOMCellFromTarget(target) as DOMCell | null;

        if (cell && activeCell !== cell) {
          editor.update(() => {
            const tableCellNode = $getNearestNodeFromDOMNode(cell.elem);
            if (!tableCellNode) {
              resetState();
              return;
            }

            const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
            const tableElement = editor.getElementByKey(tableNode.getKey());

            if (!tableElement) {
              resetState();
              return;
            }

            tableRectRef.current = tableElement.getBoundingClientRect();
            updateActiveCell(cell);
          });
        } else if (cell == null) {
          resetState();
        }
      }
    };

    anchorElem.addEventListener('mousemove', onMouseMove);

    const onLeave = () => {
      if (!draggingDirection) resetState();
    };
    anchorElem.addEventListener('mouseleave', onLeave);

    return () => {
      anchorElem.removeEventListener('mousemove', onMouseMove);
      anchorElem.removeEventListener('mouseleave', onLeave);
    };
  }, [activeCell, draggingDirection, editor, resetState, anchorElem]);

  const isHeightChanging = (direction: MouseDraggingDirection) => direction === 'bottom';

  const updateRowHeight = useCallback(
    (newHeight: number) => {
      if (!activeCell) return;

      editor.update(() => {
        const tableCellNode = $getNearestNodeFromDOMNode(activeCell.elem);
        if (!$isTableCellNode(tableCellNode)) return;

        const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
        const tableRowIndex = $getTableRowIndexFromTableCellNode(tableCellNode);
        const tableRows = tableNode.getChildren();

        if (tableRowIndex >= tableRows.length || tableRowIndex < 0) return;

        const tableRow = tableRows[tableRowIndex];
        if (!$isTableRowNode(tableRow)) return;

        tableRow.setHeight(newHeight);
      });
    },
    [activeCell, editor]
  );

  const updateColumnWidth = useCallback(
    (newWidth: number) => {
      if (!activeCell) return;

      editor.update(() => {
        const tableCellNode = $getNearestNodeFromDOMNode(activeCell.elem);
        if (!$isTableCellNode(tableCellNode)) return;

        const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
        const tableColumnIndex = $getTableColumnIndexFromTableCellNode(tableCellNode);
        const tableRows = tableNode.getChildren();

        for (let r = 0; r < tableRows.length; r++) {
          const tableRow = tableRows[r];
          if (!$isTableRowNode(tableRow)) continue;

          const tableCells = tableRow.getChildren();
          if (tableColumnIndex >= tableCells.length || tableColumnIndex < 0) continue;

          const tableCell = tableCells[tableColumnIndex];
          if (!$isTableCellNode(tableCell)) continue;

          tableCell.setWidth(newWidth);
        }
      });
    },
    [activeCell, editor]
  );

  const toggleResize = useCallback(
    (direction: MouseDraggingDirection) => (event: ReactMouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      if (!activeCell) return;

      if (draggingDirection === direction && mouseStartPosRef.current) {
        const { x, y } = mouseStartPosRef.current;
        const { height, width } = activeCell.elem.getBoundingClientRect();

        if (isHeightChanging(direction)) {
          const heightChange = Math.abs(event.clientY - y);
          const isShrinking = direction === 'bottom' && y > event.clientY;

          updateRowHeight(
            Math.max(isShrinking ? height - heightChange : height + heightChange, MIN_ROW_HEIGHT)
          );
        } else {
          const widthChange = Math.abs(event.clientX - x);
          const isShrinking = direction === 'right' && x > event.clientX;

          updateColumnWidth(
            Math.max(isShrinking ? width - widthChange : width + widthChange, MIN_COLUMN_WIDTH)
          );
        }

        resetState();
        return;
      }

      // start drag
      const start = { x: event.clientX, y: event.clientY };
      mouseStartPosRef.current = start;
      updateMouseCurrentPos(start);
      updateDraggingDirection(direction);
    },
    [activeCell, draggingDirection, resetState, updateColumnWidth, updateRowHeight]
  );

  const getResizers = useCallback(() => {
    type ResizerStyles = Record<MouseDraggingDirection, React.CSSProperties>;

    const empty: ResizerStyles = { bottom: {}, right: {} };

    if (!activeCell) return empty;

    const cellRect = activeCell.elem.getBoundingClientRect();
    const anchorRect = anchorElem.getBoundingClientRect();

    const baseTop = cellRect.top - anchorRect.top + anchorElem.scrollTop;
    const baseLeft = cellRect.left - anchorRect.left + anchorElem.scrollLeft;

    const styles: ResizerStyles = {
      bottom: {
        backgroundColor: 'transparent',
        cursor: 'row-resize',
        height: '10px',
        left: `${baseLeft}px`,
        top: `${baseTop + cellRect.height}px`,
        width: `${cellRect.width}px`,
        position: 'absolute',
      },
      right: {
        backgroundColor: 'transparent',
        cursor: 'col-resize',
        height: `${cellRect.height}px`,
        left: `${baseLeft + cellRect.width}px`,
        top: `${baseTop}px`,
        width: '10px',
        position: 'absolute',
      },
    };

    const tableRect = tableRectRef.current;

    if (draggingDirection && mouseCurrentPos && tableRect) {
      const mouseX = mouseCurrentPos.x - anchorRect.left + anchorElem.scrollLeft;
      const mouseY = mouseCurrentPos.y - anchorRect.top + anchorElem.scrollTop;

      const tableLeft = tableRect.left - anchorRect.left + anchorElem.scrollLeft;
      const tableTop = tableRect.top - anchorRect.top + anchorElem.scrollTop;

      if (isHeightChanging(draggingDirection)) {
        styles.bottom.left = `${tableLeft}px`;
        styles.bottom.top = `${mouseY}px`;
        styles.bottom.height = '3px';
        styles.bottom.width = `${tableRect.width}px`;
        styles.bottom.backgroundColor = '#adf';
      } else {
        styles.right.top = `${tableTop}px`;
        styles.right.left = `${mouseX}px`;
        styles.right.width = '3px';
        styles.right.height = `${tableRect.height}px`;
        styles.right.backgroundColor = '#adf';
      }
    }

    return styles;
  }, [activeCell, draggingDirection, mouseCurrentPos, anchorElem]);

  const resizerStyles = getResizers();

  return (
    <div ref={resizerRef}>
      {activeCell != null && !isSelectingGrid && (
        <>
          <div
            className='TableCellResizer__resizer TableCellResizer__ui'
            style={resizerStyles.right}
            onMouseDown={toggleResize('right')}
            onMouseUp={toggleResize('right')}
          />
          <div
            className='TableCellResizer__resizer TableCellResizer__ui'
            style={resizerStyles.bottom}
            onMouseDown={toggleResize('bottom')}
            onMouseUp={toggleResize('bottom')}
          />
        </>
      )}
    </div>
  );
}

export default function TableCellResizerPlugin({
  anchorElem,
}: {
  anchorElem: HTMLElement;
}): ReactPortal {
  const [editor] = useLexicalComposerContext();

  return useMemo(
    () => createPortal(<TableCellResizer editor={editor} anchorElem={anchorElem} />, anchorElem),
    [editor, anchorElem]
  );
}
