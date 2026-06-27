import { $isHeadingNode, $createHeadingNode } from '@lexical/rich-text';
import { $setBlocksType } from '@lexical/selection';
import {
  $createParagraphNode,
  $getSelection,
  $isElementNode,
  $isLineBreakNode,
  $isRangeSelection,
  ElementNode,
  LexicalEditor,
  LexicalNode,
  RangeSelection,
} from 'lexical';

export const getSelectedBtnProps = (isSelected: boolean) =>
  isSelected
    ? {
        colorScheme: "blue",
        variant: "solid",
      }
    : { color: "#444" };

export enum UpdateFontSizeType {
  increment = 1,
  decrement,
}
export const MIN_ALLOWED_FONT_SIZE = 8;
export const MAX_ALLOWED_FONT_SIZE = 72;
export const DEFAULT_FONT_SIZE = 15;
export const fontSize = `${DEFAULT_FONT_SIZE}px`;

type Force = [number, number];
type Listener = (force: Force, e: TouchEvent) => void;
type ElementValues = {
  start: null | Force;
  listeners: Set<Listener>;
  handleTouchstart: (e: TouchEvent) => void;
  handleTouchend: (e: TouchEvent) => void;
};

const elements = new WeakMap<HTMLElement, ElementValues>();

function readTouch(e: TouchEvent): [number, number] | null {
  const touch = e.changedTouches[0];
  if (touch === undefined) {
    return null;
  }
  return [touch.clientX, touch.clientY];
}

const addListener = (element: HTMLElement, cb: Listener): () => void => {
  let elementValues = elements.get(element);
  if (elementValues === undefined) {
    const listeners: any = new Set<Listener>();
    const handleTouchstart = (e: TouchEvent) => {
      if (elementValues !== undefined) {
        elementValues.start = readTouch(e);
      }
    };
    const handleTouchend = (e: TouchEvent) => {
      if (elementValues === undefined) {
        return;
      }
      const start = elementValues.start;
      if (start === null) {
        return;
      }
      const end = readTouch(e);
      for (const listener of listeners) {
        if (end !== null) {
          listener([end[0] - start[0], end[1] - start[1]], e);
        }
      }
    };
    element.addEventListener('touchstart', handleTouchstart);
    element.addEventListener('touchend', handleTouchend);

    elementValues = {
      handleTouchend,
      handleTouchstart,
      listeners,
      start: null,
    };
    elements.set(element, elementValues);
  }
  elementValues.listeners.add(cb);
  return () => deleteListener(element, cb);
}

function deleteListener(element: HTMLElement, cb: Listener): void {
  const elementValues = elements.get(element);
  if (elementValues === undefined) {
    return;
  }
  const listeners = elementValues.listeners;
  listeners.delete(cb);
  if (listeners.size === 0) {
    elements.delete(element);
    element.removeEventListener('touchstart', elementValues.handleTouchstart);
    element.removeEventListener('touchend', elementValues.handleTouchend);
  }
}

export function addSwipeLeftListener(
  element: HTMLElement,
  cb: (_force: number, e: TouchEvent) => void,
) {
  return addListener(element, (force, e) => {
    const [x, y] = force;
    if (x < 0 && -x > Math.abs(y)) {
      cb(x, e);
    }
  });
}

export function addSwipeRightListener(
  element: HTMLElement,
  cb: (_force: number, e: TouchEvent) => void,
) {
  return addListener(element, (force, e) => {
    const [x, y] = force;
    if (x > 0 && x > Math.abs(y)) {
      cb(x, e);
    }
  });
}

export function addSwipeUpListener(
  element: HTMLElement,
  cb: (_force: number, e: TouchEvent) => void,
) {
  return addListener(element, (force, e) => {
    const [x, y] = force;
    if (y < 0 && -y > Math.abs(x)) {
      cb(x, e);
    }
  });
}

export function addSwipeDownListener(
  element: HTMLElement,
  cb: (_force: number, e: TouchEvent) => void,
) {
  return addListener(element, (force, e) => {
    const [x, y] = force;
    if (y > 0 && y > Math.abs(x)) {
      cb(x, e);
    }
  });
}
/**
 * Splits block elements (paragraphs, headings …) that contain LineBreakNodes
 * (Shift+Enter) into individual same-type block elements, then restores a
 * valid selection.
 *
 * Must be called **inside** an `editor.update()` before any `$setBlocksType`.
 *
 * Problem: When the user presses Shift+Enter several times, multiple "lines"
 * live inside a single block element as LineBreakNodes. Calling $setBlocksType
 * then applies the new block type to the entire block — affecting ALL lines,
 * not just the one the user selected.
 *
 * Solution: Walk every block touched by the selection. If it contains any
 * LineBreakNodes, split it at each LineBreakNode boundary so every visual
 * "line" becomes its own independent block. $setBlocksType will then only
 * touch the block(s) that the selection actually covers.
 */
export function $splitBlocksAtLineBreaks(selection: RangeSelection): void {
  // Collect unique top-level blocks touched by the selection.
  const blocksToSplit = new Set<ElementNode>();
  for (const node of selection.getNodes()) {
    const block = node.getTopLevelElement();
    // DecoratorNodes (e.g. YouTube) are not ElementNodes and have no children.
    if (block && $isElementNode(block)) {
      const children = block.getChildren();
      if (children.some($isLineBreakNode)) {
        blocksToSplit.add(block);
      }
    }
  }

  for (const block of blocksToSplit) {
    const children = [...block.getChildren()];

    // Group children into segments at each LineBreakNode boundary.
    const groups: LexicalNode[][] = [[]];
    for (const child of children) {
      if ($isLineBreakNode(child)) {
        groups.push([]);
      } else {
        groups[groups.length - 1].push(child);
      }
    }

    // Only split if there is more than one non-empty segment.
    // We must NOT discard empty groups — they represent blank lines (visual
    // spacing) that the user explicitly inserted with Shift+Enter.
    const nonEmptyCount = groups.filter((g) => g.length > 0).length;
    if (nonEmptyCount <= 1) continue; // nothing to split

    // Insert new blocks in REVERSE order right after the original so the
    // DOM order ends up as:  block[seg0] → newBlock[seg1] → newBlock[seg2] …
    //
    // Empty group  → empty ParagraphNode (blank visual line).
    // Non-empty group → same-type block as original (heading keeps its tag).
    for (let i = groups.length - 1; i >= 1; i--) {
      const group = groups[i];
      const newBlock: ElementNode =
        group.length === 0
          ? $createParagraphNode()                            // blank line
          : $isHeadingNode(block)
            ? $createHeadingNode(block.getTag())             // heading content
            : $createParagraphNode();                        // paragraph content

      // Appending moves nodes out of `block` automatically.
      group.forEach((child) => newBlock.append(child));
      block.insertAfter(newBlock);
    }

    // Remove any LineBreakNodes still left in the original block.
    // (groups[0] nodes are already there; only BRs need to go.)
    [...block.getChildren()]
      .filter($isLineBreakNode)
      .forEach((br) => br.remove());
  }
}

/**
 * If the selection is a non-collapsed partial selection within a **single**
 * block (not covering the entire block), splits that block at the selection
 * boundaries so the selected content becomes its own isolated paragraph.
 *
 * After the split, the editor selection is repositioned onto the new
 * isolated block so that a subsequent `$setBlocksType` call only converts
 * that block — leaving the text before and after as separate paragraphs.
 *
 * Returns `true` when a split occurred; `false` when no split was needed
 * (cursor-only selection, multi-block selection, or the whole block is
 * already selected).
 *
 * Only handles cases where all selected nodes are *direct* children of the
 * parent block (plain-text paragraphs).  Content that is nested inside
 * inline-format nodes (bold, italic …) falls back gracefully to the
 * standard whole-block conversion so inline formatting is never broken.
 *
 * Must be called **inside** an `editor.update()`.
 */
export function $splitBlockAtPartialSelection(selection: RangeSelection): boolean {
  // Collapsed selections (cursor, no text selected) should not split the block.
  if (selection.isCollapsed()) return false;

  const anchorBlock = selection.anchor.getNode().getTopLevelElement();
  const focusBlock  = selection.focus.getNode().getTopLevelElement();

  // Only handle same-block selections.
  if (!anchorBlock || !focusBlock || !anchorBlock.is(focusBlock)) return false;
  if (!$isElementNode(anchorBlock)) return false;

  const block = anchorBlock;

  // extract() splits TextNodes at the anchor/focus offsets so we get clean
  // node boundaries. After this call the selection anchor/focus point to
  // the split nodes; the returned array is the nodes *inside* the selection.
  const extractedNodes = selection.extract();
  if (!extractedNodes.length) return false;

  // Only split when every extracted node is a direct child of the block.
  // If any node is nested (e.g. TextNode inside <strong>), fall back to the
  // standard whole-block heading so we don't break inline formatting.
  const allDirect = extractedNodes.every((n) => {
    const parent = n.getParent();
    return parent !== null && parent.is(block);
  });
  if (!allDirect) return false;

  // Fetch FRESH children — extract() may have split TextNodes.
  const allChildren = [...block.getChildren()];

  const firstSelected = extractedNodes[0];
  const lastSelected  = extractedNodes[extractedNodes.length - 1];
  const firstIdx = allChildren.findIndex((n) => n.is(firstSelected));
  const lastIdx  = allChildren.findIndex((n) => n.is(lastSelected));

  if (firstIdx === -1 || lastIdx === -1) return false;
  // The whole block is already selected — no split needed.
  if (firstIdx === 0 && lastIdx === allChildren.length - 1) return false;

  const selectedNodes = allChildren.slice(firstIdx, lastIdx + 1);
  const afterNodes    = allChildren.slice(lastIdx + 1);
  // Nodes at indices [0, firstIdx) stay in the original block unchanged.

  // Insert in an order that produces: original-block → selectedBlock → afterBlock
  // Strategy: each `insertAfter` places the new node *immediately* after block,
  // so we insert afterBlock first (pushed right by the next call), then selectedBlock.
  if (afterNodes.length > 0) {
    const afterBlock: ElementNode = $isHeadingNode(block)
      ? $createHeadingNode(block.getTag())
      : $createParagraphNode();
    afterNodes.forEach((n) => afterBlock.append(n)); // moves nodes out of original block
    block.insertAfter(afterBlock);                   // original → afterBlock
  }

  const selectedBlock = $createParagraphNode();
  selectedNodes.forEach((n) => selectedBlock.append(n)); // moves nodes out of original block
  block.insertAfter(selectedBlock);                       // original → selectedBlock → afterBlock

  // If nothing remained before the selection, the original block is now empty.
  if (block.getChildrenSize() === 0) {
    block.remove();
  }

  // Reposition the editor selection onto selectedBlock so the caller's
  // subsequent $setBlocksType converts only this block.
  selectedBlock.select();

  return true;
}

export const formatParagraph = (editor: LexicalEditor) => {
  editor.update(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      // Split multi-line blocks first so only the selected line(s) become a paragraph.
      $splitBlocksAtLineBreaks(selection);
    }
    $setBlocksType($getSelection(), () => $createParagraphNode());
  });
};