import { Stack } from '@fluentui/react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  SelectTabData,
  SelectTabEvent,
} from '@fluentui/react-components';
import { DEFAULT_VALIDATION_MESSAGES } from '../ContentEditorComponent.types';
import type { ValidationMessages } from '../ContentEditorComponent.types';
import { AttachFilled, ImageAddRegular } from '@fluentui/react-icons';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $wrapNodeInElement, mergeRegister } from '@lexical/utils';
import {
  $createParagraphNode,
  $createRangeSelection,
  $getNearestNodeFromDOMNode,
  $getNodeByKey,
  $getSelection,
  $insertNodes,
  $isNodeSelection,
  $isRangeSelection,
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
  PASTE_COMMAND,
} from 'lexical';
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { $createImageNode, $isImageNode, ImageNode, ImagePayload } from '../Nodes/ImageNode';

export type InsertImagePayload = Readonly<ImagePayload>;

export const INSERT_IMAGE_COMMAND: LexicalCommand<InsertImagePayload> =
  createCommand('INSERT_IMAGE_COMMAND');

const readClipboardImageAsDataURL = async (event: ClipboardEvent): Promise<string | null> => {
  const items = event.clipboardData?.items;
  if (!items) return null;

  for (const item of Array.from(items)) {
    if (item.type?.startsWith('image/')) {
      const file = item.getAsFile();
      if (!file) continue;

      return await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.readAsDataURL(file);
      });
    }
  }

  return null;
};

const InsertImageByURL = ({
  setIsOpen,
  onClick,
  disabled,
}: {
  setIsOpen: (e: boolean) => void;
  onClick: (payload: InsertImagePayload) => void;
  disabled: boolean;
}) => {
  const [altText, setAltText] = useState('');
  const [src, setSrc] = useState('');
  const isDisabled = disabled || src === '';

  return (
    <Stack tokens={{ childrenGap: 6, padding: '10px 0px 0px 0px' }}>
      <Field label='Enter URL' size='small'>
        <Input
          autoFocus={!disabled}
          appearance='underline'
          placeholder='Add URL'
          disabled={disabled}
          onChange={(_, v) => setSrc(v.value)}
          value={src}
        />
      </Field>

      <Field label='Alt Text' size='small'>
        <Input
          placeholder='Alt text'
          key='alt-text-url'
          disabled={disabled}
          onChange={(_, v) => setAltText(v.value)}
          value={altText}
        />
      </Field>

      <Stack horizontal horizontalAlign='end' tokens={{ childrenGap: 6 }}>
        <Button
          key='url-confirm-btn'
          style={{ width: '150px' }}
          onClick={() => !disabled && onClick({ altText, src })}
          disabled={isDisabled}
          size='small'>
          Confirm
        </Button>
        <Button
          key='file-url-cancel'
          style={{ width: '150px' }}
          onClick={() => setIsOpen(false)}
          disabled={disabled}
          size='small'>
          Cancel
        </Button>
      </Stack>
    </Stack>
  );
};

type TabValue = 'Upload' | 'URL';

export const InsertImageDialog = ({
  activeEditor,
  disabled,
  maxImageSizeMB,
  validationMessages,
}: {
  activeEditor: LexicalEditor;
  disabled: boolean;
  maxImageSizeMB?: number;
  validationMessages?: ValidationMessages;
}) => {
  const [src, setSrc] = useState('');
  const [altText, setAltText] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState<TabValue>('Upload');
  const [fileName, setFileName] = useState('');
  const [fileSizeError, setFileSizeError] = useState<string | null>(null);
  const hasModifier = useRef(false);

  const iconColor = disabled ? 'var(--colorNeutralForegroundDisabled, #A6A6A6)' : '#333333';
  const isDisabled = disabled || src === '' || !!fileSizeError;

  const onTabSelect = (_event: SelectTabEvent, data: SelectTabData) => {
    setSelectedValue(data.value as TabValue);
  };

  useEffect(() => {
    hasModifier.current = false;
    const handler = (e: KeyboardEvent) => {
      hasModifier.current = e.altKey;
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [activeEditor]);

  const onClick = (payload: InsertImagePayload) => {
    if (disabled) return;

    activeEditor.dispatchCommand(INSERT_IMAGE_COMMAND, payload);
    setIsOpen(false);
    setAltText('');
    setSrc('');
    setFileName('');
    setFileSizeError(null);
  };

  const loadImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;

    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    if (maxImageSizeMB !== undefined) {
      const fileMB = file.size / (1024 * 1024);
      if (fileMB > maxImageSizeMB) {
        const override = validationMessages?.imageTooLarge;
        const msg = override !== undefined
          ? (typeof override === 'function' ? override(fileMB, maxImageSizeMB) : override)
          : DEFAULT_VALIDATION_MESSAGES.imageTooLarge(fileMB, maxImageSizeMB);
        setFileSizeError(msg);
        setSrc('');
        setFileName('');
        event.target.value = '';
        return;
      }
    }

    setFileSizeError(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setSrc(reader.result);
        setFileName(file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <Dialog
      open={disabled ? false : isOpen}
      onOpenChange={(_, data) => {
        if (!disabled) setIsOpen(data.open);
      }}>
      <DialogTrigger disableButtonEnhancement>
        <Button
          size='small'
          title='Add Image'
          key='upload-image'
          disabled={disabled}
          icon={<ImageAddRegular style={{ color: iconColor }} />}
          style={{
            background: isOpen && !disabled ? '#ebebeb' : 'none',
            border: 'none',
            margin: 2,
            opacity: disabled ? 0.55 : 1,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
          onClick={() => {
            if (disabled) return;
            setIsOpen((prev) => !prev);
            setSrc('');
            setAltText('');
            setFileName('');
          }}
        />
      </DialogTrigger>

      <DialogSurface style={{ maxWidth: 340 }}>
        <DialogBody>
          <DialogTitle>Insert image</DialogTitle>
          <DialogContent>
            <Stack tokens={{ childrenGap: 8 }}>
              <Field label='Upload' size='small'>
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

              {fileSizeError && (
                <MessageBar intent='error' style={{ marginTop: 4 }}>
                  <MessageBarBody>{fileSizeError}</MessageBarBody>
                </MessageBar>
              )}

              <Field label='Alt Text' size='small'>
                <Input
                  placeholder='Alt text'
                  appearance='underline'
                  disabled={disabled}
                  onChange={(_, d) => setAltText(d.value)}
                  value={altText}
                />
              </Field>

              {selectedValue === 'URL' && (
                <InsertImageByURL
                  disabled={disabled}
                  setIsOpen={(open) => setIsOpen(open)}
                  onClick={(payload) => onClick(payload)}
                />
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button size='small' disabled={isDisabled} onClick={() => onClick({ altText, src })}>
              Add
            </Button>
            <Button size='small' disabled={disabled} onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};

const ImagesPlugin = ({ captionsEnabled }: { captionsEnabled?: boolean }) => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!editor.hasNodes([ImageNode])) {
      throw new Error('ImagesPlugin: ImageNode not registered on editor');
    }

    return mergeRegister(
      editor.registerCommand<InsertImagePayload>(
        INSERT_IMAGE_COMMAND,
        (payload) => {
          const imageNode = $createImageNode(payload);
          const selection = $getSelection();

          if ($isRangeSelection(selection)) {
            // Always insert block images in their own paragraph so they never
            // appear inline with existing text content.
            const anchorNode = selection.anchor.getNode();
            const topLevel = anchorNode.getTopLevelElementOrThrow();

            const imageParagraph = $createParagraphNode();
            imageParagraph.append(imageNode);
            topLevel.insertAfter(imageParagraph);

            // Leave an empty paragraph after the image for continued typing.
            const tail = $createParagraphNode();
            imageParagraph.insertAfter(tail);
            tail.select();
          } else {
            $insertNodes([imageNode]);
            if ($isRootOrShadowRoot(imageNode.getParentOrThrow())) {
              $wrapNodeInElement(imageNode, $createParagraphNode).selectEnd();
            }
          }
          return true;
        },
        COMMAND_PRIORITY_EDITOR
      ),

      editor.registerCommand<ClipboardEvent>(
        PASTE_COMMAND,
        (event) => {
          if (!event.clipboardData) return false;

          const hasImage = Array.from(event.clipboardData.items).some((i) =>
            i.type?.startsWith('image/')
          );
          if (!hasImage) return false;

          event.preventDefault();

          (async () => {
            const src = await readClipboardImageAsDataURL(event);
            if (!src) return;

            editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
              src,
              altText: 'Screenshot',
            });
          })();

          return true;
        },
        COMMAND_PRIORITY_HIGH
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
  }, [captionsEnabled, editor]);

  return null;
};

export default ImagesPlugin;

const TRANSPARENT_IMAGE =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const img = document.createElement('img');
img.src = TRANSPARENT_IMAGE;

const $onDragStart = (event: DragEvent): boolean => {
  // Find the image node — first from selection, then from the drag target element.
  let node = $getImageNodeInSelection();

  if (!node) {
    const target = event.target as HTMLElement | null;
    if (!target) return false;
    const lexicalNode = $getNearestNodeFromDOMNode(target);
    if ($isImageNode(lexicalNode)) {
      node = lexicalNode;
    }
  }

  if (!node) return false;

  const dataTransfer = event.dataTransfer;
  if (!dataTransfer) return false;

  // Use the actual image element as the drag ghost so the user sees what they're moving.
  const imgEl = (event.target as HTMLElement)?.closest?.('span.editor-image')
    ?.querySelector?.('img') ?? (event.target as HTMLElement);
  if (imgEl instanceof HTMLElement) {
    dataTransfer.setDragImage(imgEl, 20, 20);
  } else {
    dataTransfer.setDragImage(img, 0, 0);
  }

  dataTransfer.setData('text/plain', '_');
  dataTransfer.setData(
    'application/x-lexical-drag',
    JSON.stringify({
      data: {
        altText: node.__altText,
        caption: node.__caption,
        height: node.__height,
        key: node.getKey(),
        maxWidth: node.__maxWidth,
        showCaption: node.__showCaption,
        src: node.__src,
        width: node.__width,
      },
      type: 'image',
    })
  );

  return true;
};

const $onDragover = (event: DragEvent): boolean => {
  const node = $getImageNodeInSelection();
  if (!node) return false;

  if (!canDropImage(event)) {
    event.preventDefault();
  }
  return true;
};

const $onDrop = (event: DragEvent, editor: LexicalEditor): boolean => {
  const data = getDragImageData(event);
  if (!data) return false;

  event.preventDefault();

  if (canDropImage(event)) {
    // Remove the source node using its key stored in drag data.
    const sourceKey = (data as any).key as string | undefined;
    if (sourceKey) {
      const sourceNode = $getNodeByKey(sourceKey);
      if (sourceNode) sourceNode.remove();
    }

    const range = getDragSelection(event);
    const rangeSelection = $createRangeSelection();
    if (range !== null && range !== undefined) {
      rangeSelection.applyDOMRange(range);
    }
    $setSelection(rangeSelection);

    // Insert without the old key so a fresh node is created.
    const { key: _key, ...insertPayload } = data as any;
    editor.dispatchCommand(INSERT_IMAGE_COMMAND, insertPayload);
  }

  return true;
};

const $getImageNodeInSelection = (): ImageNode | null => {
  const selection = $getSelection();
  if (!$isNodeSelection(selection)) return null;

  const nodes = selection.getNodes();
  const node = nodes[0];
  return $isImageNode(node) ? node : null;
};

const getDragImageData = (event: DragEvent): null | InsertImagePayload => {
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
    target.closest('[contenteditable="true"]')
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
    throw Error(`Cannot get the selection when dragging`);
  }

  return range;
};
