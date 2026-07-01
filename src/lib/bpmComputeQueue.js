export const CONCURRENCY = 2;

export async function runBpmComputeQueue({
  albumId,
  itemIds,
  signal,
  onTrackStart,
  onProgress,
  onTrackResult,
  concurrency = CONCURRENCY,
}) {
  const total = itemIds.length;
  let done = 0;
  const remaining = [...itemIds];

  async function computeOne(itemId) {
    onTrackStart(itemId);
    try {
      // signal is intentionally NOT forwarded to fetch: BPM compute is a write
      // (autobpm mutates the file and the beets DB). Aborting a write mid-flight
      // is not idempotent. Abort only stops dequeuing new pending tracks; any
      // request already in flight runs to completion and reports its result.
      const resp = await fetch(
        `/api/album/${albumId}/track/${itemId}/bpm/compute`,
        { method: 'POST' }
      );
      let data = null;
      try {
        data = await resp.json();
      } catch {
        // ignore JSON parse error
      }
      if (!resp.ok) {
        onTrackResult(itemId, { error: true });
      } else {
        onTrackResult(itemId, { bpm: data?.bpm ?? null });
      }
    } catch {
      onTrackResult(itemId, { error: true });
    }
    done++;
    onProgress(done, total);
  }

  await new Promise((resolve) => {
    let active = 0;

    function tryNext() {
      while (active < concurrency && remaining.length > 0 && !signal?.aborted) {
        const itemId = remaining.shift();
        active++;
        computeOne(itemId).finally(() => {
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
