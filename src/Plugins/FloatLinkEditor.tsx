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
import { Button, Popover, PopoverSurface } from '@fluentui/react-components';
import { CheckmarkRegular, DeleteRegular, DismissRegular, EditRegular } from '@fluentui/react-icons';
import * as React from 'react';
import { Dispatch, useCallback, useEffect, useRef, useState } from 'react';

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

type VirtualTarget = { getBoundingClientRect: () => DOMRect };

interface IFloatingLinkEditor {
  isLink: boolean;
  editor: LexicalEditor;
  isLinkEditMode: boolean;
  setIsLink: Dispatch<boolean>;
  setIsLinkEditMode: Dispatch<boolean>;
}

/**
 * Anchored via Fluent's Popover with a virtual positioning target (the
 * current selection's bounding rect) instead of a hand-rolled
 * `position: fixed` + portal. Popover positions itself with floating-ui
 * (which correctly accounts for transformed/scrolling ancestors) and is
 * styled with Griffel (CSS-in-JS injected at runtime by
 * @fluentui/react-components itself), so it doesn't depend on this
 * package's own CSS file being imported by the consuming app.
 */
const FloatingLinkEditor = ({editor, isLink, setIsLink, isLinkEditMode, setIsLinkEditMode}: IFloatingLinkEditor): JSX.Element => {
  const [editedLinkUrl, setEditedLinkUrl] = useState('https://');
  const [lastSelection, setLastSelection] = useState<BaseSelection | null>( null);
  const [linkUrl, setLinkUrl] = useState('');
  const [target, setTarget] = useState<VirtualTarget | null>(null);
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

    const nativeSelection = getDOMSelection(editor._window);
    const activeElement = document.activeElement;
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
        setTarget({ getBoundingClientRect: () => domRect });
      }
      setLastSelection(selection);
    } else if (!(activeElement instanceof HTMLInputElement) || activeElement !== inputRef.current) {
      setTarget(null);
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
    <Popover
      open={isLink && !!target}
      onOpenChange={(_, data) => {
        if (!data.open) setIsLink(false);
      }}
      positioning={{ target: target ?? undefined, position: 'below', align: 'start' }}
      unstable_disableAutoFocus
    >
      <PopoverSurface style={{ display: 'flex', alignItems: 'center', gap: 6, padding: 8, maxWidth: 360 }}>
        {isLinkEditMode ? (
          <>
            <input
              ref={inputRef}
              value={editedLinkUrl}
              style={{
                flex: 1,
                minWidth: 180,
                border: 'none',
                outline: 'none',
                background: '#f1f1f1',
                borderRadius: 15,
                padding: '8px 12px',
                fontSize: 14,
              }}
              onChange={(event) => {
                setEditedLinkUrl(event.target.value);
              }}
              onKeyDown={(event) => {
                monitorInputInteraction(event);
              }}
            />
            <Button
              appearance="subtle"
              size="small"
              icon={<DismissRegular fontSize={16} />}
              title="Cancel"
              aria-label="Cancel"
              onMouseDown={preventDefault}
              onClick={() => {
                setIsLinkEditMode(false);
              }}
            />
            <Button
              appearance="primary"
              size="small"
              icon={<CheckmarkRegular fontSize={16} />}
              title="Confirm"
              aria-label="Confirm"
              onMouseDown={preventDefault}
              onClick={handleLinkSubmission}
            />
          </>
        ) : (
          <>
            <a
              href={sanitizeUrl(linkUrl)}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '0 8px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 260,
              }}>
              {linkUrl}
            </a>
            <Button
              appearance="subtle"
              size="small"
              icon={<EditRegular fontSize={16} />}
              title="Edit link"
              aria-label="Edit link"
              onMouseDown={preventDefault}
              onClick={(event) => {
                event.preventDefault();
                setEditedLinkUrl(linkUrl);
                setIsLinkEditMode(true);
              }}
            />
            <Button
              appearance="subtle"
              size="small"
              icon={<DeleteRegular fontSize={16} />}
              title="Remove link"
              aria-label="Remove link"
              onMouseDown={preventDefault}
              onClick={() => {
                editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
              }}
            />
          </>
        )}
      </PopoverSurface>
    </Popover>
  );
}

const useFloatingLinkEditorToolbar = (
  editor: LexicalEditor,
  isLinkEditMode: boolean,
  setIsLinkEditMode: Dispatch<boolean>
): JSX.Element => {
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

  return (
    <FloatingLinkEditor
      isLink={isLink}
      editor={activeEditor}
      setIsLink={setIsLink}
      isLinkEditMode={isLinkEditMode}
      setIsLinkEditMode={setIsLinkEditMode}
    />
  );
};
interface IFloatingLinkEditorPlugin {
  anchorElem?: HTMLElement | null;
  isLinkEditMode: boolean;
  setIsLinkEditMode: Dispatch<boolean>;
}
export const FloatingLinkEditorPlugin = ({ isLinkEditMode, setIsLinkEditMode}: IFloatingLinkEditorPlugin): JSX.Element | null => {
  const [editor] = useLexicalComposerContext();

  return useFloatingLinkEditorToolbar(
    editor,
    isLinkEditMode,
    setIsLinkEditMode
  );
};
