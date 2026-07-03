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
import { CheckmarkRegular, DeleteRegular, DismissRegular, EditRegular } from '@fluentui/react-icons';
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
const VIEWPORT_MARGIN = 8;

/**
 * Mounts a `position: fixed` overlay host inside the closest Fluent
 * Panel/Layer (or document.body) rather than deep inside the editor's own
 * DOM tree. Matches CharacterStylesPopupPlugin's `useFloatingPortalContainer`
 * — without it, a `position: absolute` popup nested inside the editor can
 * get clipped/hidden by a host Panel/Layer's own stacking context or an
 * ancestor's `overflow`, even though it renders with a valid opacity/rect.
 */
function useFloatingPortalContainer(editor: LexicalEditor) {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const root = editor.getRootElement();
    if (!root) return;

    const panelOrLayer =
      (root.closest('.ms-Panel-main') as HTMLElement | null) ||
      (root.closest('.ms-Panel') as HTMLElement | null) ||
      (root.closest('.ms-Layer') as HTMLElement | null) ||
      document.body;

    const host = document.createElement('div');
    host.className = 'lexical-floating-ui-host';
    panelOrLayer.appendChild(host);
    setContainer(host);

    return () => {
      host.remove();
      setContainer(null);
    };
  }, [editor]);

  return container;
}

export const setFloatingElemPositionForLinkEditor = (targetRect: DOMRect | null, floatingElem: HTMLElement, topBoundary: number = VIEWPORT_MARGIN, verticalGap: number = VERTICAL_GAP, horizontalOffset: number = HORIZONTAL_OFFSET): void => {
  if (targetRect === null) {
    floatingElem.style.opacity = '0';
    floatingElem.style.transform = 'translate(-10000px, -10000px)';
    return;
  }

  const floatingElemRect = floatingElem.getBoundingClientRect();

  let top = targetRect.bottom + verticalGap;
  let left = targetRect.left - horizontalOffset;

  if (top + floatingElemRect.height > window.innerHeight - VIEWPORT_MARGIN) {
    top = targetRect.top - floatingElemRect.height - verticalGap;
  }

  if (top < topBoundary) {
    top = topBoundary;
  }

  left = Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - floatingElemRect.width - VIEWPORT_MARGIN));

  floatingElem.style.opacity = '1';
  floatingElem.style.transform = 'none';
  floatingElem.style.top = `${top}px`;
  floatingElem.style.left = `${left}px`;
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
  isLinkEditMode: boolean;
  setIsLink: Dispatch<boolean>;
  setIsLinkEditMode: Dispatch<boolean>;
}
const FloatingLinkEditor = ({editor, isLink, setIsLink, isLinkEditMode, setIsLinkEditMode}: IFloatingLinkEditor): JSX.Element => {
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
      isLink &&
      selection !== null &&
      nativeSelection !== null &&
      rootElement !== null &&
      rootElement.contains(nativeSelection.anchorNode) &&
      editor.isEditable()
    ) {
      const domRect: DOMRect | undefined =
        nativeSelection.focusNode?.parentElement?.getBoundingClientRect();
      if (domRect) {
        const toolbarEl = rootElement
          .closest('.lexical-rich-editor-root')
          ?.querySelector('.editor-toolbar-root') as HTMLElement | null;
        const topBoundary = toolbarEl ? toolbarEl.getBoundingClientRect().bottom + 8 : 8;
        setFloatingElemPositionForLinkEditor(domRect, editorElem, topBoundary);
      }
      setLastSelection(selection);
    } else if (!activeElement || activeElement.className !== 'aoLinkInput') {
      if (rootElement !== null) {
        setFloatingElemPositionForLinkEditor(null, editorElem);
      }
      setLastSelection(null);
      setIsLinkEditMode(false);
      setLinkUrl('');
    }

    return true;
  }, [editor, setIsLinkEditMode, isLinkEditMode, isLink, linkUrl]);

  useEffect(() => {
    const update = () => {
      editor.getEditorState().read(() => {
        $updateLinkEditor();
      });
    };

    const root = editor.getRootElement();

    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    root?.addEventListener('scroll', update, { passive: true });

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      root?.removeEventListener('scroll', update);
    };
  }, [editor, $updateLinkEditor]);

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
    <div ref={editorRef} className="aoLinkEditor">
      {!isLink ? null : isLinkEditMode ? (
        <>
          <input
            ref={inputRef}
            className="aoLinkInput"
            value={editedLinkUrl}
            onChange={(event) => {
              setEditedLinkUrl(event.target.value);
            }}
            onKeyDown={(event) => {
              monitorInputInteraction(event);
            }}
          />
          <div className="aoLinkInputActions">
            <div
              className="aoLinkCancel"
              role="button"
              tabIndex={0}
              title="Cancel"
              aria-label="Cancel"
              onMouseDown={preventDefault}
              onClick={() => {
                setIsLinkEditMode(false);
              }}>
              <DismissRegular fontSize={16} />
            </div>

            <div
              className="aoLinkConfirm"
              role="button"
              tabIndex={0}
              title="Confirm"
              aria-label="Confirm"
              onMouseDown={preventDefault}
              onClick={handleLinkSubmission}>
              <CheckmarkRegular fontSize={16} />
            </div>
          </div>
        </>
      ) : (
        <div className="aoLinkView">
          <a
            href={sanitizeUrl(linkUrl)}
            target="_blank"
            rel="noopener noreferrer">
            {linkUrl}
          </a>
          <div
            className="aoLinkEdit"
            role="button"
            tabIndex={0}
            title="Edit link"
            aria-label="Edit link"
            onMouseDown={preventDefault}
            onClick={(event) => {
              event.preventDefault();
              setEditedLinkUrl(linkUrl);
              setIsLinkEditMode(true);
            }}>
            <EditRegular fontSize={16} />
          </div>
          <div
            className="aoLinkTrash"
            role="button"
            tabIndex={0}
            title="Remove link"
            aria-label="Remove link"
            onMouseDown={preventDefault}
            onClick={() => {
              editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
            }}>
            <DeleteRegular fontSize={16} />
          </div>
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
  const portalContainer = useFloatingPortalContainer(editor);

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

  if (!anchorElem || !(anchorElem instanceof HTMLElement) || !portalContainer) {
    return null; // Prevent rendering if anchorElem or the portal host isn't ready
  }

  return createPortal(
    <FloatingLinkEditor
      isLink={isLink}
      editor={activeEditor}
      setIsLink={setIsLink}
      isLinkEditMode={isLinkEditMode}
      setIsLinkEditMode={setIsLinkEditMode}
    />,
    portalContainer
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
