import { Stack } from '@fluentui/react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  Input,
  makeStyles,
  Option,
} from '@fluentui/react-components';
import { AttachFilled, ImageEditRegular } from '@fluentui/react-icons';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $wrapNodeInElement, mergeRegister } from '@lexical/utils';
import {
  $createParagraphNode,
  $createRangeSelection,
  $getSelection,
  $insertNodes,
  $isNodeSelection,
  $isRootOrShadowRoot,
  $setSelection,
  COMMAND_PRIORITY_EDITOR,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  createCommand,
  DRAGOVER_COMMAND,
  DRAGSTART_COMMAND,
  DROP_COMMAND,
  getDOMSelectionFromTarget,
  isHTMLElement,
  LexicalCommand,
  LexicalEditor,
} from 'lexical';
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import '../Nodes/InlineImage.css';
import {
  $createInlineImageNode,
  $isInlineImageNode,
  InlineImageNode,
  InlineImagePayload,
  Position,
} from '../Nodes/InlineImageNode';

export type InsertInlineImagePayload = Readonly<InlineImagePayload>;

export const INSERT_INLINE_IMAGE_COMMAND: LexicalCommand<InlineImagePayload> = createCommand(
  'INSERT_INLINE_IMAGE_COMMAND'
);

const useStyles = makeStyles({
  alignDropdown: {
    minInlineSize: '90px',
    border: 'none',
    backgroundColor: 'transparent',
    ':hover': {
      backgroundColor: '#eee',
    },
  },
});

export const InsertInlineImageDialog = ({
  disabled,
  activeEditor,
  open: externalOpen,
  onClose,
}: {
  activeEditor: LexicalEditor;
  disabled: boolean;
  open?: boolean;
  onClose?: () => void;
}): JSX.Element => {
  const hasModifier = useRef(false);
  const [src, setSrc] = useState('');
  const [internalOpen, setInternalOpen] = useState(false);
  const [altText, setAltText] = useState('');
  const [fileName, setFileName] = useState('');
  const [position, setPosition] = useState<Position>('left');
  const styles = useStyles();

  const iconColor = disabled ? 'var(--colorNeutralForegroundDisabled, #A6A6A6)' : '#333333';

  const isControlled = externalOpen !== undefined;
  const isOpen = isControlled ? (!!externalOpen && !disabled) : (internalOpen && !disabled);
  const isAddDisabled = disabled || src === '';

  const handleClose = () => {
    setSrc('');
    setAltText('');
    setFileName('');
    if (isControlled) onClose?.();
    else setInternalOpen(false);
  };

  const loadImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;

    const files = event.target.files;
    if (!files || files.length === 0) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setSrc(reader.result);
        setFileName(files[0].name);
      }
    };
    reader.readAsDataURL(files[0]);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      hasModifier.current = e.altKey;
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [activeEditor]);

  const handleOnClick = () => {
    if (disabled) return;

    const payload = { altText, position, src };
    activeEditor.dispatchCommand(INSERT_INLINE_IMAGE_COMMAND, payload);

    handleClose();
  };

  return (
    <>
      {!isControlled && (
        <Button
          size='small'
          key='upload-inline-image'
          title='Add Inline Image'
          disabled={disabled}
          icon={<ImageEditRegular style={{ color: iconColor }} />}
          style={{
            background: isOpen && !disabled ? '#ebebeb' : 'none',
            border: 'none',
            margin: 2,
            opacity: disabled ? 0.55 : 1,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
          onClick={() => {
            if (disabled) return;
            setSrc('');
            setAltText('');
            setFileName('');
            setInternalOpen(true);
          }}
        />
      )}

      <Dialog
        open={isOpen}
        onOpenChange={(_, data) => {
          if (!data.open) handleClose();
        }}>
        <DialogSurface style={{ maxWidth: '440px' }}>
          <DialogBody>
            <DialogTitle>Insert Inline Image</DialogTitle>
            <DialogContent>
              <Stack tokens={{ childrenGap: 10 }} style={{ paddingTop: 8 }}>
                <Field label='Upload' orientation='horizontal' size='small'>
                  <label
                    style={{
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      opacity: disabled ? 0.75 : 1,
                    }}>
                    <input
                      type='file'
                      accept='image/*'
                      key='inline-image-upload'
                      style={{ display: 'none' }}
                      disabled={disabled}
                      onChange={loadImage}
                    />

                    <Stack horizontal>
                      <AttachFilled
                        style={{
                          fontSize: '16px',
                          color: disabled ? 'var(--colorNeutralForegroundDisabled, #A6A6A6)' : '#808080',
                          marginTop: 2,
                        }}
                      />
                      {!fileName && <span style={{ fontSize: 12, color: '#808080' }}>Upload File</span>}
                    </Stack>

                    {fileName && <span style={{ fontSize: 12, color: '#808080' }}>{fileName}</span>}
                  </label>
                </Field>

                <Field label='Position' orientation='horizontal' size='small'>
                  <Dropdown
                    placeholder='Left Align'
                    className={styles.alignDropdown}
                    disabled={disabled}
                    listbox={{ style: { width: '120px' } }}
                    root={{ style: { borderBottom: '1px solid black' } }}>
                    <Option key='full' text='full' onClick={() => setPosition('full')}>
                      Full
                    </Option>
                    <Option key='left' text='left' onClick={() => setPosition('left')}>
                      Left
                    </Option>
                    <Option key='right' text='right' onClick={() => setPosition('right')}>
                      Right
                    </Option>
                  </Dropdown>
                </Field>

                <Field label='Alt Text' orientation='horizontal' size='small'>
                  <Input
                    placeholder='Alt text'
                    appearance='underline'
                    disabled={disabled}
                    value={altText}
                    onChange={(_, d) => setAltText(d.value)}
                  />
                </Field>
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button
                appearance='primary'
                size='small'
                key='file-inline-upload-btn'
                disabled={isAddDisabled}
                onClick={handleOnClick}>
                Add
              </Button>
              <Button
                size='small'
                key='file-inline-upload-cancel'
                disabled={disabled}
                onClick={handleClose}>
                Cancel
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  );
};

export const InlineImagePlugin = () => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!editor.hasNodes([InlineImageNode])) {
      throw new Error('ImagesPlugin: ImageNode not registered on editor');
    }

    return mergeRegister(
      editor.registerCommand<InsertInlineImagePayload>(
        INSERT_INLINE_IMAGE_COMMAND,
        (payload) => {
          const imageNode = $createInlineImageNode(payload);
          $insertNodes([imageNode]);
          if ($isRootOrShadowRoot(imageNode.getParentOrThrow())) {
            $wrapNodeInElement(imageNode, $createParagraphNode).selectEnd();
          }
          return true;
        },
        COMMAND_PRIORITY_EDITOR
      ),
      editor.registerCommand<DragEvent>(
        DRAGSTART_COMMAND,
        (event) => $onDragStart(event),
        COMMAND_PRIORITY_HIGH
      ),
      editor.registerCommand<DragEvent>(
        DRAGOVER_COMMAND,
        (event) => $onDragover(event),
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand<DragEvent>(
        DROP_COMMAND,
        (event) => $onDrop(event, editor),
        COMMAND_PRIORITY_HIGH
      )
    );
  }, [editor]);

  return null;
};

export default InlineImagePlugin;

/* =================== drag/drop helpers unchanged =================== */

const TRANSPARENT_IMAGE =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const img = document.createElement('img');
img.src = TRANSPARENT_IMAGE;

function $onDragStart(event: DragEvent): boolean {
  const node = $getImageNodeInSelection();
  if (!node) return false;

  const dataTransfer = event.dataTransfer;
  if (!dataTransfer) return false;

  dataTransfer.setData('text/plain', '_');
  dataTransfer.setDragImage(img, 0, 0);
  dataTransfer.setData(
    'application/x-lexical-drag',
    JSON.stringify({
      data: {
        altText: node.__altText,
        caption: node.__caption,
        height: node.__height,
        key: node.getKey(),
        showCaption: node.__showCaption,
        src: node.__src,
        width: node.__width,
      },
      type: 'image',
    })
  );

  return true;
}

const $onDragover = (event: DragEvent): boolean => {
  const node = $getImageNodeInSelection();
  if (!node) return false;

  if (!canDropImage(event)) {
    event.preventDefault();
  }
  return true;
};

const $onDrop = (event: DragEvent, editor: LexicalEditor): boolean => {
  const node = $getImageNodeInSelection();
  if (!node) return false;

  const data = getDragImageData(event);
  if (!data) return false;

  event.preventDefault();

  if (canDropImage(event)) {
    const range = getDragSelection(event);
    node.remove();

    const rangeSelection = $createRangeSelection();
    if (range !== null && range !== undefined) {
      rangeSelection.applyDOMRange(range);
    }
    $setSelection(rangeSelection);
    editor.dispatchCommand(INSERT_INLINE_IMAGE_COMMAND, data);
  }
  return true;
};

const $getImageNodeInSelection = (): InlineImageNode | null => {
  const selection = $getSelection();
  if (!$isNodeSelection(selection)) return null;

  const nodes = selection.getNodes();
  const node = nodes[0];
  return $isInlineImageNode(node) ? node : null;
};

const getDragImageData = (event: DragEvent): null | InsertInlineImagePayload => {
  const dragData = event.dataTransfer?.getData('application/x-lexical-drag');
  if (!dragData) return null;

  const { type, data } = JSON.parse(dragData);
  if (type !== 'image') return null;

  return data;
};

declare global {
  interface DragEvent {
    rangeOffset?: number;
    rangeParent?: Node;
  }
}

const canDropImage = (event: DragEvent): boolean => {
  const target = event.target;
  return !!(
    isHTMLElement(target) &&
    !target.closest('code, span.editor-image') &&
    isHTMLElement(target.parentElement) &&
    target.parentElement.closest('div.ContentEditable__root')
  );
};

const getDragSelection = (event: DragEvent): Range | null | undefined => {
  let range;
  const domSelection = getDOMSelectionFromTarget(event.target);

  if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(event.clientX, event.clientY);
  } else if ((event as any).rangeParent && domSelection !== null) {
    domSelection.collapse((event as any).rangeParent, (event as any).rangeOffset || 0);
    range = domSelection.getRangeAt(0);
  } else {
    throw Error('Cannot get the selection when dragging');
  }

  return range;
};
