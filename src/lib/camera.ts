import { useCallback, useRef, useState } from 'react';
import type { Bounds } from './layout';
import { prefersReducedMotion } from './hooks';

export interface Cam {
  x: number;
  y: number;
  k: number;
}

export interface Size {
  w: number;
  h: number;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const K_MIN = 0.2;
export const K_MAX = 3;

export function fitTarget(
  b: Bounds,
  size: Size,
  opts: { pad?: number; right?: number; top?: number; maxK?: number } = {},
): Cam {
  const pad = opts.pad ?? 40;
  const right = opts.right ?? 0;
  const topInset = opts.top ?? 0;
  const vw = Math.max(50, size.w - right - pad * 2);
  const vh = Math.max(50, size.h - topInset - pad * 2);
  const k = clamp(Math.min(vw / (b.x1 - b.x0), vh / (b.y1 - b.y0)), K_MIN, opts.maxK ?? K_MAX);
  const cx = (b.x0 + b.x1) / 2;
  const cy = (b.y0 + b.y1) / 2;
  return { k, x: pad + vw / 2 - cx * k, y: topInset + pad + vh / 2 - cy * k };
}

/** A tiny 2D camera: smooth fly-to (log-scale zoom), zoom around a point, pan. */
export function useCamera(sizeRef: React.RefObject<Size>) {
  const [cam, setCam] = useState<Cam>({ x: 0, y: 0, k: 1 });
  const camRef = useRef(cam);
  const raf = useRef(0);

  const set = useCallback((c: Cam) => {
    cancelAnimationFrame(raf.current);
    camRef.current = c;
    setCam(c);
  }, []);

  const animateTo = useCallback(
    (to: Cam, duration = 750) => {
      cancelAnimationFrame(raf.current);
      if (prefersReducedMotion()) return set(to);
      const from = camRef.current;
      const { w, h } = sizeRef.current;
      const fc = { x: (w / 2 - from.x) / from.k, y: (h / 2 - from.y) / from.k };
      const tc = { x: (w / 2 - to.x) / to.k, y: (h / 2 - to.y) / to.k };
      const t0 = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / duration);
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        const k = from.k * Math.pow(to.k / from.k, e);
        const cx = fc.x + (tc.x - fc.x) * e;
        const cy = fc.y + (tc.y - fc.y) * e;
        const c = { k, x: w / 2 - cx * k, y: h / 2 - cy * k };
        camRef.current = c;
        setCam(c);
        if (t < 1) raf.current = requestAnimationFrame(step);
      };
      raf.current = requestAnimationFrame(step);
    },
    [set, sizeRef],
  );

  const zoomAt = useCallback(
    (px: number, py: number, factor: number) => {
      const c = camRef.current;
      const k = clamp(c.k * factor, K_MIN, K_MAX);
      set({ k, x: px - (px - c.x) * (k / c.k), y: py - (py - c.y) * (k / c.k) });
    },
    [set],
  );

  const panBy = useCallback(
    (dx: number, dy: number) => {
      const c = camRef.current;
      set({ ...c, x: c.x + dx, y: c.y + dy });
    },
    [set],
  );

  return { cam, camRef, set, animateTo, zoomAt, panBy };
}
