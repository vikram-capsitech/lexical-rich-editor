import { Stack } from '@fluentui/react';
import {
  Button,
  Field,
  Input,
  Popover,
  PopoverSurface,
  PopoverTrigger,
} from '@fluentui/react-components';
import { LinkAddRegular } from '@fluentui/react-icons';
import { $createLinkNode } from '@lexical/link';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $isRangeSelection, TextNode } from 'lexical';
import { useState } from 'react';

export const InsertLinkPlugin = ({ disabled }: { disabled: boolean }) => {
  const [editor] = useLexicalComposerContext();
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState('');
  const [link, setLink] = useState('');

  const iconColor = disabled ? 'var(--colorNeutralForegroundDisabled, #A6A6A6)' : '#333333';

  const insertLink = (text: string, link: string) => {
    if (disabled) return;

    editor.update(() => {
      setText('');
      setLink('');

      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const textNode = new TextNode(text);
        const linkNode = $createLinkNode(link.startsWith('http') ? link : `https://${link}`);
        linkNode.append(textNode);
        selection.insertNodes([linkNode]);
      }

      setIsOpen(false);
    });
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
            if (!disabled) setIsOpen((prev) => !prev);
          }}
        />
      </PopoverTrigger>

      <PopoverSurface
        style={{
          width: '270px',
          opacity: disabled ? 0.6 : 1,
          pointerEvents: disabled ? 'none' : 'auto',
        }}>
        <Stack tokens={{ childrenGap: 10 }}>
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

          <Field label='Link' orientation='horizontal' size='small'>
            <Input
              value={link}
              appearance='underline'
              placeholder='Link'
              disabled={disabled}
              onChange={(_, v) => setLink(v.value)}
            />
          </Field>

          <Stack horizontal horizontalAlign='end' tokens={{ childrenGap: 6 }}>
            <Button
              size='small'
              disabled={disabled || !text || !link}
              onClick={() => insertLink(text, link)}>
              Add
            </Button>
            <Button size='small' disabled={disabled} onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
          </Stack>
        </Stack>
      </PopoverSurface>
    </Popover>
  );
};
