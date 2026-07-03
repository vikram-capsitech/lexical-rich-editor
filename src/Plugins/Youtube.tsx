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
import { VideoClipRegular } from '@fluentui/react-icons';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $insertNodes } from 'lexical';
import { useState } from 'react';
import { $createYouTubeNode } from '../Nodes/YoutubeNode';

/**
 * Extract an 11-character YouTube video ID from any common URL format.
 *
 * Supported formats:
 *  - https://www.youtube.com/watch?v=VIDEO_ID
 *  - https://www.youtube.com/watch?v=VIDEO_ID&list=PLAYLIST
 *  - https://youtu.be/VIDEO_ID
 *  - https://youtu.be/VIDEO_ID?si=TRACKING
 *  - https://www.youtube.com/embed/VIDEO_ID
 *  - https://www.youtube.com/v/VIDEO_ID
 *  - https://www.youtube.com/shorts/VIDEO_ID       ← NEW
 *  - https://www.youtube.com/live/VIDEO_ID         ← NEW
 *  - VIDEO_ID  (bare 11-character alphanumeric ID) ← NEW
 */
function extractYouTubeId(url: string): string | null {
  const trimmed = url.trim();

  // Bare 11-character video ID (only alphanumeric + _ -)
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;

  // Full URL patterns
  const match = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/|live\/|u\/\w\/))([^#&?]{11})/.exec(trimmed);
  return match ? match[1] : null;
}

export const YoutubeUploadPlugin = ({
  disabled,
  open: externalOpen,
  onClose,
}: {
  disabled: boolean;
  open?: boolean;
  onClose?: () => void;
}) => {
  const [url, setURL] = useState('');
  const [urlError, setUrlError] = useState('');
  const [internalOpen, setInternalOpen] = useState(false);
  const [editor] = useLexicalComposerContext();

  const iconColor = disabled ? 'var(--colorNeutralForegroundDisabled, #A6A6A6)' : '#424242';

  const isControlled = externalOpen !== undefined;
  const isOpen = isControlled ? (!!externalOpen && !disabled) : (internalOpen && !disabled);

  const handleClose = () => {
    setURL('');
    setUrlError('');
    if (isControlled) onClose?.();
    else setInternalOpen(false);
  };

  const onHandleEmbeded = () => {
    if (disabled) return;
    if (!url) return;

    const id = extractYouTubeId(url);
    if (!id) {
      setUrlError('Invalid YouTube URL. Supported: watch?v=, youtu.be/, /shorts/, /live/');
      return;
    }

    setUrlError('');
    editor.update(() => {
      const node = $createYouTubeNode(id);
      $insertNodes([node]);
    });

    handleClose();
  };

  return (
    <>
      {!isControlled && (
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
            setURL('');
            setUrlError('');
            setInternalOpen(true);
          }}
        />
      )}

      <Dialog
        open={isOpen}
        onOpenChange={(_, data) => {
          if (!data.open) handleClose();
        }}>
        <DialogSurface style={{ maxWidth: '420px' }}>
          <DialogBody>
            <DialogTitle>Insert YouTube Video</DialogTitle>
            <DialogContent>
              <Stack tokens={{ childrenGap: 10 }} style={{ paddingTop: 8 }}>
                <Field
                  label='URL'
                  orientation='horizontal'
                  size='small'
                  validationState={urlError ? 'error' : 'none'}
                  validationMessage={urlError || undefined}>
                  <Input
                    autoFocus={!disabled}
                    disabled={disabled}
                    value={url}
                    appearance='underline'
                    placeholder='Paste YouTube URL or video ID…'
                    onChange={(_, v) => {
                      setURL(v.value);
                      if (urlError) setUrlError(''); // clear error on edit
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onHandleEmbeded();
                    }}
                  />
                </Field>
                <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>
                  Supports: youtube.com/watch?v=…, youtu.be/…, /shorts/…, /live/…
                </div>
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button
                appearance='primary'
                size='small'
                disabled={disabled || !url}
                onClick={onHandleEmbeded}>
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
