/** Fit a label into a pixel width using real text metrics (falls back to a char estimate). */
let ctx: CanvasRenderingContext2D | null | undefined;
const cache = new Map<string, string>();

export function measure(text: string, font: string): number {
  if (ctx === undefined) ctx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  if (!ctx) return text.length * 6.4;
  ctx.font = font;
  return ctx.measureText(text).width;
}

export function fitText(text: string, maxWidth: number, font: string): string {
  const key = `${font}|${maxWidth}|${text}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let out = text;
  if (measure(text, font) > maxWidth) {
    let lo = 1;
    let hi = text.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (measure(`${text.slice(0, mid).trimEnd()}…`, font) <= maxWidth) lo = mid;
      else hi = mid - 1;
    }
    out = `${text.slice(0, lo).trimEnd()}…`;
  }
  cache.set(key, out);
  return out;
}

export const LEAF_FONT = '400 12px Inter, -apple-system, system-ui, sans-serif';
export const BRANCH_FONT = '600 12.5px Inter, -apple-system, system-ui, sans-serif';
