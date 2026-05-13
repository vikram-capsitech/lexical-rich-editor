import {
  $createLinkNode,
  $isAutoLinkNode,
  $isLinkNode,
  TOGGLE_LINK_COMMAND
} from '@lexical/link';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $isAtNodeEnd } from '@lexical/selection';
import { $findMatchingParent, mergeRegister } from '@lexical/utils';
import {
  $getSelection, $isRangeSelection,
  BaseSelection,
  CLICK_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW, ElementNode, getDOMSelection,
  KEY_ESCAPE_COMMAND,
  LexicalEditor, RangeSelection, SELECTION_CHANGE_COMMAND, TextNode
} from 'lexical';
import * as React from 'react';
import { Dispatch, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './FloatLink.css';

export const getSelectedNode = ( selection: RangeSelection ): TextNode | ElementNode  => {
  const anchor = selection.anchor;
  const anchorNode = selection.anchor.getNode();
  const focus = selection.focus;
  const focusNode = selection.focus.getNode();
  if (anchorNode === focusNode) {
    return anchorNode;
  }
  const isBackward = selection.isBackward();
  if (isBackward) {
    return $isAtNodeEnd(focus) ? anchorNode : focusNode;
  } else {
    return $isAtNodeEnd(anchor) ? anchorNode : focusNode;
  }
}
const VERTICAL_GAP = 10;
const HORIZONTAL_OFFSET = 5;

export const setFloatingElemPositionForLinkEditor = (targetRect: DOMRect | null, floatingElem: HTMLElement, anchorElem: HTMLElement, verticalGap: number = VERTICAL_GAP, horizontalOffset: number = HORIZONTAL_OFFSET): void => {
  
  const scrollerElem = anchorElem.parentElement;

  if (targetRect === null || !scrollerElem) {
    floatingElem.style.opacity = '0';
    floatingElem.style.transform = 'translate(-10000px, -10000px)';
    return;
  }

  const floatingElemRect = floatingElem.getBoundingClientRect();
  const anchorElementRect = anchorElem.getBoundingClientRect();
  const editorScrollerRect = scrollerElem.getBoundingClientRect();

  let top = targetRect.top - verticalGap;
  let left = targetRect.left - horizontalOffset;

  if (top < editorScrollerRect.top) {
    top += floatingElemRect.height + targetRect.height + verticalGap * 2;
  }

  if (left + floatingElemRect.width > editorScrollerRect.right) {
    left = editorScrollerRect.right - floatingElemRect.width - horizontalOffset;
  }

  top -= anchorElementRect.top;
  left -= anchorElementRect.left;

  floatingElem.style.opacity = '1';
  floatingElem.style.transform = `translate(${left}px, ${top}px)`;
}

const SUPPORTED_URL_PROTOCOLS = new Set([
  'http:',
  'https:',
  'mailto:',
  'sms:',
  'tel:',
]);

export const sanitizeUrl = (url: string): string => {
  try {
    const parsedUrl = new URL(url);
    // eslint-disable-next-line no-script-url
    if (!SUPPORTED_URL_PROTOCOLS.has(parsedUrl.protocol)) {
      return 'about:blank';
    }
  } catch {
    return url;
  }
  return url;
}

const preventDefault = ( event: React.KeyboardEvent<HTMLInputElement> | React.MouseEvent<HTMLElement>) : void =>  {
  event.preventDefault();
}

interface IFloatingLinkEditor {
  isLink: boolean;
  editor: LexicalEditor;
  anchorElem: HTMLElement;
  isLinkEditMode: boolean;
  setIsLink: Dispatch<boolean>;
  setIsLinkEditMode: Dispatch<boolean>;
}
const FloatingLinkEditor = ({editor, isLink, setIsLink, anchorElem, isLinkEditMode, setIsLinkEditMode}: IFloatingLinkEditor): JSX.Element => {
  const [editedLinkUrl, setEditedLinkUrl] = useState('https://');
  const [lastSelection, setLastSelection] = useState<BaseSelection | null>( null);
  const [linkUrl, setLinkUrl] = useState('');
  const editorRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const $updateLinkEditor = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      const node = getSelectedNode(selection);
      const linkParent = $findMatchingParent(node, $isLinkNode);

      if (linkParent) {
        setLinkUrl(linkParent.getURL());
      } else if ($isLinkNode(node)) {
        setLinkUrl(node.getURL());
      } else {
        setLinkUrl('');
      }
      if (isLinkEditMode) {
        setEditedLinkUrl(linkUrl);
      }
    }
    const editorElem = editorRef.current;
    const nativeSelection = getDOMSelection(editor._window);
    const activeElement = document.activeElement;

    if (editorElem === null) {
      return;
    }

    const rootElement = editor.getRootElement();

    if (
      selection !== null &&
      nativeSelection !== null &&
      rootElement !== null &&
      rootElement.contains(nativeSelection.anchorNode) &&
      editor.isEditable()
    ) {
      const domRect: DOMRect | undefined =
        nativeSelection.focusNode?.parentElement?.getBoundingClientRect();
      if (domRect) {
        domRect.y += 40;
        setFloatingElemPositionForLinkEditor(domRect, editorElem, anchorElem);
      }
      setLastSelection(selection);
    } else if (!activeElement || activeElement.className !== 'link-input') {
      if (rootElement !== null) {
        setFloatingElemPositionForLinkEditor(null, editorElem, anchorElem);
      }
      setLastSelection(null);
      setIsLinkEditMode(false);
      setLinkUrl('');
    }

    return true;
  }, [anchorElem, editor, setIsLinkEditMode, isLinkEditMode, linkUrl]);

  useEffect(() => {
    const scrollerElem = anchorElem.parentElement;

    const update = () => {
      editor.getEditorState().read(() => {
        $updateLinkEditor();
      });
    };

    window.addEventListener('resize', update);

    if (scrollerElem) {
      scrollerElem.addEventListener('scroll', update);
    }

    return () => {
      window.removeEventListener('resize', update);

      if (scrollerElem) {
        scrollerElem.removeEventListener('scroll', update);
      }
    };
  }, [anchorElem.parentElement, editor, $updateLinkEditor]);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({editorState}) => {
        editorState.read(() => {
          $updateLinkEditor();
        });
      }),

      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          $updateLinkEditor();
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        () => {
          if (isLink) {
            setIsLink(false);
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_HIGH,
      ),
    );
  }, [editor, $updateLinkEditor, setIsLink, isLink]);

  useEffect(() => {
    editor.getEditorState().read(() => {
      $updateLinkEditor();
    });
  }, [editor, $updateLinkEditor]);

  useEffect(() => {
    if (isLinkEditMode && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isLinkEditMode, isLink]);

  const monitorInputInteraction = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === 'Enter') {
      handleLinkSubmission(event);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setIsLinkEditMode(false);
    }
  };

  const handleLinkSubmission = (
    event:
      | React.KeyboardEvent<HTMLInputElement>
      | React.MouseEvent<HTMLElement>,
  ) => {
    event.preventDefault();
    if (lastSelection !== null) {
      if (linkUrl !== '') {
        editor.update(() => {
          editor.dispatchCommand(
            TOGGLE_LINK_COMMAND,
            sanitizeUrl(editedLinkUrl),
          );
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            const parent = getSelectedNode(selection).getParent();
            if ($isAutoLinkNode(parent)) {
              const linkNode = $createLinkNode(parent.getURL(), {
                rel: parent.__rel,
                target: parent.__target,
                title: parent.__title,
              });
              parent.replace(linkNode, true);
            }
          }
        });
      }
      setEditedLinkUrl('https://');
      setIsLinkEditMode(false);
    }
  };

  return (
    <div ref={editorRef} className="link-editor">
      {!isLink ? null : isLinkEditMode ? (
        <>
          <input
            ref={inputRef}
            className="link-input"
            value={editedLinkUrl}
            onChange={(event) => {
              setEditedLinkUrl(event.target.value);
            }}
            onKeyDown={(event) => {
              monitorInputInteraction(event);
            }}
          />
          <div>
            <div
              className="link-cancel"
              role="button"
              tabIndex={0}
              onMouseDown={preventDefault}
              onClick={() => {
                setIsLinkEditMode(false);
              }}
            />

            <div
              className="link-confirm"
              role="button"
              tabIndex={0}
              onMouseDown={preventDefault}
              onClick={handleLinkSubmission}
            />
          </div>
        </>
      ) : (
        <div className="link-view">
          <a
            href={sanitizeUrl(linkUrl)}
            target="_blank"
            rel="noopener noreferrer">
            {linkUrl}
          </a>
          <div
            className="link-edit"
            role="button"
            tabIndex={0}
            onMouseDown={preventDefault}
            onClick={(event) => {
              event.preventDefault();
              setEditedLinkUrl(linkUrl);
              setIsLinkEditMode(true);
            }}
          />
          <div
            className="link-trash"
            role="button"
            tabIndex={0}
            onMouseDown={preventDefault}
            onClick={() => {
              editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
            }}
          />
        </div>
      )}
    </div>
  );
}

const useFloatingLinkEditorToolbar = (
  editor: LexicalEditor,
  anchorElem: HTMLElement | null,
  isLinkEditMode: boolean,
  setIsLinkEditMode: Dispatch<boolean>
): JSX.Element | null => {
  const [activeEditor, setActiveEditor] = useState(editor);
  const [isLink, setIsLink] = useState(false);

  useEffect(() => {
    function $updateToolbar() {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const focusNode = getSelectedNode(selection);
        const focusLinkNode = $findMatchingParent(focusNode, $isLinkNode);
        const focusAutoLinkNode = $findMatchingParent(focusNode, $isAutoLinkNode);
        if (!(focusLinkNode || focusAutoLinkNode)) {
          setIsLink(false);
          return;
        }
        setIsLink(true);
      }
    }

    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          $updateToolbar();
        });
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        (_payload, newEditor) => {
          $updateToolbar();
          setActiveEditor(newEditor);
          return false;
        },
        COMMAND_PRIORITY_CRITICAL
      ),
      editor.registerCommand(
        CLICK_COMMAND,
        (payload) => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            const node = getSelectedNode(selection);
            const linkNode = $findMatchingParent(node, $isLinkNode);
            if ($isLinkNode(linkNode) && (payload.metaKey || payload.ctrlKey)) {
              window.open(linkNode.getURL(), '_blank');
              return true;
            }
          }
          return false;
        },
        COMMAND_PRIORITY_LOW
      )
    );
  }, [editor]);

  if (!anchorElem || !(anchorElem instanceof HTMLElement)) {
    return null; // Prevent rendering if anchorElem is invalid
  }

  return createPortal(
    <FloatingLinkEditor
      isLink={isLink}
      editor={activeEditor}
      setIsLink={setIsLink}
      anchorElem={anchorElem}
      isLinkEditMode={isLinkEditMode}
      setIsLinkEditMode={setIsLinkEditMode}
    />,
    anchorElem
  );
};
interface IFloatingLinkEditorPlugin {
  anchorElem?: HTMLElement | null;
  isLinkEditMode: boolean;
  setIsLinkEditMode: Dispatch<boolean>;
}
export const FloatingLinkEditorPlugin = ({ anchorElem, isLinkEditMode, setIsLinkEditMode}: IFloatingLinkEditorPlugin): JSX.Element | null => {
  const [editor] = useLexicalComposerContext();

  // Ensure anchorElem is a valid DOM element, otherwise fallback to document.body
  const validAnchorElem = anchorElem && anchorElem instanceof HTMLElement ? anchorElem : document.body;

  return useFloatingLinkEditorToolbar(
    editor,
    validAnchorElem,
    isLinkEditMode,
    setIsLinkEditMode
  );
};
