import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react';
import './ascii-tree.css';
import { asciiOutline, asciiTree, type AsciiTree, type TreeNode } from '../lib/asciiTree';
import { prefersReducedMotion, useSize } from '../lib/hooks';
import { MODE_META, pct, scoreToMode } from '../lib/modes';
import { FALLEN, eroded } from '../lib/retention';
import type { TreeData } from '../lib/types';

/* The knowledge tree as ASCII art (layout in lib/asciiTree.ts, styles under "ASCII tree" in styles.css).
 *
 * Motion, all of it switched off for prefers-reduced-motion:
 *   grow-in   — title types itself, roots spread, trunk rises, limbs reach out, leaves pop, labels type
 *   sprout    — a new concept grows its twig and bursts into a leaf; the tree glides to its new shape
 *   fill      — when a leaf becomes more yours, its pie sweeps and it bursts again
 *   hover     — the leaf springs up, sap lights its path down to the roots, an info card unfolds
 *   cursor    — wood near the pointer leans away from it
 *   breeze    — now and then a gust bends the crown
 *   numbers   — the concept count and share scramble before settling
 *   morph     — switching tree ↔ outline glides every node to its new place
 *   fading    — with `retention`, letters drop out of labels and forgotten leaves fall to the ground
 */

/** Line height in px; keep in sync with --at-lh in styles.css. */
const LH = 18;
const PAD = 16;
const RADIUS = 54;

interface Props {
  tree: TreeData;
  /** Leaves to light up (brushing from the chat, or the hovered leaf). */
  highlight: Set<string>;
  onHover: (leafId: string | null) => void;
  onJump: (messageId: string) => void;
  /** 'tree' (default) or a `tree`-command outline of the same nodes. */
  view?: 'tree' | 'outline';
  /** Leaf id → share likely remembered (0..1). Omit to show no fading. */
  retention?: Map<string, number>;
  /** Extra keys on a focused node (arrows, Home/End and Enter are handled here). */
  onNodeKey?: (node: TreeNode, e: KeyboardEvent<HTMLButtonElement>) => void;
  className?: string;
}

interface Burst {
  id: number;
  nodeId: string;
  delay: number;
}

const modeColor = (score: number) => (score > 0 ? 'var(--you)' : 'var(--ai)');

export function AsciiTreeView({ tree, highlight, onHover, onJump, view = 'tree', retention, onNodeKey, className = '' }: Props) {
  const outer = useRef<HTMLDivElement>(null);
  const probe = useRef<HTMLSpanElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const { w } = useSize(outer);
  const { w: probeW } = useSize(probe);
  const chPx = probeW ? probeW / 10 : 7.2;
  const cols = Math.max(28, Math.floor((w - PAD * 2) / chPx));
  // Wait for the probe to measure the font, so the tree grows in once, at the right width.
  const ready = w > 0 && probeW > 0;
  const layout = useMemo(
    () => (ready ? (view === 'outline' ? asciiOutline(tree, cols) : asciiTree(tree, cols)) : null),
    [tree, cols, ready, view],
  );
  const reduced = useMemo(() => prefersReducedMotion(), []);

  const step = layout ? Math.min(34, Math.max(12, 1700 / layout.maxT)) : 20;
  const born = useRef(false);
  const delays = useRef(new Map<string, number>());

  // Each character keeps the animation delay it was given when it first appeared, so later
  // re-renders never restart it. Characters that appear later grow in from their own start.
  const delayOf = useMemo(() => {
    const map = delays.current;
    if (!layout) return map;
    const all: [string, number][] = [
      ...layout.wood.map((x): [string, number] => [x.key, x.t]),
      ...layout.nodes.map((n): [string, number] => [n.key, n.t]),
      ['meta', layout.meta.t],
    ];
    const fresh = all.filter(([k]) => !map.has(k));
    if (fresh.length) {
      const from = born.current ? Math.min(...fresh.map(([, t]) => t)) : 0;
      for (const [k, t] of fresh) map.set(k, Math.round(Math.max(0, t - from) * step));
    }
    return map;
  }, [layout, step]);

  /* ───── Sprouts and fills: particle bursts ───── */
  const [bursts, setBursts] = useState<Burst[]>([]);
  const prevScores = useRef(new Map<string, number>());
  const nodeEls = useRef(new Map<string, HTMLButtonElement>());
  useEffect(() => {
    if (!layout) return;
    const prev = prevScores.current;
    const fresh: Burst[] = [];
    for (const n of layout.nodes) {
      if (n.kind !== 'leaf') continue;
      const before = prev.get(n.id);
      if (born.current && (before === undefined || n.score > before + 0.01)) {
        const delay = before === undefined ? (delayOf.get(n.key) ?? 0) : 0;
        fresh.push({ id: Math.random(), nodeId: n.id, delay });
        if (before === undefined) {
          window.setTimeout(() => nodeEls.current.get(n.key)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), delay);
        }
      }
      prev.set(n.id, n.score);
    }
    born.current = true;
    if (!fresh.length || reduced) return;
    setBursts((b) => [...b, ...fresh]);
    const ids = new Set(fresh.map((f) => f.id));
    const longest = Math.max(...fresh.map((f) => f.delay)) + 1000;
    const timer = window.setTimeout(() => setBursts((b) => b.filter((x) => !ids.has(x.id))), longest);
    return () => clearTimeout(timer);
  }, [layout, delayOf, reduced]);

  /* ───── Hover and brushing ───── */
  const [hover, setHover] = useState<{ key: string; roomAbove: number } | null>(null);
  const hovered = (hover && layout?.nodes.find((n) => n.key === hover.key)) ?? null;
  const enter = (n: TreeNode) => {
    // Rows of free space above the tree (inside the scroll area), so a card can open upwards.
    const scroller = outer.current?.parentElement;
    const room = scroller && grid.current ? grid.current.getBoundingClientRect().top - scroller.getBoundingClientRect().top : 0;
    setHover({ key: n.key, roomAbove: Math.max(0, Math.floor(room / LH)) });
    onHover(n.kind === 'leaf' ? n.id : null);
  };
  const leave = () => {
    setHover(null);
    onHover(null);
  };

  const lit = useMemo(() => {
    const m = new Map<string, number>();
    if (!layout) return m;
    const add = (id: string) => {
      for (const { key, d } of layout.paths[id] ?? []) m.set(key, Math.min(d, m.get(key) ?? Infinity));
    };
    highlight.forEach(add);
    if (hovered?.kind === 'leaf') add(hovered.id);
    if (hovered?.kind === 'branch') {
      add(hovered.id);
      add(`sub:${hovered.id}`);
    }
    return m;
  }, [layout, highlight, hovered]);

  const related = useMemo(() => {
    const s = new Set<string>();
    if (!layout) return s;
    for (const n of layout.nodes) {
      if (n.kind === 'leaf' && highlight.has(n.id)) {
        s.add(n.key);
        s.add(`n:${n.branchId}`);
      }
    }
    if (hovered) {
      s.add(hovered.key);
      s.add(`n:${hovered.branchId}`);
      if (hovered.kind === 'branch') for (const n of layout.nodes) if (n.branchId === hovered.id) s.add(n.key);
    }
    return s;
  }, [layout, highlight, hovered]);

  const focusNode = hovered ?? layout?.nodes.find((n) => n.kind === 'leaf' && highlight.has(n.id)) ?? null;
  const focusing = lit.size > 0 || hovered !== null;

  /* ───── Cursor: nearby wood leans away ───── */
  const woodEls = useRef(new Map<string, HTMLSpanElement>());
  const near = useRef(new Set<HTMLSpanElement>());
  const raf = useRef(0);
  const settle = () => {
    for (const el of near.current) {
      el.style.translate = '';
      el.style.removeProperty('--near');
    }
    near.current = new Set();
  };
  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    if (reduced || !layout || !grid.current) return;
    const box = grid.current.getBoundingClientRect();
    const mx = e.clientX - box.left;
    const my = e.clientY - box.top;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const next = new Set<HTMLSpanElement>();
      for (const x of layout.wood) {
        const el = woodEls.current.get(x.key);
        if (!el) continue;
        const dx = (x.c + 0.5) * chPx - mx;
        const dy = (x.r + 0.5) * LH - my;
        const dist = Math.hypot(dx, dy);
        if (dist >= RADIUS) continue;
        const f = (1 - dist / RADIUS) ** 2;
        const push = (f * 6) / Math.max(dist, 1);
        el.style.translate = `${(dx * push).toFixed(2)}px ${(dy * push).toFixed(2)}px`;
        el.style.setProperty('--near', f.toFixed(3));
        next.add(el);
      }
      for (const el of near.current) {
        if (next.has(el)) continue;
        el.style.translate = '';
        el.style.removeProperty('--near');
      }
      near.current = next;
    });
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  /* ───── Breeze: every so often a gust bends the crown ───── */
  const glyphEls = useRef(new Map<string, HTMLSpanElement>());
  const retentionRef = useRef(retention);
  retentionRef.current = retention;
  // A gust in progress would hold a forgotten leaf in the air: stop it so the leaf can fall.
  useEffect(() => {
    if (!retention || !layout) return;
    for (const n of layout.nodes) {
      if ((retention.get(n.id) ?? 1) >= FALLEN) continue;
      for (const a of glyphEls.current.get(n.key)?.getAnimations() ?? []) {
        if (!(a instanceof CSSTransition) && !(a instanceof CSSAnimation)) a.cancel();
      }
    }
  }, [retention, layout]);
  useEffect(() => {
    if (!layout || reduced) return;
    let timer = 0;
    const gust = () => {
      if (!document.hidden) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        const at = (c: number) => (dir > 0 ? c : layout.cols - c) * 20;
        for (const x of layout.wood) {
          const el = woodEls.current.get(x.key);
          if (!el) continue;
          if (x.kind === 'ground') {
            el.animate([{ opacity: 1 }, { opacity: 0.35 }, { opacity: 1 }], { duration: 1400, delay: at(x.c), easing: 'ease-in-out' });
          } else if (x.h > 0.08) {
            const deg = dir * x.h * 11;
            el.animate([{ rotate: '0deg' }, { rotate: `${deg}deg` }, { rotate: `${-deg * 0.35}deg` }, { rotate: '0deg' }], {
              duration: 1900,
              delay: at(x.c),
              easing: 'ease-in-out',
            });
          }
        }
        for (const n of layout.nodes) {
          if ((retentionRef.current?.get(n.id) ?? 1) < FALLEN) continue;
          glyphEls.current.get(n.key)?.animate([{ translate: '0 0' }, { translate: `${dir * 1.5}px -1px` }, { translate: '0 0' }], {
            duration: 1700,
            delay: at(n.c) + 80,
            easing: 'ease-in-out',
          });
        }
      }
      timer = window.setTimeout(gust, 9000 + Math.random() * 7000);
    };
    timer = window.setTimeout(gust, 1700 + layout.maxT * step);
    return () => clearTimeout(timer);
  }, [layout, reduced, step]);

  const meta = useScramble(layout?.meta.text ?? '');

  /* ───── Keyboard: arrows walk the nodes in reading order ───── */
  const onKey = (n: TreeNode, e: KeyboardEvent<HTMLButtonElement>) => {
    if (!layout) return;
    const order = [...layout.nodes].sort((a, b) => a.r - b.r || a.c - b.c);
    const i = order.findIndex((x) => x.key === n.key);
    const go = (j: number) => {
      e.preventDefault();
      nodeEls.current.get(order[Math.max(0, Math.min(order.length - 1, j))].key)?.focus();
    };
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') return go(i - 1);
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') return go(i + 1);
    if (e.key === 'Home') return go(0);
    if (e.key === 'End') return go(order.length - 1);
    onNodeKey?.(n, e);
  };

  const probeEl = (
    <span className="at-probe" ref={probe} aria-hidden="true">
      0000000000
    </span>
  );
  if (!ready || !layout) {
    return (
      <div className={`at-wrap${ready ? ' at-empty' : ''} ${className}`} ref={outer}>
        {probeEl}
        {ready && (
          <>
            <pre className="at-seed" aria-hidden="true">
              {'   .\n  \\|/\n~~~~~~~'}
            </pre>
            <p>Your tree grows as you explore topics in this chat.</p>
          </>
        )}
      </div>
    );
  }

  const charStep = step * 0.55;
  const gridStyle = {
    width: `${layout.cols}ch`,
    height: layout.rows * LH,
    '--lit': focusNode ? modeColor(focusNode.score) : 'var(--you)',
  } as CSSProperties;

  return (
    <div className={`at-wrap is-${layout.view} ${className}`} ref={outer}>
      {probeEl}
      <div
        ref={grid}
        className={`at-grid${focusing ? ' focusing' : ''}`}
        style={gridStyle}
        role="group"
        aria-label={`Knowledge tree for ${tree.title}: ${layout.count} concepts, ${pct(layout.score)}% your thinking`}
        onMouseMove={onMove}
        onMouseLeave={settle}
      >
        {layout.wood.map((x) => {
          const d = lit.get(x.key);
          return (
            <span
              key={x.key}
              ref={(el) => {
                if (el) woodEls.current.set(x.key, el);
                else woodEls.current.delete(x.key);
              }}
              className={`at-w k-${x.kind}${d !== undefined ? ' lit' : ''}`}
              style={{ left: `${x.c}ch`, top: x.r * LH, animationDelay: `${delayOf.get(x.key) ?? 0}ms`, '--d': d ?? 0 } as CSSProperties}
              aria-hidden="true"
            >
              {x.ch}
            </span>
          );
        })}

        {layout.nodes.map((n) => {
          const delay = delayOf.get(n.key) ?? 0;
          const chars = [...n.label];
          const keep = nodeRetention(n, retention, tree);
          const gone = n.kind === 'leaf' && keep < 1 ? eroded(n.label, n.id, keep) : null;
          const fallen = n.kind === 'leaf' && keep < FALLEN;
          const fall = fallen && layout.ground !== null ? (layout.ground - n.r) * LH : 0;
          const label = (
            <span className="at-label">
              {chars.map((ch, i) => (
                <span
                  key={i}
                  className={gone?.[i] ? 'er' : undefined}
                  style={{ animationDelay: `${delay + (1 + (n.side > 0 ? i : chars.length - 1 - i)) * charStep}ms` }}
                >
                  {gone?.[i] ? '·' : ch}
                </span>
              ))}
            </span>
          );
          const glyph = (
            <span
              className={`at-glyph${keep < 0.6 ? ' fading' : ''}${fallen ? ' fallen' : ''}`}
              style={{ animationDelay: `${delay}ms`, '--fall': `${fall}px`, '--spin': `${(hashKey(n.id) - 0.5) * 300}deg` } as CSSProperties}
              ref={(el) => {
                if (el) glyphEls.current.set(n.key, el);
                else glyphEls.current.delete(n.key);
              }}
            >
              <PieGlyph score={n.score} />
            </span>
          );
          const left = n.side > 0 ? n.c : n.c - 1 - chars.length;
          const isHover = hovered?.key === n.key;
          const isHl = n.kind === 'leaf' && highlight.has(n.id);
          const mode = MODE_META[scoreToMode(n.score)].label;
          return (
            <button
              key={n.key}
              ref={(el) => {
                if (el) nodeEls.current.set(n.key, el);
                else nodeEls.current.delete(n.key);
              }}
              data-leaf={n.kind === 'leaf' ? n.id : undefined}
              onKeyDown={(e) => onKey(n, e)}
              className={`at-node k-${n.kind}${isHover ? ' is-hover' : ''}${isHl ? ' is-hl' : ''}${related.has(n.key) ? ' rel' : ''}`}
              style={{ left: `${left}ch`, top: n.r * LH } as CSSProperties}
              aria-label={
                n.kind === 'leaf'
                  ? `${n.fullLabel}: ${mode}, ${n.count} message${n.count === 1 ? '' : 's'}. Jump to message`
                  : `${n.fullLabel}: ${n.count} concept${n.count === 1 ? '' : 's'}, ${pct(n.score)}% your thinking`
              }
              onMouseEnter={() => enter(n)}
              onMouseLeave={leave}
              onFocus={() => enter(n)}
              onBlur={leave}
              onClick={() => n.messageId && onJump(n.messageId)}
            >
              {n.side > 0 ? (
                <>
                  {glyph} {label}
                </>
              ) : (
                <>
                  {label} {glyph}
                </>
              )}
            </button>
          );
        })}

        <div className="at-title" style={{ left: `${layout.title.c}ch`, top: layout.title.r * LH }} aria-hidden="true">
          {[...layout.title.text].map((ch, i) => (
            <span key={i} style={{ animationDelay: `${i * step * 0.9}ms` }}>
              {ch}
            </span>
          ))}
          <span
            className="at-cursor"
            style={{ '--len': layout.title.text.length, '--dur': `${layout.title.text.length * step * 0.9}ms` } as CSSProperties}
          >
            ▍
          </span>
        </div>
        <div
          className="at-meta"
          style={{ left: `${layout.meta.c}ch`, top: layout.meta.r * LH, animationDelay: `${delayOf.get('meta') ?? 0}ms` }}
          aria-hidden="true"
        >
          {meta}
        </div>

        {bursts.map((b) => {
          const n = layout.nodes.find((x) => x.kind === 'leaf' && x.id === b.nodeId);
          return n ? <Sparks key={b.id} node={n} delay={b.delay} /> : null;
        })}

        {hovered && hover && (
          <NodeCard
            key={hovered.key}
            node={hovered}
            layout={layout}
            tree={tree}
            roomAbove={hover.roomAbove}
            keep={retention ? nodeRetention(hovered, retention, tree) : 1}
          />
        )}
      </div>
    </div>
  );
}

/** Pie-filled glyph; the fill sweeps when the share changes. */
function PieGlyph({ score }: { score: number }) {
  const c = 2 * Math.PI * 2.5;
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true">
      <circle className={`at-ring ${score > 0 ? 'is-you' : 'is-ai'}`} cx="6" cy="6" r="5" />
      <circle
        className="at-fill"
        cx="6"
        cy="6"
        r="2.5"
        strokeWidth="5"
        strokeDasharray={`${Math.min(1, score) * c} ${c}`}
        transform="rotate(-90 6 6)"
      />
    </svg>
  );
}

const SPARK_CHARS = ['*', '+', '·', "'", '*', '.', '+', '`'];

function Sparks({ node, delay }: { node: TreeNode; delay: number }) {
  return (
    <span className="at-sparks" style={{ left: `${node.c}ch`, top: node.r * LH, color: modeColor(node.score) }} aria-hidden="true">
      {SPARK_CHARS.map((ch, i) => {
        const a = (i / SPARK_CHARS.length) * Math.PI * 2 + 0.4;
        const r = 16 + (i % 3) * 6;
        return (
          <span
            key={i}
            style={{ '--dx': `${Math.cos(a) * r}px`, '--dy': `${Math.sin(a) * r * 0.8}px`, animationDelay: `${delay + (i % 2) * 40}ms` } as CSSProperties}
          >
            {ch}
          </span>
        );
      })}
    </span>
  );
}

/**
 * A box-drawn card that unfolds from the hovered node. It opens where the tree is dimmed, never
 * over the lit path: above a leaf (its path runs downwards), beside a branch on the far side of the trunk.
 */
function NodeCard({
  node,
  layout,
  tree,
  roomAbove,
  keep,
}: {
  node: TreeNode;
  layout: AsciiTree;
  tree: TreeData;
  roomAbove: number;
  keep: number;
}) {
  const G = '\u0000'; // where the glyph goes
  const branch = tree.branches.find((b) => b.id === node.branchId);
  const fading =
    keep >= 0.995 ? [] : keep < FALLEN ? ['likely forgotten — revisit it'] : [`~${pct(keep)}% likely remembered`];
  const body =
    node.kind === 'leaf'
      ? [
          `${G} ${MODE_META[scoreToMode(node.score)].label.toLowerCase()}`,
          `${branch?.label.toLowerCase() ?? ''} · ${node.count} message${node.count === 1 ? '' : 's'}`,
          ...fading,
          node.messageId ? '→ click to jump to it' : '',
        ].filter(Boolean)
      : [`${G} ${pct(node.score)}% your thinking`, `${node.count} concept${node.count === 1 ? '' : 's'} on this branch`];
  const max = layout.cols;
  const fit = (s: string, n: number) => (s.length > n ? `${s.slice(0, Math.max(1, n - 1))}…` : s);
  const width = Math.min(max, Math.max(node.fullLabel.length + 6, ...body.map((l) => l.length + 4)));
  const title = fit(node.fullLabel.toLowerCase(), width - 6);
  const lines = body.map((l) => fit(l, width - 4));

  const h = lines.length + 2;
  const clampX = (x: number) => Math.max(0, Math.min(max - width, x));
  let row: number;
  let left: number;
  let from: string;
  if (node.kind === 'leaf') {
    const above = node.r - h >= -roomAbove;
    const rightward = node.side > 0;
    row = above ? node.r - h : node.r + 1;
    left = clampX(rightward ? node.c : node.c + 1 - width);
    // Unfold from the corner nearest the leaf.
    from = above ? (rightward ? 'inset(100% 100% 0 0)' : 'inset(100% 0 0 100%)') : rightward ? 'inset(0 100% 100% 0)' : 'inset(0 0 100% 100%)';
  } else {
    const far = node.side > 0 ? layout.trunk - 3 - width : layout.trunk + 4;
    const crown = Math.min(node.r, ...layout.nodes.filter((n) => n.branchId === node.id).map((n) => n.r));
    if (far >= 0 && far + width <= max) {
      // Beside the trunk, unfolding outwards from it.
      row = Math.max(-roomAbove, Math.min(layout.rows - h, node.r - Math.floor(h / 2)));
      left = far;
      from = node.side > 0 ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)';
    } else {
      // No room there: above the branch's highest leaf.
      row = Math.max(-roomAbove, crown - h);
      left = clampX(node.side > 0 ? node.c : node.c + 1 - width);
      from = node.side > 0 ? 'inset(100% 100% 0 0)' : 'inset(100% 0 0 100%)';
    }
  }
  const top = row * LH;

  return (
    <div className="at-card" role="tooltip" style={{ left: `${left}ch`, top, '--from': from, '--lit': modeColor(node.score) } as CSSProperties}>
      <div className="at-card-line">
        <span className="at-card-b">┌─ </span>
        <strong>{title}</strong>
        <span className="at-card-b"> {'─'.repeat(Math.max(1, width - 5 - title.length))}┐</span>
      </div>
      {lines.map((l, i) => (
        <div className="at-card-line is-body" key={i} style={{ '--i': i + 1 } as CSSProperties}>
          <span className="at-card-b">│ </span>
          {l.startsWith(G) ? (
            <>
              <span className="at-glyph">
                <PieGlyph score={node.score} />
              </span>
              {l.slice(1)}
            </>
          ) : (
            l
          )}
          {' '.repeat(Math.max(0, width - 4 - l.length))}
          <span className="at-card-b"> │</span>
        </div>
      ))}
      <div className="at-card-line">
        <span className="at-card-b">└{'─'.repeat(width - 2)}┘</span>
      </div>
    </div>
  );
}

/** A leaf's retention, or a branch's average over its leaves. */
function nodeRetention(n: TreeNode, retention: Map<string, number> | undefined, tree: TreeData): number {
  if (!retention) return 1;
  if (n.kind === 'leaf') return retention.get(n.id) ?? 1;
  const b = tree.branches.find((x) => x.id === n.id);
  if (!b?.leaves.length) return 1;
  return b.leaves.reduce((s, l) => s + (retention.get(l.id) ?? 1), 0) / b.leaves.length;
}

function hashKey(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return ((h >>> 0) % 1000) / 1000;
}

const GLITCH = '#%&*+=?@$/\\<>~';

/** Show `text`; when it changes, scramble the characters that changed before settling. */
function useScramble(text: string, ms = 520) {
  const [out, setOut] = useState(text);
  const settled = useRef(text);
  useEffect(() => {
    const from = settled.current;
    if (from === text || prefersReducedMotion()) {
      settled.current = text;
      setOut(text);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      if (p >= 1) {
        settled.current = text;
        setOut(text);
        return;
      }
      setOut(
        [...text]
          .map((ch, i) => (ch === ' ' || ch === from[i] || Math.random() < p * p ? ch : GLITCH[Math.floor(Math.random() * GLITCH.length)]))
          .join(''),
      );
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [text, ms]);
  return out;
}
