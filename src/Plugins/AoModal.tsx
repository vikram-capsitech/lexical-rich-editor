import {
  Button,
  Popover,
  PopoverSurface,
  PopoverTrigger,
} from '@fluentui/react-components';
import { DismissRegular } from '@fluentui/react-icons';
import * as React from 'react';

export interface AoModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactElement;
  title: string;
  maxWidth?: number;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Shared replacement for Dialog across the insert plugins. Built on Fluent's
 * own Popover instead of a hand-rolled portal/backdrop: Popover positions
 * itself relative to its trigger via floating-ui and is styled with Griffel
 * (CSS-in-JS injected at runtime), so it isn't affected by host page
 * containing-block quirks or by whether this package's own CSS file has
 * been imported by the consuming app.
 */
export const AoModal = ({
  isOpen,
  onOpenChange,
  trigger,
  title,
  maxWidth = 280,
  actions,
  children,
}: AoModalProps): JSX.Element => {
  return (
    <Popover
      open={isOpen}
      onOpenChange={(_, data) => onOpenChange(data.open)}
      positioning={{ position: 'below', align: 'start' }}
    >
      <PopoverTrigger disableButtonEnhancement>{trigger}</PopoverTrigger>
      <PopoverSurface style={{ minWidth: 240, maxWidth, width: '90vw' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{title}</h2>
          <Button
            appearance="subtle"
            size="small"
            icon={<DismissRegular />}
            aria-label="Close popup"
            onClick={() => onOpenChange(false)}
          />
        </div>

        <div>{children}</div>

        {actions && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            {actions}
          </div>
        )}
      </PopoverSurface>
    </Popover>
  );
};

export default AoModal;
