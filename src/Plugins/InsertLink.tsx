import { Stack } from '@fluentui/react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
} from '@fluentui/react-components';
import { LinkAddRegular } from '@fluentui/react-icons';
import { $createLinkNode } from '@lexical/link';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $isRangeSelection, TextNode } from 'lexical';
import { useState } from 'react';

/** Schemes/paths that must be inserted verbatim, never auto-prefixed with `https://`. */
const VERBATIM_LINK_RE = /^https?:\/\/|^mailto:|^tel:|^#|^\//i;

/** Returns an inline validation message if the URL looks structurally invalid, otherwise undefined. */
function getLinkValidationMessage(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (/\s/.test(trimmed)) return 'URL cannot contain spaces';
  if (!VERBATIM_LINK_RE.test(trimmed) && !trimmed.includes('.')) {
    return 'Enter a valid URL (e.g. example.com)';
  }
  return undefined;
}

export const InsertLinkPlugin = ({
  disabled,
  open: externalOpen,
  onClose,
}: {
  disabled: boolean;
  open?: boolean;
  onClose?: () => void;
}) => {
  const [editor] = useLexicalComposerContext();
  const [internalOpen, setInternalOpen] = useState(false);
  const [text, setText] = useState('');
  const [link, setLink] = useState('');

  const iconColor = disabled ? 'var(--colorNeutralForegroundDisabled, #A6A6A6)' : '#333333';

  const isControlled = externalOpen !== undefined;
  const isOpen = isControlled ? (!!externalOpen && !disabled) : (internalOpen && !disabled);
  const linkError = getLinkValidationMessage(link);

  const handleClose = () => {
    setText('');
    setLink('');
    if (isControlled) onClose?.();
    else setInternalOpen(false);
  };

  const insertLink = (text: string, link: string) => {
    if (disabled) return;
    if (getLinkValidationMessage(link)) return;

    const trimmedLink = link.trim();
    const href = VERBATIM_LINK_RE.test(trimmedLink) ? trimmedLink : `https://${trimmedLink}`;

    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const textNode = new TextNode(text);
        const linkNode = $createLinkNode(href);
        linkNode.append(textNode);
        selection.insertNodes([linkNode]);
      }
    });

    handleClose();
  };

  return (
    <>
      {!isControlled && (
        <Button
          size='small'
          title='Add link'
          key='upload-link'
          disabled={disabled}
          icon={<LinkAddRegular style={{ color: iconColor }} />}
          style={{
            background: isOpen && !disabled ? '#ebebeb' : 'none',
            border: 'none',
            margin: 2,
            opacity: disabled ? 0.55 : 1,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
          onClick={() => {
            if (disabled) return;
            setInternalOpen((prev) => !prev);
          }}
        />
      )}

      <Dialog
        open={isOpen}
        onOpenChange={(_, data) => {
          if (!data.open) handleClose();
        }}>
        <DialogSurface style={{ maxWidth: '380px' }}>
          <DialogBody>
            <DialogTitle>Insert Link</DialogTitle>
            <DialogContent>
              <Stack tokens={{ childrenGap: 10 }} style={{ paddingTop: 8 }}>
                <Field label='Text' orientation='horizontal' size='small'>
                  <Input
                    autoFocus={!disabled}
                    value={text}
                    appearance='underline'
                    placeholder='Text'
                    disabled={disabled}
                    onChange={(_, v) => setText(v.value)}
                  />
                </Field>

                <Field
                  label='Link'
                  orientation='horizontal'
                  size='small'
                  validationState={linkError ? 'error' : 'none'}
                  validationMessage={linkError}>
                  <Input
                    value={link}
                    appearance='underline'
                    placeholder='Link'
                    disabled={disabled}
                    onChange={(_, v) => setLink(v.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && text && link && !linkError) insertLink(text, link);
                    }}
                  />
                </Field>
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button
                appearance='primary'
                size='small'
                disabled={disabled || !text || !link || !!linkError}
                onClick={() => insertLink(text, link)}>
                Add
              </Button>
              <Button size='small' disabled={disabled} onClick={handleClose}>
                Cancel
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  );
};
