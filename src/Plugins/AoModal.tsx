import { Modal } from '@fluentui/react';
import { DismissRegular } from '@fluentui/react-icons';
import * as React from 'react';
import './AoModal.css';

export interface AoModalProps {
  isOpen: boolean;
  onDismiss: () => void;
  title: string;
  maxWidth?: number;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Shared replacement for Fluent v9's Dialog/DialogSurface across the insert
 * plugins (Table, Image, Inline Image, YouTube). Wraps the older, still
 * actively maintained v8 Modal instead, with our own `ao`-prefixed class
 * names for the chrome (header/title/close/body/actions) so a host app's
 * CSS can't collide with and override it the way generic/unprefixed class
 * names have in the past.
 */
export const AoModal = ({
  isOpen,
  onDismiss,
  title,
  maxWidth = 340,
  actions,
  children,
}: AoModalProps): JSX.Element => {
  return (
    <Modal isOpen={isOpen} onDismiss={onDismiss} containerClassName='aoModalContainer'>
      <div style={{ maxWidth, width: '90vw' }}>
        <div className='aoModalHeader'>
          <span className='aoModalTitle'>{title}</span>
          <div
            className='aoModalClose'
            role='button'
            tabIndex={0}
            title='Close'
            aria-label='Close'
            onClick={onDismiss}>
            <DismissRegular fontSize={18} />
          </div>
        </div>
        <div className='aoModalBody'>{children}</div>
        {actions && <div className='aoModalActions'>{actions}</div>}
      </div>
    </Modal>
  );
};

export default AoModal;
