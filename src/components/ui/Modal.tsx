import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headerActions?: React.ReactNode;
  showCloseButton?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  className = '',
  headerActions,
  showCloseButton = true,
}) => {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-backdrop">
          <Dialog.Content
            className={`modal-container ${className}`}
            onClick={(e) => e.stopPropagation()}
          >
            {(title || showCloseButton) && (
              <div className="modal-header">
                <div className="modal-title-row">
                  {icon}
                  <div>
                    {title && (
                      <Dialog.Title asChild>
                        <h3 className="modal-title">{title}</h3>
                      </Dialog.Title>
                    )}
                    {subtitle && (
                      <Dialog.Description asChild>
                        <p className="modal-subtitle">{subtitle}</p>
                      </Dialog.Description>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {headerActions}
                  {showCloseButton && (
                    <Dialog.Close asChild>
                      <button
                        className="modal-close-btn"
                        onClick={onClose}
                        title="Close"
                        aria-label="Close"
                      >
                        <X size={18} />
                      </button>
                    </Dialog.Close>
                  )}
                </div>
              </div>
            )}
            {children}
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

