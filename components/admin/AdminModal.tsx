'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { motion } from 'motion/react';
import { CALM_EASE, GLIDE_SPRING, TACTILE_SPRING } from '@/components/CollapsibleLog';

interface AdminModalProps {
  onClose: () => void;
  titleId: string;
  title: string;
  maxWidthClass?: string;
  children: React.ReactNode;
}

export function AdminModal({
  onClose,
  titleId,
  title,
  maxWidthClass = 'max-w-lg',
  children,
}: AdminModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const prevFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (!dialog.open) {
      dialog.showModal();
    }
    return () => {
      if (dialog.open) {
        dialog.close();
      }
      if (prevFocused && prevFocused.isConnected) {
        prevFocused.focus();
      }
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="fixed inset-0 m-0 p-0 w-screen h-dvh max-w-none max-h-none bg-transparent border-0 text-ink overflow-hidden backdrop:bg-transparent backdrop:backdrop-blur-none"
    >
      <motion.div
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: CALM_EASE }}
        onClick={onClose}
        className="fixed inset-0 bg-black/58 backdrop-blur-[3px]"
      />
      <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0, transition: GLIDE_SPRING }}
          exit={{
            opacity: 0,
            scale: 0.97,
            y: 6,
            transition: { duration: 0.18, ease: CALM_EASE },
          }}
          className={`pointer-events-auto w-full ${maxWidthClass} max-h-[85vh] bg-bg/95 border border-line text-ink rounded-[2px] shadow-2xl overflow-hidden flex flex-col`}
        >
          <div className="flex items-center justify-between px-6 py-3.5 border-b border-line shrink-0">
            <h2
              id={titleId}
              className="font-mono text-xs uppercase tracking-wider text-ink-muted truncate pr-4"
            >
              {title}
            </h2>
            <motion.button
              type="button"
              onClick={onClose}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.9 }}
              transition={TACTILE_SPRING}
              className="text-ink-muted hover:text-ink transition-colors min-w-[44px] min-h-[44px] -mr-2 inline-flex items-center justify-center cursor-pointer"
              aria-label="Close dialog"
            >
              <X size={16} aria-hidden="true" />
            </motion.button>
          </div>
          <div className="p-6 overflow-y-auto overscroll-contain text-ink text-sm leading-relaxed">
            {children}
          </div>
        </motion.div>
      </div>
    </dialog>
  );
}
