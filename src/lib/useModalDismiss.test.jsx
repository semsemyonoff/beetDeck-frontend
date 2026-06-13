import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { useModalDismiss } from './useModalDismiss.js';

function TestModal({ onClose }) {
  useModalDismiss(onClose);
  return <div>modal</div>;
}

describe('useModalDismiss', () => {
  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<TestModal onClose={onClose} />);
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      );
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not call onClose for other keys', () => {
    const onClose = vi.fn();
    render(<TestModal onClose={onClose} />);
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
      );
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })
      );
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('removes listener on unmount so Escape no longer fires', () => {
    const onClose = vi.fn();
    const { unmount } = render(<TestModal onClose={onClose} />);
    unmount();
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      );
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not register listener when onClose is null', () => {
    expect(() => render(<TestModal onClose={null} />)).not.toThrow();
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      );
    });
  });

  it('updates listener when onClose callback changes', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<TestModal onClose={first} />);
    rerender(<TestModal onClose={second} />);
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      );
    });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });
});
