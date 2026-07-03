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
    <Dialog
      open={disabled ? false : isOpen}
      onOpenChange={(_, data) => {
        if (!disabled) setIsOpen(data.open);
      }}>
      <DialogTrigger disableButtonEnhancement>
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
      </DialogTrigger>

      <DialogSurface style={{ maxWidth: 320 }}>
        <DialogBody>
          <DialogTitle>Embed YouTube video</DialogTitle>
          <DialogContent>
            <Stack tokens={{ childrenGap: 8 }}>
              <Field label='URL' size='small'>
                <Input
                  autoFocus={!disabled}
                  disabled={disabled}
                  value={url}
                  appearance='underline'
                  placeholder='Add Youtube video URL'
                  onChange={(_, v) => setURL(v.value)}
                />
              </Field>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button size='small' disabled={disabled || !url} onClick={onHandleEmbeded}>
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
