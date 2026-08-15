import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import ArtLightbox from './ArtLightbox.jsx';

// PhotoSwipe is never rendered in jsdom — it measures a viewport that does not
// exist. The seam is the lightbox class, so the tests assert on the calls the
// component makes into it and on the events it subscribes to.
const pswpInstances = [];

vi.mock('photoswipe/lightbox', () => ({
  default: class PhotoSwipeLightboxMock {
    constructor(options) {
      this.options = options;
      this.listeners = {};
      this.init = vi.fn();
      this.destroy = vi.fn();
      this.loadAndOpen = vi.fn(() => true);
      this.pswp = { currIndex: 0 };
      pswpInstances.push(this);
    }
    on(name, fn) {
      (this.listeners[name] ||= []).push(fn);
    }
    emit(name, payload) {
      (this.listeners[name] || []).forEach((fn) => fn(payload));
    }
  },
}));

/** The one instance the component under test built. */
function pswp() {
  expect(pswpInstances).toHaveLength(1);
  return pswpInstances[0];
}

function stagedImage() {
  return document.querySelector('.art-lb-frame img');
}

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

beforeEach(() => {
  pswpInstances.length = 0;
});

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

describe('ArtLightbox — PhotoSwipe fullscreen', () => {
  it('builds one instance with a lazily imported core', () => {
    setup();
    expect(pswp().init).toHaveBeenCalledTimes(1);
    // The core must arrive through a dynamic import, or every route pays for
    // it in the entry chunk.
    expect(typeof pswp().options.pswpModule).toBe('function');
    // PhotoSwipe's own 0.8 backdrop reads straight through to this
    // component's overlay, which is not a gallery worth glimpsing.
    expect(pswp().options.bgOpacity).toBe(1);
  });

  it('destroys the instance on unmount', () => {
    const { unmount } = setup();
    const lightbox = pswp();
    expect(lightbox.destroy).not.toHaveBeenCalled();
    unmount();
    expect(lightbox.destroy).toHaveBeenCalledTimes(1);
  });

  it('opens at the staged index when the image is clicked', () => {
    setup({ index: 1 });
    fireEvent.click(stagedImage());
    expect(pswp().loadAndOpen).toHaveBeenCalledTimes(1);
    expect(pswp().loadAndOpen.mock.calls[0][0]).toBe(1);
  });

  it('opens from the keyboard as well as from a click', () => {
    setup({ index: 2 });
    fireEvent.keyDown(stagedImage(), { key: 'Enter' });
    expect(pswp().loadAndOpen).toHaveBeenCalledWith(2, expect.anything());
  });

  it('builds the dataSource from the filtered list, through the proxy', () => {
    // The page hands the lightbox the images the active chip is showing; a
    // dataSource built from the full list would let the fullscreen arrows walk
    // outside the filter and desync the index on close.
    const shown = [IMAGES[0], IMAGES[2]];
    setup({ images: shown, index: 0 });
    fireEvent.click(stagedImage());
    const data = pswp().loadAndOpen.mock.calls[0][1];
    expect(data).toHaveLength(2);
    expect(data.map((d) => d.src)).toEqual([
      '/api/album/1/artwork/100?size=full',
      '/api/album/1/artwork/300?size=full',
    ]);
    // The placeholder is the tile the grid already loaded.
    expect(data[1].msrc).toBe('/api/album/1/artwork/300?size=250');
    expect(data[1].alt).toBe('Booklet, Front artwork');
  });

  it('takes the slide size from the measured original when the API has one', () => {
    setup({ index: 0 });
    fireEvent.click(stagedImage());
    const data = pswp().loadAndOpen.mock.calls[0][1];
    expect(data[0]).toMatchObject({ width: 1425, height: 1425 });
    expect(data[2]).toMatchObject({ width: 2400, height: 1200 });
  });

  it('omits the slide size for an image nothing has measured yet', () => {
    setup({ index: 0 });
    fireEvent.click(stagedImage());
    const unmeasured = pswp().loadAndOpen.mock.calls[0][1][1];
    expect(unmeasured.width).toBeUndefined();
    expect(unmeasured.height).toBeUndefined();
  });

  it('derives the ratio from the staged rendition once it has loaded', () => {
    // CAA reports no dimensions and the original has not been fetched, so the
    // thumbnail the user is looking at is the only ratio available.
    setup({ index: 1 });
    const img = stagedImage();
    Object.defineProperty(img, 'naturalWidth', { value: 500 });
    Object.defineProperty(img, 'naturalHeight', { value: 250 });
    fireEvent.load(img);
    fireEvent.click(img);
    const data = pswp().loadAndOpen.mock.calls[0][1];
    expect(data[1].width / data[1].height).toBe(2);
    // Only the staged image was measured; the others are still unknown.
    expect(data[0]).toMatchObject({ width: 1425, height: 1425 });
  });

  // A slide whose size is only a ratio caps PhotoSwipe's zoom at the declared
  // long edge, which on a wide viewport sits *below* the fit zoom: the image
  // cannot be zoomed at all and a click closes the viewer. Found in the browser
  // (Task 20), so the correction is pinned here.
  function loadedSlide({ declared, natural }) {
    const slide = {
      width: declared[0],
      height: declared[1],
      data: { width: declared[0], height: declared[1] },
      resize: vi.fn(),
    };
    const content = {
      width: declared[0],
      height: declared[1],
      element: { naturalWidth: natural[0], naturalHeight: natural[1] },
    };
    return { slide, content };
  }

  it('corrects a ratio-only slide size from the loaded original', () => {
    setup({ index: 0 });
    fireEvent.click(stagedImage());
    const payload = loadedSlide({
      declared: [1200, 601],
      natural: [5389, 2700],
    });
    act(() => pswp().emit('loadComplete', payload));
    expect(payload.slide).toMatchObject({ width: 5389, height: 2700 });
    expect(payload.slide.data).toMatchObject({ width: 5389, height: 2700 });
    expect(payload.content).toMatchObject({ width: 5389, height: 2700 });
    // Zoom levels are derived at construction, so the slide has to recompute.
    expect(payload.slide.resize).toHaveBeenCalledTimes(1);
  });

  it('leaves a slide the API already measured untouched', () => {
    setup({ index: 0 });
    fireEvent.click(stagedImage());
    const payload = loadedSlide({
      declared: [1425, 1425],
      natural: [1425, 1425],
    });
    act(() => pswp().emit('loadComplete', payload));
    expect(payload.slide.resize).not.toHaveBeenCalled();
  });

  it('ignores a load event with nothing measurable on it', () => {
    setup({ index: 0 });
    fireEvent.click(stagedImage());
    const slide = { width: 1200, height: 601, resize: vi.fn() };
    // Non-image content, and a failed image, both arrive without a size.
    act(() => pswp().emit('loadComplete', { slide, content: {} }));
    act(() =>
      pswp().emit('loadComplete', {
        slide,
        content: { element: { naturalWidth: 0, naturalHeight: 0 } },
      })
    );
    act(() => pswp().emit('loadComplete', { content: undefined }));
    expect(slide.resize).not.toHaveBeenCalled();
    expect(slide).toMatchObject({ width: 1200, height: 601 });
  });

  it('writes the fullscreen index back into the page', () => {
    const { props } = setup({ index: 0 });
    fireEvent.click(stagedImage());
    pswp().pswp.currIndex = 2;
    act(() => pswp().emit('change'));
    expect(props.onIndex).toHaveBeenLastCalledWith(2);
  });

  it('suspends its own Escape and arrows while fullscreen is open', () => {
    const { props } = setup({ index: 0 });
    fireEvent.click(stagedImage());
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    // One Escape must not collapse both layers, one arrow must not advance
    // two frames — PhotoSwipe owns both keys while it is up.
    expect(props.onClose).not.toHaveBeenCalled();
    expect(props.onIndex).not.toHaveBeenCalled();
  });

  it('takes the keys back when fullscreen closes', () => {
    const { props } = setup({ index: 0 });
    fireEvent.click(stagedImage());
    // PhotoSwipe closing is a state change in the component, so it has to be
    // flushed before the re-bound listeners exist.
    act(() => pswp().emit('close'));
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(props.onIndex).toHaveBeenCalledWith(1);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalled();
  });

  it('keeps its own keys when the open was refused', () => {
    // `loadAndOpen` answers false when a gallery is already open; flagging
    // fullscreen anyway would leave the in-page layer deaf to Escape with
    // nothing on top of it.
    const { props } = setup({ index: 0 });
    pswp().loadAndOpen.mockReturnValue(false);
    fireEvent.click(stagedImage());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalled();
  });

  it('builds the instance even when there is nothing to stage', () => {
    // The hooks run before the empty-list early return; a conditional
    // instance would be a hook-order violation.
    setup({ images: [], index: 0 });
    expect(pswp().init).toHaveBeenCalledTimes(1);
    expect(pswp().loadAndOpen).not.toHaveBeenCalled();
  });
});
