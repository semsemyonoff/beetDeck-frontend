export const CONCURRENCY = 6;

export async function runLyricsFetchQueue({
  albumId,
  itemIds,
  signal,
  onProgress,
  onTrackResult,
  concurrency = CONCURRENCY,
}) {
  const total = itemIds.length;
  let done = 0;
  const remaining = [...itemIds];

  function reportError(itemId) {
    onTrackResult({
      itemId,
      status: 'error',
      found: false,
      newLyrics: null,
      newSynced: null,
      newBackend: null,
      currentLyrics: null,
      currentSource: null,
    });
    done++;
    onProgress(done, total);
  }

  async function fetchOne(itemId) {
    try {
      const resp = await fetch(
        `/api/album/${albumId}/track/${itemId}/lyrics/fetch`,
        { method: 'POST', signal }
      );
      let data = null;
      try {
        data = await resp.json();
      } catch {
        // ignore JSON parse error
      }
      // A response that lands after the run was aborted (e.g. the modal was
      // closed mid-flight) must not report — it would mutate state the caller
      // has already torn down.
      if (signal?.aborted) return;
      if (!resp.ok) {
        reportError(itemId);
        return;
      }
      onTrackResult({
        itemId,
        found: data?.found ?? false,
        newLyrics: data?.new_lyrics ?? null,
        newSynced: data?.new_synced ?? null,
        newBackend: data?.new_backend ?? null,
        currentLyrics: data?.current_lyrics ?? null,
        currentSource: data?.current_source ?? null,
      });
      done++;
      onProgress(done, total);
    } catch (err) {
      // Same teardown guard as the success path: a request that fails (for any
      // reason, not just AbortError) after the run was aborted must not report.
      if (signal?.aborted || err.name === 'AbortError') return;
      reportError(itemId);
    }
  }

  await new Promise((resolve) => {
    let active = 0;

    function tryNext() {
      while (active < concurrency && remaining.length > 0 && !signal?.aborted) {
        const itemId = remaining.shift();
        active++;
        fetchOne(itemId).finally(() => {
          active--;
          tryNext();
        });
      }
      if (signal?.aborted) remaining.length = 0;
      if (active === 0 && remaining.length === 0) resolve();
    }

    if (total === 0) {
      resolve();
      return;
    }
    tryNext();
  });
}
