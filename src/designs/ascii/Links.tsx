import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { prefersReducedMotion } from '../../lib/hooks';
import { useStore } from '../../lib/store';
import { useUi } from './ui';

/* ───────────────────────── Drawn links (brushing & linking) ─────────────────────────
 * Hover a message: a line is drawn, character by character, from the message to the edge of
 * the tree, ending at the row of each leaf it grew. Hover a leaf: the line runs back to its
 * message, and if that message is scrolled away the line points up or down to where it is.
 * Lines are rasterised on a character grid; where they meet, junctions (├ ┬ ┼ …) are merged.
 */

const LH = 18;
const U = 1;
const D = 2;
const L = 4;
const R = 8;
const BOX: Record<number, string> = {
  [L | R]: '─',
  [L]: '─',
  [R]: '─',
  [U | D]: '│',
  [U]: '│',
  [D]: '│',
  [R | D]: '╭',
  [L | D]: '╮',
  [U | R]: '╰',
  [U | L]: '╯',
  [U | D | R]: '├',
  [U | D | L]: '┤',
  [L | R | D]: '┬',
  [L | R | U]: '┴',
  [U | D | L | R]: '┼',
};

interface Cell {
  r: number;
  c: number;
  ch: string;
  i: number;
  color: string;
}

interface Path {
  /** Cell points, source first. */
  pts: [number, number][];
  color: string;
  /** Arrow drawn on the last cell. */
  head: string;
}

function rasterize(paths: Path[]): Cell[] {
  const cells = new Map<string, { r: number; c: number; m: number; i: number; color: string; ch?: string }>();
  const touch = (r: number, c: number, bit: number, i: number, color: string) => {
    const k = `${r}:${c}`;
    const x = cells.get(k);
    if (x) x.m |= bit;
    else cells.set(k, { r, c, m: bit, i, color });
  };
  for (const p of paths) {
    let i = 0;
    for (let s = 0; s < p.pts.length - 1; s++) {
      const [r0, c0] = p.pts[s];
      const [r1, c1] = p.pts[s + 1];
      if (r0 === r1 && c0 === c1) continue;
      if (r0 === r1) {
        const dir = Math.sign(c1 - c0);
        for (let c = c0; c !== c1; c += dir) {
          touch(r0, c, dir > 0 ? R : L, i++, p.color);
          touch(r0, c + dir, dir > 0 ? L : R, i, p.color);
        }
      } else {
        const dir = Math.sign(r1 - r0);
        for (let r = r0; r !== r1; r += dir) {
          touch(r, c0, dir > 0 ? D : U, i++, p.color);
          touch(r + dir, c0, dir > 0 ? U : D, i, p.color);
        }
      }
    }
    const [hr, hc] = p.pts[p.pts.length - 1];
    const end = cells.get(`${hr}:${hc}`);
    if (end) end.ch = p.head;
    else cells.set(`${hr}:${hc}`, { r: hr, c: hc, m: 0, i, color: p.color, ch: p.head });
  }
  return [...cells.values()].map((x) => ({ r: x.r, c: x.c, i: x.i, color: x.color, ch: x.ch ?? BOX[x.m] ?? '·' }));
}

/** Width of one character of the overlay font. */
function useCharWidth() {
  const [cw, setCw] = useState(7.8);
  useEffect(() => {
    const s = document.createElement('span');
    s.className = 'a-links-probe';
    s.textContent = '0000000000';
    document.querySelector('.ascii')?.appendChild(s);
    setCw(s.getBoundingClientRect().width / 10 || 7.8);
    s.remove();
  }, []);
  return cw;
}

export function Links() {
  const { state, liveTree } = useStore();
  const { link } = useUi();
  const cw = useCharWidth();
  const [cells, setCells] = useState<Cell[]>([]);
  const last = useRef('');
  const on = Boolean(link) && state.settings.enabled && state.panelOpen && !state.forest.open;

  useEffect(() => {
    if (!on || !link) {
      last.current = '';
      setCells([]);
      return;
    }
    const scoreOf = new Map(liveTree.branches.flatMap((b) => b.leaves.map((l) => [l.id, l.score] as const)));
    const colorOf = (leaf: string) => ((scoreOf.get(leaf) ?? 0) > 0 ? 'var(--you)' : 'var(--ai)');
    let raf = 0;

    const compute = () => {
      const pane = document.querySelector<HTMLElement>('.a-pane');
      const chat = document.querySelector<HTMLElement>('.a-scroll');
      const treeBox = document.querySelector<HTMLElement>('.a-tree-scroll');
      if (!pane || !chat || !treeBox) return [];
      const pr = pane.getBoundingClientRect();
      const cr = chat.getBoundingClientRect();
      const tr = treeBox.getBoundingClientRect();
      const col = (x: number) => Math.round(x / cw);
      const row = (y: number) => Math.floor(y / LH);
      const edge = col(pr.left) - 1; // last column before the pane
      const bus = edge - 4;

      /** Message anchor: right of its text column, on its first line (or the chat edge if scrolled away). */
      const msgAt = (id: string): { r: number; c: number; head: string } | null => {
        const body = document.querySelector<HTMLElement>(`#a-msg-${CSS.escape(id)} .a-body`);
        if (!body) return null;
        const b = body.getBoundingClientRect();
        const c = Math.min(bus - 2, col(b.right) + 1);
        if (b.top + 8 < cr.top) return { r: row(cr.top) + 1, c, head: '▴' };
        if (b.top + 8 > cr.bottom) return { r: row(cr.bottom) - 1, c, head: '▾' };
        return { r: row(b.top + 10), c, head: '◂' };
      };
      const leafRow = (id: string) => {
        const el = pane.querySelector<HTMLElement>(`[data-leaf="${CSS.escape(id)}"]`);
        if (!el) return null;
        const y = el.getBoundingClientRect().top + 9;
        return row(Math.max(tr.top + 9, Math.min(tr.bottom - 9, y)));
      };

      const paths: Path[] = [];
      if (link.kind === 'message') {
        const m = state.messages.find((x) => x.id === link.id);
        const start = msgAt(link.id);
        if (!m || !start) return [];
        for (const leaf of m.conceptIds) {
          const lr = leafRow(leaf);
          if (lr === null) continue;
          paths.push({
            pts: [
              [start.r, start.c],
              [start.r, bus],
              [lr, bus],
              [lr, edge],
            ],
            color: colorOf(leaf),
            head: '▸',
          });
        }
      } else if (link.messageId) {
        const lr = leafRow(link.id);
        const end = msgAt(link.messageId);
        if (lr === null || !end) return [];
        paths.push({
          pts: [
            [lr, edge],
            [lr, bus],
            [end.r, bus],
            [end.r, end.c],
          ],
          color: colorOf(link.id),
          head: end.head,
        });
      }
      return rasterize(paths);
    };

    // Follow the layout while things move (scrolling, the tree gliding, streaming text).
    const loop = () => {
      const next = compute();
      const key = next.map((x) => `${x.r},${x.c},${x.ch}`).join('|');
      if (key !== last.current) {
        last.current = key;
        setCells(next);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [on, link, cw, state.messages, liveTree]);

  if (!cells.length) return null;
  const still = prefersReducedMotion();
  return (
    <div className="a-links" aria-hidden="true" key={link ? `${link.kind}:${link.id}` : ''}>
      {cells.map((x) => (
        <span
          key={`${x.r}:${x.c}`}
          style={
            {
              left: x.c * cw,
              top: x.r * LH,
              width: cw,
              color: x.color,
              animationDelay: still ? '0ms' : `${x.i * 7}ms`,
            } as CSSProperties
          }
        >
          {x.ch}
        </span>
      ))}
    </div>
  );
}
