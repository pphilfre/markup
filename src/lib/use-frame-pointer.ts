"use client";
import { useCallback, useLayoutEffect, useRef } from "react";
import { createFrameQueue } from "./frame-queue";
export function useFramePointer<T>(
  consume: (event: T) => void,
  keepAll = false,
) {
  const latest = useRef(consume);
  useLayoutEffect(() => {
    latest.current = consume;
  }, [consume]);
  const queue = useRef<ReturnType<typeof createFrameQueue<T>> | null>(null);
  useLayoutEffect(() => {
    const current = createFrameQueue<T>(
      (event) => latest.current(event),
      (callback) => requestAnimationFrame(callback),
      (id) => cancelAnimationFrame(id),
      keepAll,
    );
    queue.current = current;
    return () => {
      current.cancel();
      queue.current = null;
    };
  }, [keepAll]);
  const push = useCallback((event: T) => {
    queue.current?.push(event);
  }, []);
  const flush = useCallback(() => {
    queue.current?.flush();
  }, []);
  return { push, flush };
}
