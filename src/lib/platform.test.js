import { describe, it, expect } from 'vitest';
import { isMac, searchShortcut } from './platform.js';

describe('isMac', () => {
  const macCases = [
    [
      'userAgentData.platform = macOS',
      { userAgentData: { platform: 'macOS' } },
    ],
    ['platform = MacIntel', { platform: 'MacIntel' }],
    [
      'userAgent mentions Mac OS X',
      { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
    ],
    [
      'prefers userAgentData over a windows platform',
      { userAgentData: { platform: 'macOS' }, platform: 'Win32' },
    ],
  ];
  for (const [name, nav] of macCases) {
    it(`returns true when ${name}`, () => {
      expect(isMac(nav)).toBe(true);
    });
  }

  const nonMacCases = [
    ['platform = Win32', { platform: 'Win32' }],
    ['platform = Linux x86_64', { platform: 'Linux x86_64' }],
    [
      'userAgentData.platform = Windows',
      { userAgentData: { platform: 'Windows' } },
    ],
    [
      'userAgent is a linux string',
      { userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' },
    ],
    ['empty navigator', {}],
  ];
  for (const [name, nav] of nonMacCases) {
    it(`returns false when ${name}`, () => {
      expect(isMac(nav)).toBe(false);
    });
  }

  it('uses the first available source in the detection chain', () => {
    // userAgentData present but non-mac → stops there, ignores a mac userAgent.
    expect(
      isMac({ userAgentData: { platform: 'Windows' }, userAgent: 'Mac OS X' })
    ).toBe(false);
  });
});

describe('searchShortcut', () => {
  const mac = { platform: 'MacIntel' };
  const win = { platform: 'Win32' };

  it('labels the keycap ⌘K on mac', () => {
    expect(searchShortcut(mac).label).toBe('⌘K');
  });

  it('labels the keycap Ctrl K elsewhere', () => {
    expect(searchShortcut(win).label).toBe('Ctrl K');
  });

  it('exposes the mac flag', () => {
    expect(searchShortcut(mac).mac).toBe(true);
    expect(searchShortcut(win).mac).toBe(false);
  });

  describe('matches() on mac (metaKey)', () => {
    const sc = searchShortcut(mac);
    it('matches Cmd+K', () => {
      expect(sc.matches({ key: 'k', metaKey: true })).toBe(true);
    });
    it('matches uppercase K', () => {
      expect(sc.matches({ key: 'K', metaKey: true })).toBe(true);
    });
    it('rejects Ctrl+K (wrong modifier)', () => {
      expect(sc.matches({ key: 'k', ctrlKey: true })).toBe(false);
    });
    it('rejects Cmd+Ctrl+K (both modifiers)', () => {
      expect(sc.matches({ key: 'k', metaKey: true, ctrlKey: true })).toBe(
        false
      );
    });
    it('rejects a bare K with no modifier', () => {
      expect(sc.matches({ key: 'k' })).toBe(false);
    });
    it('rejects the wrong key', () => {
      expect(sc.matches({ key: 'j', metaKey: true })).toBe(false);
    });
  });

  describe('matches() on non-mac (ctrlKey)', () => {
    const sc = searchShortcut(win);
    it('matches Ctrl+K', () => {
      expect(sc.matches({ key: 'k', ctrlKey: true })).toBe(true);
    });
    it('rejects Cmd+K (wrong modifier)', () => {
      expect(sc.matches({ key: 'k', metaKey: true })).toBe(false);
    });
    it('rejects Ctrl+Cmd+K (both modifiers)', () => {
      expect(sc.matches({ key: 'k', ctrlKey: true, metaKey: true })).toBe(
        false
      );
    });
    it('rejects the wrong key', () => {
      expect(sc.matches({ key: 'l', ctrlKey: true })).toBe(false);
    });
  });

  it('guards against malformed events', () => {
    const sc = searchShortcut(win);
    expect(sc.matches(undefined)).toBe(false);
    expect(sc.matches({})).toBe(false);
    expect(sc.matches({ key: null, ctrlKey: true })).toBe(false);
  });
});
