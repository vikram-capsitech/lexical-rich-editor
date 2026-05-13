import { $setBlocksType } from '@lexical/selection';
import { $createParagraphNode, $getSelection, LexicalEditor } from "lexical";

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
export const formatParagraph = (editor: LexicalEditor) => {
  editor.update(() => {
    const selection = $getSelection();
    $setBlocksType(selection, () => $createParagraphNode());
  });
};