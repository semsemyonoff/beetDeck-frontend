import { describe, it, expect } from 'vitest';
import {
  buildMbsyncViewModel,
  toggleField,
  excludedFieldsFor,
} from './mbsync.js';

describe('buildMbsyncViewModel', () => {
  it('maps a changed payload into camelCase, deriving field names', () => {
    const payload = {
      album_id: 42,
      mb_albumid: 'release-1',
      data_source: 'MusicBrainz',
      stash_generation: 7,
      album_fields: [{ field: 'label', old: '', new: '4AD' }],
      track_fields: [
        {
          field: 'title',
          changes: [
            { item_id: 101, track: 3, old: 'Intro', new: 'Introduction' },
          ],
        },
      ],
      unmapped: [{ item_id: 117, track: 13, title: 'Hidden' }],
      changed: true,
    };

    expect(buildMbsyncViewModel(payload)).toEqual({
      albumId: 42,
      mbAlbumid: 'release-1',
      dataSource: 'MusicBrainz',
      stashGeneration: 7,
      albumFields: [{ field: 'label', old: '', new: '4AD' }],
      trackFields: [
        {
          field: 'title',
          changes: [
            { itemId: 101, track: 3, old: 'Intro', new: 'Introduction' },
          ],
        },
      ],
      unmapped: [{ itemId: 117, track: 13, title: 'Hidden' }],
      changed: true,
      fieldNames: ['label', 'title'],
    });
  });

  it('handles a changed: false payload with no diffs', () => {
    const payload = {
      album_id: 1,
      mb_albumid: 'release-2',
      data_source: 'MusicBrainz',
      stash_generation: 1,
      album_fields: [],
      track_fields: [],
      unmapped: [],
      changed: false,
    };

    expect(buildMbsyncViewModel(payload)).toEqual({
      albumId: 1,
      mbAlbumid: 'release-2',
      dataSource: 'MusicBrainz',
      stashGeneration: 1,
      albumFields: [],
      trackFields: [],
      unmapped: [],
      changed: false,
      fieldNames: [],
    });
  });

  it('carries unmapped entries with track and title as they arrive', () => {
    const payload = {
      album_id: 1,
      mb_albumid: 'release-3',
      data_source: 'MusicBrainz',
      stash_generation: 2,
      album_fields: [],
      track_fields: [],
      unmapped: [
        { item_id: 5, track: null, title: 'Bonus Track' },
        { item_id: 6, track: 9, title: null },
      ],
      changed: false,
    };

    const vm = buildMbsyncViewModel(payload);
    expect(vm.unmapped).toEqual([
      { itemId: 5, track: null, title: 'Bonus Track' },
      { itemId: 6, track: 9, title: null },
    ]);
    expect(vm.unmapped).toHaveLength(2);
  });

  it('returns null for nullish input', () => {
    expect(buildMbsyncViewModel(null)).toBeNull();
    expect(buildMbsyncViewModel(undefined)).toBeNull();
  });
});

describe('toggleField / excludedFieldsFor', () => {
  it('starts included: an empty set excludes nothing', () => {
    expect(excludedFieldsFor(new Set())).toEqual([]);
  });

  it('toggling a field once excludes it', () => {
    const next = toggleField(new Set(), 'label');
    expect(excludedFieldsFor(next)).toEqual(['label']);
  });

  it('toggling the same field twice re-includes it', () => {
    let state = new Set();
    state = toggleField(state, 'label');
    state = toggleField(state, 'label');
    expect(excludedFieldsFor(state)).toEqual([]);
  });

  it('does not mutate the input state', () => {
    const original = new Set(['title']);
    const next = toggleField(original, 'label');
    expect(Array.from(original)).toEqual(['title']);
    expect(excludedFieldsFor(next)).toEqual(['label', 'title']);
  });

  it('supports excluding every field', () => {
    let state = new Set();
    for (const field of ['label', 'title', 'artist']) {
      state = toggleField(state, field);
    }
    expect(excludedFieldsFor(state)).toEqual(['artist', 'label', 'title']);
  });
});
