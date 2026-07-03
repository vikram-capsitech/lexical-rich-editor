import { Stack } from '@fluentui/react';
import {
  Button,
  Dropdown,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  Popover,
  PopoverSurface,
  PopoverTrigger,
} from '@fluentui/react-components';
import { DEFAULT_VALIDATION_MESSAGES } from '../ContentEditorComponent.types';
import type { ValidationMessages } from '../ContentEditorComponent.types';
import { AttachFilled, ImageEditRegular } from '@fluentui/react-icons';
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
  maxImageSizeMB,
  validationMessages,
}: {
  activeEditor: LexicalEditor;
  disabled: boolean;
  maxImageSizeMB?: number;
  validationMessages?: ValidationMessages;
}): JSX.Element => {
  const hasModifier = useRef(false);
  const [src, setSrc] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [altText, setAltText] = useState('');
  const [fileName, setFileName] = useState('');
  const [position, setPosition] = useState<Position>('left');
  const [fileSizeError, setFileSizeError] = useState<string | null>(null);
  const styles = useStyles();

  const iconColor = disabled ? 'var(--colorNeutralForegroundDisabled, #A6A6A6)' : '#333333';

  const isDisabled = disabled || src === '' || !!fileSizeError;

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

    setIsOpen(false);
    setAltText('');
    setSrc('');
    setFileName('');
    setFileSizeError(null);
  };

  return (
    <Popover
      trapFocus
      withArrow
      open={disabled ? false : isOpen}
      onOpenChange={(_, data) => {
        if (!disabled) setIsOpen(data.open);
      }}>
      <PopoverTrigger disableButtonEnhancement>
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
            setIsOpen((prev) => !prev);
            setAltText('');
            setSrc('');
            setFileName('');
          }}
        />
      </PopoverTrigger>

      <PopoverSurface
        style={{
          width: '400px',
          opacity: disabled ? 0.6 : 1,
          pointerEvents: disabled ? 'none' : 'auto',
        }}>
        <Stack tokens={{ childrenGap: 6, padding: '10px 0px 0px 0px' }}>
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
              className={styles.alignDropdown}
              disabled={disabled}
              value={position === 'full' ? 'Full' : position === 'right' ? 'Right' : 'Left'}
              selectedOptions={[position ?? 'left']}
              listbox={{ style: { width: '120px' } }}
              root={{ style: { borderBottom: '1px solid black' } }}
              onOptionSelect={(_, data) => setPosition(data.optionValue as Position)}>
              <Option key='left' value='left'>Left</Option>
              <Option key='right' value='right'>Right</Option>
              <Option key='full' value='full'>Full</Option>
            </Dropdown>
          </Field>

          {fileSizeError && (
            <MessageBar intent='error' style={{ marginTop: 4 }}>
              <MessageBarBody>{fileSizeError}</MessageBarBody>
            </MessageBar>
          )}

          <Field label='Alt Text' orientation='horizontal' size='small'>
            <Input
              placeholder='Alt text'
              appearance='underline'
              disabled={disabled}
              value={altText}
              onChange={(_, d) => setAltText(d.value)}
            />
          </Field>

          <Stack horizontal horizontalAlign='end' tokens={{ childrenGap: 6 }}>
            <Button
              size='small'
              key='file-inline-upload-btn'
              disabled={isDisabled}
              onClick={handleOnClick}>
              Add
            </Button>
            <Button
              size='small'
              key='file-inline-upload-cancel'
              disabled={disabled}
              onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
          </Stack>
        </Stack>
      </PopoverSurface>
    </Popover>
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
          // Apply text alignment to the paragraph so toolbar alignment works
          const parent = imageNode.getParent();
          if (parent && typeof (parent as any).setFormat === 'function') {
            const fmt = payload.position === 'right' ? 'right'
              : payload.position === 'full' ? 'center'
              : 'left';
            (parent as any).setFormat(fmt);
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
  let node = $getImageNodeInSelection();

  if (!node) {
    const target = event.target as HTMLElement | null;
    if (!target) return false;
    const lexicalNode = $getNearestNodeFromDOMNode(target);
    if ($isInlineImageNode(lexicalNode)) node = lexicalNode;
  }

  if (!node) return false;

  const dataTransfer = event.dataTransfer;
  if (!dataTransfer) return false;

  const imgEl = (event.target as HTMLElement)?.closest?.('.inline-editor-image')
    ?.querySelector?.('img') ?? event.target;
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
  const hasDragData = !!event.dataTransfer?.types.includes('application/x-lexical-drag');
  if (!hasDragData) return false;

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

    const { key: _key, ...insertPayload } = data as any;
    editor.dispatchCommand(INSERT_INLINE_IMAGE_COMMAND, insertPayload);
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
    !target.closest('code, span.editor-image, .inline-editor-image') &&
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
    throw Error('Cannot get the selection when dragging');
  }

  return range;
};
