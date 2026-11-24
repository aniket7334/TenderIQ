import React, { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';

const sizeStyles = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
} as const;

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  eyebrow?: string;
  children: React.ReactNode;
  size?: keyof typeof sizeStyles;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  eyebrow,
  children,
  size = 'md',
}) => {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div
            className="fixed inset-0 bg-ink/40 backdrop-blur-[2px]"
            aria-hidden="true"
          />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 translate-y-1"
              enterTo="opacity-100 translate-y-0"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 translate-y-0"
              leaveTo="opacity-0 translate-y-1"
            >
              <Dialog.Panel
                className={clsx(
                  'w-full transform border border-rule-strong bg-canvas shadow-[0_20px_60px_-30px_rgba(11,46,79,0.3)] transition-all',
                  sizeStyles[size],
                )}
              >
                {(title || eyebrow) && (
                  <div className="flex items-start justify-between border-b border-rule px-6 py-5">
                    <div className="min-w-0">
                      {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
                      {title && (
                        <Dialog.Title className="font-display text-[22px] font-normal leading-tight tracking-[-0.015em] text-ink">
                          {title}
                        </Dialog.Title>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={onClose}
                      className="ml-4 p-1 text-ink-muted transition-colors hover:text-ink"
                      aria-label="Close"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                )}
                <div className="px-6 py-5">
                  {children}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export { Modal };
