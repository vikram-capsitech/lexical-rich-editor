import { Stack } from '@fluentui/react';
import { Button, Field, Input } from '@fluentui/react-components';
import { TableAddRegular } from '@fluentui/react-icons';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $createTableNodeWithDimensions } from '@lexical/table';
import { $insertNodeToNearestRoot } from '@lexical/utils';
import { useState } from 'react';
import { AoModal } from './AoModal';

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
      // Shade only the first row as a header (standard doc/spreadsheet
      // convention) — the first column was also being marked as a header,
      // shading the entire left edge of every inserted table.
      const tableNode = $createTableNodeWithDimensions(row, col, { columns: false, rows: true });
      $insertNodeToNearestRoot(tableNode);
    });

    setRows('');
    setColumns('');
    setIsOpen(false);
  };

  return (
    <AoModal
      isOpen={disabled ? false : isOpen}
      onOpenChange={(open) => {
        if (disabled) return;
        setIsOpen(open);
        if (open) {
          setRows('');
          setColumns('');
        }
      }}
      trigger={
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
        />
      }
      title='Insert table'
      maxWidth={300}
      actions={
          <>
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
          </>
        }>
        <Stack tokens={{ childrenGap: 8 }}>
          <Field label='Rows' size='small'>
            <Input
              autoFocus={!disabled}
              value={rows}
              placeholder='Rows'
              appearance='underline'
              disabled={disabled}
              onChange={(_, v) => setRows(v.value)}
            />
          </Field>

          <Field label='Columns' size='small'>
            <Input
              value={columns}
              placeholder='Columns'
              appearance='underline'
              disabled={disabled}
              onChange={(_, v) => setColumns(v.value)}
            />
          </Field>
        </Stack>
      </AoModal>
  );
};
