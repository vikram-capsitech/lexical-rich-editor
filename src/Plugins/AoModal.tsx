import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import * as React from 'react';
import { createPortal } from 'react-dom';
import { useFloatingPortalContainer } from '../Utils/FloatingPortal';
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
 * Shared replacement for Dialog across the insert plugins. Portals the modal
 * as a `position: fixed` overlay into the closest Fluent Panel/Layer (or
 * document.body) instead of the editor's own root wrapper — the editor root
 * is only ever as tall as its content, so an absolutely-positioned backdrop
 * anchored there doesn't cover the page; it just renders in-flow after it.
 */
export const AoModal = ({
  isOpen,
  onDismiss,
  title,
  maxWidth = 280, // Default to a smaller, compact size
  actions,
  children,
}: AoModalProps): JSX.Element | null => {
  const [editor] = useLexicalComposerContext();
  const hostElement = useFloatingPortalContainer(editor);

  if (!isOpen) return null;

  const modalContent = (
    <div className="aoModalBackdrop" onClick={onDismiss}>
      <FluentProvider
        theme={webLightTheme}
        className="aoModalWrapper aoModalContainer"
        style={{ maxWidth, width: '90vw' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Section */}
        <div className="aoModalHeader">
          <h2 className="aoModalTitle">{title}</h2>
          <button
            className="aoModalCloseButton"
            aria-label="Close popup"
            onClick={onDismiss}
          >
            ✕
          </button>
        </div>

        {/* Body Section */}
        <div className="aoModalBody">{children}</div>

        {/* Actions Footer Section */}
        {actions && <div className="aoModalActions">{actions}</div>}
      </FluentProvider>
    </div>
  );

  if (!hostElement) return null;

  return createPortal(modalContent, hostElement);
};

export default AoModal;