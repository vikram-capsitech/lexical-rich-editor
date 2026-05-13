import { Stack } from '@fluentui/react';
import {
  Button,
  Field,
  Input,
  Popover,
  PopoverSurface,
  PopoverTrigger,
} from '@fluentui/react-components';
import { TableAddRegular } from '@fluentui/react-icons';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $createTableNodeWithDimensions } from '@lexical/table';
import { $insertNodeToNearestRoot } from '@lexical/utils';
import { useState } from 'react';

export const TableItemPlugin = ({ disabled }: { disabled: boolean }) => {
  const [editor] = useLexicalComposerContext();
  const [columns, setColumns] = useState('');
  const [rows, setRows] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const iconColor = disabled ? 'var(--colorNeutralForegroundDisabled, #A6A6A6)' : '#333333';

  const onAddTable = () => {
    if (disabled) return;

    const row = Number(rows);
    const col = Number(columns);
    if (!row || !col) return;

    editor.update(() => {
      const tableNode = $createTableNodeWithDimensions(row, col, true);
      $insertNodeToNearestRoot(tableNode);
    });

    setRows('');
    setColumns('');
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
          size='small'
          title='Add table'
          disabled={disabled}
          key='insert-table-nodes'
          icon={<TableAddRegular style={{ color: iconColor }} />}
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
            setRows('');
            setColumns('');
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
          <Field label='Rows' orientation='horizontal' size='small'>
            <Input
              autoFocus={!disabled}
              value={rows}
              placeholder='Rows'
              appearance='underline'
              disabled={disabled}
              onChange={(_, v) => setRows(v.value)}
            />
          </Field>

          <Field label='Columns' orientation='horizontal' size='small'>
            <Input
              value={columns}
              placeholder='Columns'
              appearance='underline'
              disabled={disabled}
              onChange={(_, v) => setColumns(v.value)}
            />
          </Field>

          <Stack horizontal horizontalAlign='end' tokens={{ childrenGap: 6 }}>
            <Button
              size='small'
              appearance='primary'
              disabled={disabled || !rows || !columns}
              onClick={onAddTable}>
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
