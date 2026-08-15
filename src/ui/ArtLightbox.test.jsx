import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import ArtLightbox from './ArtLightbox.jsx';

const MBID = '1b022e01-4da6-387b-8658-8678046e4cef';

function image(overrides) {
  return {
    image_id: '100',
    types: ['Front'],
    front: true,
    back: false,
    approved: true,
    comment: '',
    thumb_sizes: [250, 500, 1200],
    mb_url: `https://musicbrainz.org/release/${MBID}`,
    width: null,
    height: null,
    ...overrides,
  };
}

const IMAGES = [
  image({ image_id: '100', width: 1425, height: 1425 }),
  image({ image_id: '200', types: ['Back'], front: false, back: true }),
  image({
    image_id: '300',
    types: ['Booklet', 'Front'],
    approved: false,
    comment: 'inner spread',
    width: 2400,
    height: 1200,
  }),
];

function setup(overrides = {}) {
  const props = {
    albumId: '1',
    images: IMAGES,
    index: 0,
    currentImageId: null,
    onIndex: vi.fn(),
    onClose: vi.fn(),
    onApply: vi.fn(),
    ...overrides,
  };
  const view = render(<ArtLightbox {...props} />);
  return { ...view, props };
}

function metaValue(label) {
  const dt = [...document.querySelectorAll('.art-lb-meta dt')].find(
    (n) => n.textContent === label
  );
  return dt?.nextElementSibling;
}

afterEach(cleanup);

describe('ArtLightbox — staging', () => {
  it('renders the staged image through the proxy at the picked size', () => {
    setup();
    const img = document.querySelector('.art-lb-frame img');
    // 1200 is the smallest rendition covering the ~900 px stage; asking for
    // `full` here would put an original through the proxy per open.
    expect(img).toHaveAttribute('src', '/api/album/1/artwork/100?size=1200');
    expect(img).toHaveAttribute('alt', 'Front artwork');
  });

  it('falls back to the original when CAA generated no thumbnails', () => {
    setup({ images: [image({ thumb_sizes: [] })], index: 0 });
    expect(document.querySelector('.art-lb-frame img')).toHaveAttribute(
      'src',
      '/api/album/1/artwork/100?size=full'
    );
  });

  it('renders the counter as position over the filtered list', () => {
    setup({ index: 1 });
    expect(document.querySelector('.art-lb-counter')).toHaveTextContent(
      '2 / 3'
    );
  });

  it('renders nothing when the index points outside the list', () => {
    const { container } = setup({ index: 7 });
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for an empty list', () => {
    const { container } = setup({ images: [], index: 0 });
    expect(container).toBeEmptyDOMElement();
  });
});

describe('ArtLightbox — navigation', () => {
  it('advances with the Next control', () => {
    const { props } = setup({ index: 0 });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(props.onIndex).toHaveBeenCalledWith(1);
  });

  it('wraps forward past the last image', () => {
    const { props } = setup({ index: 2 });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(props.onIndex).toHaveBeenCalledWith(0);
  });

  it('wraps backward past the first image', () => {
    const { props } = setup({ index: 0 });
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(props.onIndex).toHaveBeenCalledWith(2);
  });

  it('navigates with the arrow keys', () => {
    const { props } = setup({ index: 1 });
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(props.onIndex).toHaveBeenCalledWith(2);
    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(props.onIndex).toHaveBeenCalledWith(0);
  });

  it('drops the arrow handlers on unmount', () => {
    const { props, unmount } = setup({ index: 0 });
    unmount();
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(props.onIndex).not.toHaveBeenCalled();
  });
});

describe('ArtLightbox — dismissal', () => {
  it('closes on Escape', () => {
    const { props } = setup();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalled();
  });

  it('closes on the × control', () => {
    const { props } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('closes on a backdrop click but not on a click inside', () => {
    const { props } = setup();
    fireEvent.click(document.querySelector('.art-lb-inner'));
    expect(props.onClose).not.toHaveBeenCalled();
    fireEvent.click(document.querySelector('.art-lightbox'));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});

describe('ArtLightbox — metadata', () => {
  it('renders types, thumbnails and the image id', () => {
    setup({ index: 2 });
    expect(metaValue('Types')).toHaveTextContent('Booklet, Front');
    expect(metaValue('Thumbnails')).toHaveTextContent('250 · 500 · 1200 px');
    expect(metaValue('Image ID')).toHaveTextContent('300');
    expect(metaValue('Comment')).toHaveTextContent('inner spread');
  });

  it('renders the measured size and ratio when the API reported one', () => {
    setup({ index: 2 });
    expect(metaValue('Size')).toHaveTextContent('2400 × 1200 px');
    expect(metaValue('Ratio')).toHaveTextContent('2.00:1');
  });

  it('renders an em dash for an unmeasured image rather than the thumbnail size', () => {
    setup({ index: 1 });
    expect(metaValue('Size')).toHaveTextContent('—');
    expect(metaValue('Ratio')).toHaveTextContent('—');
    expect(metaValue('Size')).not.toHaveTextContent('250');
  });

  it('renders an em dash for an absent comment and for no types', () => {
    setup({ images: [image({ types: [], comment: '' })], index: 0 });
    expect(metaValue('Comment')).toHaveTextContent('—');
    expect(metaValue('Types')).toHaveTextContent('—');
    expect(document.querySelector('.art-lb-title')).toHaveTextContent(
      'Untyped'
    );
  });

  it('renders an em dash when CAA generated no thumbnails', () => {
    setup({ images: [image({ thumb_sizes: [] })], index: 0 });
    expect(metaValue('Thumbnails')).toHaveTextContent('—');
  });

  it('flags the current cover, approval and the front/back roles', () => {
    setup({ index: 0, currentImageId: '100' });
    const flags = document.querySelector('.art-lb-flags');
    expect(flags).toHaveTextContent('current cover');
    expect(flags).toHaveTextContent('approved');
    expect(flags).toHaveTextContent('front');
    expect(flags).not.toHaveTextContent('back');
  });

  it('flags an unapproved image and drops the current-cover badge', () => {
    setup({ index: 2, currentImageId: '100' });
    const flags = document.querySelector('.art-lb-flags');
    expect(flags).toHaveTextContent('not approved');
    expect(flags).not.toHaveTextContent('current cover');
  });
});

describe('ArtLightbox — actions', () => {
  it('calls onApply with the staged image', () => {
    const { props } = setup({ index: 1 });
    fireEvent.click(
      screen.getByRole('button', { name: /set as album cover/i })
    );
    expect(props.onApply).toHaveBeenCalledTimes(1);
    expect(props.onApply.mock.calls[0][0].image_id).toBe('200');
  });

  it('disables the action for the image that is already the cover', () => {
    const { props } = setup({ index: 0, currentImageId: '100' });
    const btn = screen.getByRole('button', { name: /already album cover/i });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(props.onApply).not.toHaveBeenCalled();
  });

  it('renders the busy state while the page holds the request', () => {
    setup({ index: 1, applyBusy: true });
    const btn = screen.getByRole('button', { name: /setting cover/i });
    expect(btn).toBeDisabled();
    expect(btn.querySelector('.btn-spinner')).not.toBeNull();
  });

  it('renders the apply error the page hands it', () => {
    setup({ index: 1, applyError: 'CAA could not be reached' });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'CAA could not be reached'
    );
    // The failure does not disable the retry.
    expect(
      screen.getByRole('button', { name: /set as album cover/i })
    ).toBeEnabled();
  });

  it('links to MusicBrainz and to the original through the proxy', () => {
    setup({ index: 1 });
    const mb = screen.getByRole('link', { name: /open in musicbrainz/i });
    expect(mb).toHaveAttribute(
      'href',
      `https://musicbrainz.org/release/${MBID}`
    );
    expect(mb).toHaveAttribute('target', '_blank');
    expect(mb).toHaveAttribute('rel', 'noreferrer');

    const dl = screen.getByRole('link', { name: /download/i });
    // Through the proxy: no coverartarchive.org origin ever reaches the page.
    expect(dl).toHaveAttribute('href', '/api/album/1/artwork/200?size=full');
    expect(dl).toHaveAttribute('download');
  });

  it('drops the MusicBrainz link when the listing carries no url', () => {
    setup({ images: [image({ mb_url: '' })], index: 0 });
    expect(
      screen.queryByRole('link', { name: /open in musicbrainz/i })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /download/i })).toBeInTheDocument();
  });

  it('holds no network code of its own', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { props } = setup({ index: 1 });
    fireEvent.click(
      screen.getByRole('button', { name: /set as album cover/i })
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(props.onApply).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
