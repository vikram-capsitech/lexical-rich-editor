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
import { TableAddRegular } from '@fluentui/react-icons';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $createTableNodeWithDimensions } from '@lexical/table';
import { $insertNodeToNearestRoot } from '@lexical/utils';
import { useState } from 'react';

const MAX_ROWS = 50;
const MAX_COLS = 50;

export const TableItemPlugin = ({
  disabled,
  open: externalOpen,
  onClose,
}: {
  disabled: boolean;
  open?: boolean;
  onClose?: () => void;
}) => {
  const [editor] = useLexicalComposerContext();
  const [columns, setColumns] = useState('');
  const [rows, setRows] = useState('');
  const [internalOpen, setInternalOpen] = useState(false);
  const [rowError, setRowError] = useState('');
  const [colError, setColError] = useState('');

  const isControlled = externalOpen !== undefined;
  const isOpen = isControlled ? (!!externalOpen && !disabled) : (internalOpen && !disabled);
  const iconColor = disabled ? 'var(--colorNeutralForegroundDisabled, #A6A6A6)' : '#333333';

  const handleClose = () => {
    setRows('');
    setColumns('');
    setRowError('');
    setColError('');
    if (isControlled) onClose?.();
    else setInternalOpen(false);
  };

  const onRowsChange = (val: string) => {
    const clean = val.replace(/\D/g, '');
    setRows(clean);
    const n = Number(clean);
    if (clean && n > MAX_ROWS) setRowError(`Maximum ${MAX_ROWS} rows allowed`);
    else setRowError('');
  };

  const onColsChange = (val: string) => {
    const clean = val.replace(/\D/g, '');
    setColumns(clean);
    const n = Number(clean);
    if (clean && n > MAX_COLS) setColError(`Maximum ${MAX_COLS} columns allowed`);
    else setColError('');
  };

  const onAddTable = () => {
    if (disabled) return;
    const row = Number(rows);
    const col = Number(columns);
    if (!row || !col) return;
    if (row > MAX_ROWS || col > MAX_COLS) return;

    editor.update(() => {
      const tableNode = $createTableNodeWithDimensions(row, col, true);
      $insertNodeToNearestRoot(tableNode);
    });

    handleClose();
  };

  const isAddDisabled = disabled || !rows || !columns || !!rowError || !!colError;

  return (
    <>
      {!isControlled && (
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
            setRows('');
            setColumns('');
            setRowError('');
            setColError('');
            setInternalOpen(true);
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
            <DialogTitle>Insert Table</DialogTitle>
            <DialogContent>
              <Stack tokens={{ childrenGap: 10 }} style={{ paddingTop: 8 }}>
                <Field
                  label='Rows'
                  orientation='horizontal'
                  size='small'
                  validationMessage={rowError || undefined}
                  validationState={rowError ? 'error' : 'none'}>
                  <Input
                    autoFocus={!disabled}
                    type='number'
                    min={1}
                    max={MAX_ROWS}
                    value={rows}
                    placeholder='Rows'
                    appearance='underline'
                    disabled={disabled}
                    input={{ style: { textAlign: 'left' } }}
                    onChange={(_, v) => onRowsChange(v.value)}
                  />
                </Field>

                <Field
                  label='Columns'
                  orientation='horizontal'
                  size='small'
                  validationMessage={colError || undefined}
                  validationState={colError ? 'error' : 'none'}>
                  <Input
                    type='number'
                    min={1}
                    max={MAX_COLS}
                    value={columns}
                    placeholder='Columns'
                    appearance='underline'
                    disabled={disabled}
                    input={{ style: { textAlign: 'left' } }}
                    onChange={(_, v) => onColsChange(v.value)}
                  />
                </Field>
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button
                appearance='primary'
                size='small'
                disabled={isAddDisabled}
                onClick={onAddTable}>
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
