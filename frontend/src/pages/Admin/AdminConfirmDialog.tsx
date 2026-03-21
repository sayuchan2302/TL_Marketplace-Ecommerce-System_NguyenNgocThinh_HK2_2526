import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef } from 'react';

interface AdminConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  selectedItems?: string[];
  selectedNoun?: string;
  maxVisibleItems?: number;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const AdminConfirmDialog = ({
  open,
  title,
  description,
  selectedItems,
  selectedNoun = 'mục',
  maxVisibleItems = 6,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  danger = false,
  onConfirm,
  onCancel,
}: AdminConfirmDialogProps) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusableElements = dialog.querySelectorAll<HTMLElement>(focusableSelector);
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    firstElement?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      }
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    dialog.addEventListener('keydown', handleKeyDown);
    return () => dialog.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel]);

  const selectedList = selectedItems || [];
  const hasSelectedItems = selectedList.length > 0;
  const visibleItems = selectedList.slice(0, maxVisibleItems);
  const hiddenCount = Math.max(0, selectedList.length - visibleItems.length);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="drawer-overlay"
            onClick={onCancel}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          />
          <motion.div
            ref={dialogRef}
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            <h3>{title}</h3>
            <p>{description}</p>

            {hasSelectedItems && (
              <div className="confirm-selection-block">
                <p className="confirm-selection-count">Đã chọn {selectedList.length} {selectedNoun}:</p>
                <ul className="confirm-selection-list">
                  {visibleItems.map((item, idx) => (
                    <li key={`${item}-${idx}`}>{item}</li>
                  ))}
                </ul>
                {hiddenCount > 0 && <p className="confirm-selection-more">+{hiddenCount} {selectedNoun} khác</p>}
              </div>
            )}

            <div className="confirm-modal-actions">
              <button ref={cancelBtnRef} className="admin-ghost-btn" onClick={onCancel}>{cancelLabel}</button>
              <button className={`admin-primary-btn ${danger ? 'danger' : ''}`.trim()} onClick={onConfirm}>{confirmLabel}</button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default AdminConfirmDialog;
