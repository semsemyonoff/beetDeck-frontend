import { useEffect } from 'react';

export function useModalDismiss(onClose) {
  useEffect(() => {
    if (!onClose) return;
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);
}
