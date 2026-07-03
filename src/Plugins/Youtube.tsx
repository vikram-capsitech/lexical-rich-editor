import { Stack } from '@fluentui/react';
import { Button, Field, Input } from '@fluentui/react-components';
import { VideoClipRegular } from '@fluentui/react-icons';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $insertNodes } from 'lexical';
import { useState } from 'react';
import { $createYouTubeNode } from '../Nodes/YoutubeNode';
import { AoModal } from './AoModal';

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
    <>
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

      <AoModal
        isOpen={disabled ? false : isOpen}
        onDismiss={() => !disabled && setIsOpen(false)}
        title='Embed YouTube video'
        maxWidth={320}
        actions={
          <>
            <Button size='small' disabled={disabled || !url} onClick={onHandleEmbeded}>
              Add
            </Button>
            <Button size='small' disabled={disabled} onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
          </>
        }>
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
      </AoModal>
    </>
  );
};
