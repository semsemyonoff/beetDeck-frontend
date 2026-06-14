import { describe, it, expect } from 'vitest';
import { parseLyricLines, isSynced } from './lyrics.js';

describe('isSynced', () => {
  const cases = [
    ['null', null, false],
    ['undefined', undefined, false],
    ['empty string', '', false],
    ['plain lyrics', 'Hello world\nSecond line', false],
    ['single synced line', '[00:12.34] Hello world', true],
    ['multi synced lines', '[00:12.34] a\n[00:15.00] b', true],
    ['mm:ss without centis', '[01:05] a', true],
    ['mixed synced + plain', 'intro\n[00:01.00] line', true],
    ['metadata tags only (not timestamps)', '[ar:Artist]\n[ti:Title]', false],
    ['length tag is not a timestamp', '[length:03:21]\nplain', false],
  ];
  it.each(cases)('%s', (_name, input, expected) => {
    expect(isSynced(input)).toBe(expected);
  });
});

describe('parseLyricLines', () => {
  it('returns ts: null for plain lines', () => {
    expect(parseLyricLines('hello\nworld')).toEqual([
      { ts: null, text: 'hello' },
      { ts: null, text: 'world' },
    ]);
  });

  it('splits the timestamp from the text', () => {
    expect(parseLyricLines('[00:34.73] I been saving')).toEqual([
      { ts: '00:34.73', text: 'I been saving' },
    ]);
  });

  it('handles a timestamp with no following space', () => {
    expect(parseLyricLines('[00:34.73]tight')).toEqual([
      { ts: '00:34.73', text: 'tight' },
    ]);
  });

  it('keeps blank text after a timestamp', () => {
    expect(parseLyricLines('[00:40.00]')).toEqual([
      { ts: '00:40.00', text: '' },
    ]);
  });

  it('mixes timed and untimed lines', () => {
    expect(parseLyricLines('intro\n[00:01.00] a')).toEqual([
      { ts: null, text: 'intro' },
      { ts: '00:01.00', text: 'a' },
    ]);
  });

  it('does not treat metadata tags as timestamps', () => {
    expect(parseLyricLines('[ar:Band]')).toEqual([
      { ts: null, text: '[ar:Band]' },
    ]);
  });

  it('treats null/undefined as a single empty line', () => {
    expect(parseLyricLines(null)).toEqual([{ ts: null, text: '' }]);
    expect(parseLyricLines(undefined)).toEqual([{ ts: null, text: '' }]);
  });
});
