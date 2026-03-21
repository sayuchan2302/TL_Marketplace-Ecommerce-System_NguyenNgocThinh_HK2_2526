import { useCallback, useEffect, useRef, useState } from 'react';

interface UseKeyboardNavigationOptions {
  items: { value: string; label: string }[];
  onSelect: (value: string) => void;
  onClose: () => void;
}

export function useKeyboardNavigation({ items, onSelect, onClose }: UseKeyboardNavigationOptions) {
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < items.length) {
          onSelect(items[focusedIndex].value);
          setFocusedIndex(-1);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        setFocusedIndex(-1);
        break;
      case 'Tab':
        onClose();
        setFocusedIndex(-1);
        break;
    }
  }, [items, onSelect, onClose, focusedIndex]);

  useEffect(() => {
    const menu = menuRef.current;
    if (menu) {
      menu.addEventListener('keydown', handleKeyDown);
      return () => menu.removeEventListener('keydown', handleKeyDown);
    }
  }, [handleKeyDown]);

  const getItemProps = (index: number) => ({
    ref: index === focusedIndex ? (el: HTMLButtonElement | null) => el?.focus() : null,
    'data-focused': index === focusedIndex,
  });

  return { menuRef, focusedIndex, setFocusedIndex, getItemProps };
}

export function useFocusTrap(isOpen: boolean, onEscape?: () => void) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const container = containerRef.current;
    if (!container) return;

    const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusableElements = container.querySelectorAll<HTMLElement>(focusableSelector);
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
        onEscape?.();
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onEscape]);

  return containerRef;
}
