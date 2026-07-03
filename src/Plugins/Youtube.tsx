import { Stack } from '@fluentui/react';
import {
  Button,
  Field,
  Input,
  Popover,
  PopoverSurface,
  PopoverTrigger,
} from '@fluentui/react-components';
import { VideoClipRegular } from '@fluentui/react-icons';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $insertNodes } from 'lexical';
import { useState } from 'react';
import { $createYouTubeNode } from '../Nodes/YoutubeNode';

export const YoutubeUploadPlugin = ({ disabled }: { disabled: boolean }) => {
  const [url, setURL] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [editor] = useLexicalComposerContext();

  const iconColor = disabled ? 'var(--colorNeutralForegroundDisabled, #A6A6A6)' : '#424242';

  const onHandleEmbeded = () => {
    if (disabled) return;
    if (!url) return;

    const match = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/.exec(url);

    const id = match && match[2]?.length === 11 ? match[2] : null;
    if (!id) return;

    editor.update(() => {
      const node = $createYouTubeNode(id);
      $insertNodes([node]);
    });

    setURL('');
    setIsOpen(false);
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
          key='upload-video'
          title='Add youtube URL'
          size='small'
          disabled={disabled}
          icon={<VideoClipRegular style={{ color: iconColor }} />}
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
            setURL('');
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
          <Field label='URL' orientation='horizontal' size='small'>
            <Input
              autoFocus={!disabled}
              disabled={disabled}
              value={url}
              appearance='underline'
              placeholder='Add Youtube video URL'
              onChange={(_, v) => setURL(v.value)}
            />
          </Field>

          <Stack horizontal horizontalAlign='end' tokens={{ childrenGap: 6 }}>
            <Button size='small' disabled={disabled || !url} onClick={onHandleEmbeded}>
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
