/** Coalesce pointer movement, while preserving every sample when drawing freehand. */
export function createFrameQueue<T>(
  consume: (event: T) => void,
  schedule: (callback: () => void) => number,
  cancelFrame: (id: number) => void,
  keepAll = false,
) {
  let frame: number | null = null;
  let pending: T[] = [];
  const flush = () => {
    if (frame !== null) cancelFrame(frame);
    frame = null;
    const events = pending;
    pending = [];
    events.forEach(consume);
  };
  return {
    push(event: T) {
      if (keepAll) pending.push(event);
      else pending = [event];
      if (frame === null) frame = schedule(flush);
    },
    flush,
    cancel() {
      if (frame !== null) cancelFrame(frame);
      frame = null;
      pending = [];
    },
  };
}
