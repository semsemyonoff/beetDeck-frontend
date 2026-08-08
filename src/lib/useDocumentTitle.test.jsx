import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import {
  APP_NAME,
  formatDocumentTitle,
  useDocumentTitle,
} from './useDocumentTitle.js';

function TestPage({ title }) {
  useDocumentTitle(title);
  return <div>page</div>;
}

describe('formatDocumentTitle', () => {
  const cases = [
    ['Abbey Road', `Abbey Road · ${APP_NAME}`],
    ['  Abbey Road  ', `Abbey Road · ${APP_NAME}`],
    ['', APP_NAME],
    ['   ', APP_NAME],
    [null, APP_NAME],
    [undefined, APP_NAME],
  ];

  for (const [input, expected] of cases) {
    it(`formats ${JSON.stringify(input)} as ${JSON.stringify(expected)}`, () => {
      expect(formatDocumentTitle(input)).toBe(expected);
    });
  }
});

describe('useDocumentTitle', () => {
  beforeEach(() => {
    document.title = APP_NAME;
  });

  it('sets the document title while mounted', () => {
    render(<TestPage title="Abbey Road" />);
    expect(document.title).toBe(`Abbey Road · ${APP_NAME}`);
  });

  it('updates the title when the page title changes', () => {
    const { rerender } = render(<TestPage title="Abbey Road" />);
    rerender(<TestPage title="Revolver" />);
    expect(document.title).toBe(`Revolver · ${APP_NAME}`);
  });

  it('restores the app name on unmount', () => {
    const { unmount } = render(<TestPage title="Abbey Road" />);
    unmount();
    expect(document.title).toBe(APP_NAME);
  });

  it('keeps the app name when there is no page title yet', () => {
    render(<TestPage title="" />);
    expect(document.title).toBe(APP_NAME);
  });
});
