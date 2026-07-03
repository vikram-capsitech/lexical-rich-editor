import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import * as React from 'react';
import { createPortal } from 'react-dom';
import './AoModal.css';

export interface AoModalProps {
  isOpen: boolean;
  onDismiss: () => void;
  title: string;
  maxWidth?: number;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

/**
 * Shared replacement for Dialog across the insert plugins.
 * Portals the modal content to the nearest editor root wrapper
 * to position it absolutely within the editor component's boundaries.
 */
export const AoModal = ({
  isOpen,
  onDismiss,
  title,
  maxWidth = 280, // Default to a smaller, compact size
  actions,
  children,
}: AoModalProps): JSX.Element | null => {
  const [hostElement, setHostElement] = React.useState<Element | null>(null);
  const mountRef = React.useRef<HTMLDivElement>(null);

  useIsomorphicLayoutEffect(() => {
    if (isOpen && mountRef.current) {
      const root = mountRef.current.closest('.lexical-rich-editor-root');
      if (root) {
        setHostElement(root);
      } else {
        setHostElement(mountRef.current.parentElement);
      }
    }
  }, [isOpen]);

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

  if (hostElement) {
    return createPortal(modalContent, hostElement);
  }

  // Render a hidden mount helper to resolve the DOM context first
  return <div ref={mountRef} style={{ display: 'none' }} />;
};

export default AoModal;