'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-[2px] transition-opacity"
      />
      <div className="relative z-10 w-full max-w-2xl max-h-[85vh] flex flex-col quiet-panel bg-bg/95 border border-line shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h3 className="font-mono text-xs uppercase tracking-wider text-ink-muted truncate pr-4">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-ink-muted hover:text-ink transition-colors p-1 cursor-pointer"
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-6 sm:p-8 overflow-y-auto text-ink text-sm leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  );
}
