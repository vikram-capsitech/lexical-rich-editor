import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalEditable } from '@lexical/react/useLexicalEditable';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import { mergeRegister } from '@lexical/utils';
import type { BaseSelection, LexicalEditor, NodeKey } from 'lexical';
import {
  $getNodeByKey,
  $getSelection,
  $isNodeSelection,
  $setSelection,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  DRAGSTART_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  SELECTION_CHANGE_COMMAND
} from 'lexical';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import ImageResizer from '../Utils/ImageResizer';
import './InlineImage.css';
import type { Position } from './InlineImageNode';
import { $isInlineImageNode } from './InlineImageNode';

const imageCache = new Set();

const useSuspenseImage = (src: string) => {
  if (!imageCache.has(src)) {
    throw new Promise((resolve) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        imageCache.add(src);
        resolve(null);
      };
      img.onerror = () => {
        imageCache.add(src);
        resolve(null);
      };
    });
  }
}

interface ILazyImageProps {
  src: string;
  altText: string;
  className: string | null;
  height: 'inherit' | number;
  width: 'inherit' | number;
  imageRef: { current: null | HTMLImageElement };
  position: Position;
}

const LazyImage = ({ altText, className, imageRef, src, width, height, position }: ILazyImageProps): JSX.Element => {
  useSuspenseImage(src);
  return (
    <img
      className={className || undefined}
      src={src}
      alt={altText}
      ref={imageRef}
      data-position={position}
      style={{
        display: 'block',
        maxWidth: '100%',
        height,
        width,
      }}
      draggable="false"
    />
  );
}

interface IInlineImageComponent {
  altText: string;
  src: string;
  caption: LexicalEditor;
  nodeKey: NodeKey;
  showCaption: boolean;
  width: 'inherit' | number;
  height: 'inherit' | number;
  position: Position;
}

const InlineImageComponent = ({ src, altText, nodeKey, width, height, showCaption, caption, position }: IInlineImageComponent): JSX.Element => {
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);
  const [isResizing, setIsResizing] = useState(false);
  const [selection, setSelection] = useState<BaseSelection | null>(null);
  const activeEditorRef = useRef<LexicalEditor | null>(null);
  const imageRef = useRef<null | HTMLImageElement>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [editor] = useLexicalComposerContext();
  const isEditable = useLexicalEditable();

  const $onDelete = useCallback(
    (payload: KeyboardEvent) => {
      const deleteSelection = $getSelection();
      if (isSelected && $isNodeSelection(deleteSelection)) {
        const event: KeyboardEvent = payload;
        event.preventDefault();
        if (isSelected && $isNodeSelection(deleteSelection)) {
          deleteSelection.getNodes().forEach((node) => {
            if ($isInlineImageNode(node)) {
              node.remove();
            }
          });
        }
        return true;
      }
      return false;
    },
    [isSelected],
  );

  const $onEnter = useCallback(
    (event: KeyboardEvent) => {
      const latestSelection = $getSelection();
      const buttonElem = buttonRef.current;
      if (
        isSelected &&
        $isNodeSelection(latestSelection) &&
        latestSelection.getNodes().length === 1
      ) {
        if (showCaption) {
          $setSelection(null);
          event.preventDefault();
          caption.focus();
          return true;
        } else if (
          buttonElem !== null &&
          buttonElem !== document.activeElement
        ) {
          event.preventDefault();
          buttonElem.focus();
          return true;
        }
      }
      return false;
    },
    [caption, isSelected, showCaption],
  );

  const $onEscape = useCallback(
    (event: KeyboardEvent) => {
      if (
        activeEditorRef.current === caption ||
        buttonRef.current === event.target
      ) {
        $setSelection(null);
        editor.update(() => {
          setSelected(true);
          const parentRootElement = editor.getRootElement();
          if (parentRootElement !== null) {
            parentRootElement.focus();
          }
        });
        return true;
      }
      return false;
    },
    [caption, editor, setSelected],
  );

  const onClick = useCallback(
    (payload: MouseEvent) => {
      const event = payload;
      if (isResizing) {
        return true;
      }
      if (event.target === imageRef.current) {
        if (event.shiftKey) {
          setSelected(!isSelected);
        } else {
          clearSelection();
          setSelected(true);
        }
        return true;
      }
      return false;
    },
    [isResizing, isSelected, setSelected, clearSelection],
  );

  useEffect(() => {
    let isMounted = true;
    const unregister = mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        if (isMounted) {
          setSelection(editorState.read(() => $getSelection()));
        }
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        (_, activeEditor) => {
          activeEditorRef.current = activeEditor;
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand<MouseEvent>(
        CLICK_COMMAND,
        onClick,
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(KEY_DELETE_COMMAND, $onDelete, COMMAND_PRIORITY_LOW),
      editor.registerCommand(KEY_BACKSPACE_COMMAND, $onDelete, COMMAND_PRIORITY_LOW),
      editor.registerCommand(KEY_ENTER_COMMAND, $onEnter, COMMAND_PRIORITY_LOW),
      editor.registerCommand(KEY_ESCAPE_COMMAND, $onEscape, COMMAND_PRIORITY_LOW),
    );
    return () => {
      isMounted = false;
      unregister();
    };
  }, [
    clearSelection,
    editor,
    isResizing,
    isSelected,
    nodeKey,
    $onDelete,
    $onEnter,
    $onEscape,
    onClick,
    setSelected,
  ]);

  const onResizeStart = () => {
    setIsResizing(true);
  };

  const onResizeEnd = (nextWidth: 'inherit' | number, nextHeight: 'inherit' | number) => {
    setTimeout(() => {
      setIsResizing(false);
    }, 200);
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isInlineImageNode(node)) {
        node.setWidthAndHeight(nextWidth, nextHeight);
      }
    });
  };

  const draggable = !isResizing;
  const isFocused = (isSelected || isResizing) && isEditable;

  return (
    <Suspense fallback={null}>
      <span
        draggable={draggable}
        style={{ position: 'relative', display: 'inline-block' }}
        // See ImageComponent.tsx: a host that renders through its own
        // separate React root (Fluent's Modal/Layer) can cut native click
        // propagation short at this decorator's own portal boundary, so
        // CLICK_COMMAND never fires. Handle selection here too as a fallback.
        onClick={(e) => onClick(e.nativeEvent)}
      >
        <LazyImage
          className={
            isFocused
              ? `focused ${$isNodeSelection(selection) ? 'draggable' : ''}`
              : null
          }
          src={src}
          altText={altText}
          imageRef={imageRef}
          width={width}
          height={height}
          position={position}
        />
        {$isNodeSelection(selection) && isFocused && (
          <ImageResizer
            showCaption={false}
            setShowCaption={() => {}}
            captionsEnabled={false}
            editor={editor}
            buttonRef={buttonRef}
            imageRef={imageRef}
            onResizeStart={onResizeStart}
            onResizeEnd={onResizeEnd}
          />
        )}
      </span>
    </Suspense>
  );
}

export default InlineImageComponent;
