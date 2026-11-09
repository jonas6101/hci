import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { GROVES, GROVE_ROWS, PAST_TREES } from '../../data/forest';
import { CONCEPT_BY_ID, LIVE_TREE } from '../../data/scenario';
import { prefersReducedMotion } from '../../lib/hooks';
import { mean, pct, scoreToMode, MODE_META } from '../../lib/modes';
import { FALLEN, daysSince, eroded, hash01, retention } from '../../lib/retention';
import { useStore } from '../../lib/store';
import type { TreeData } from '../../lib/types';
import { AsciiTreeView } from '../../shared/AsciiTreeView';
import { Scrubber } from './Pane';
import { G, K, Radios, lower, typing, useUi } from './ui';

/* ───────────────────────── Forest: semantic zoom ─────────────────────────
 *   forest — every chat is a small tree whose crown is made of its leaves (one glyph each).
 *            Forgotten leaves fall to the ground. Hover a tree: roots run to the chats it
 *            shares concepts with, labelled with the shared concept.
 *   tree   — zoom in: the full tree with labels, and its concepts, most faded first.
 * Zooming is a camera move (scale around the tree), so you always see where you came from.
 */

const LH = 18;
const W = 15; // mini tree width in characters
const MID = 7;
const CROWN = 4; // crown rows
const H = 9; // crown 0–3 · trunk 4–5 · ground 6 · title 7 · meta 8
type Filter = 'all' | 'you' | 'ai';

interface LeafInfo {
  id: string;
  label: string;
  score: number;
  count: number;
  keep: number;
  messageId?: string;
  branch: string;
}

interface TreeInfo {
  tree: TreeData;
  live: boolean;
  score: number;
  leaves: LeafInfo[];
  fading: number;
  fallen: number;
  /** Other tree id → shared concept labels. */
  roots: Map<string, string[]>;
}

function useForestData(days: number) {
  const { liveTree } = useStore();
  return useMemo(() => {
    const trees = [liveTree, ...PAST_TREES];
    const infos: TreeInfo[] = trees.map((tree) => {
      const live = tree.id === LIVE_TREE.id;
      const age = (live ? 0 : daysSince(tree.updated)) + days;
      const leaves = tree.branches.flatMap((b) =>
        b.leaves.map((l) => ({
          id: l.id,
          label: l.label,
          score: l.score,
          count: l.count ?? 1,
          keep: retention(l.score, age, l.count ?? 1),
          messageId: l.messageId,
          branch: b.label,
        })),
      );
      return {
        tree,
        live,
        score: mean(leaves.map((l) => l.score)),
        leaves,
        fading: leaves.filter((l) => l.keep < 0.6 && l.keep >= FALLEN).length,
        fallen: leaves.filter((l) => l.keep < FALLEN).length,
        roots: new Map(),
      };
    });
    // Shared concepts between chats become roots ("the wood wide web").
    for (const a of infos) {
      const mine = new Map(a.leaves.map((l) => [l.label.toLowerCase(), l.label]));
      for (const b of infos) {
        if (a === b) continue;
        const shared = b.leaves.map((l) => l.label.toLowerCase()).filter((k) => mine.has(k));
        if (shared.length) a.roots.set(b.tree.id, shared.map((k) => mine.get(k)!));
      }
    }
    return { infos, byId: new Map(infos.map((i) => [i.tree.id, i])) };
  }, [liveTree, days]);
}

export function Forest() {
  const { state, dispatch } = useStore();
  const { days, setDays } = useUi();
  const { infos, byId } = useForestData(days);
  const startFocus = state.forest.focus && byId.has(state.forest.focus) ? state.forest.focus : null;
  const [level, setLevel] = useState<'forest' | 'tree'>(startFocus ? 'tree' : 'forest');
  const [focus, setFocus] = useState<string>(startFocus ?? LIVE_TREE.id);
  const [hover, setHover] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [grove, setGrove] = useState<string | null>(null);
  const body = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  /** Where the camera comes from when the forest (re)appears: a tree id and how long to pull back. */
  const zoomFrom = useRef<{ id: string; ms: number } | null>(startFocus ? null : { id: LIVE_TREE.id, ms: 1100 });
  const busy = useRef(false);

  const close = useCallback(() => dispatch({ type: 'forest', open: false }), [dispatch]);

  const zoomIn = useCallback((id: string) => {
    if (busy.current) return;
    const el = body.current?.querySelector<HTMLElement>(`[data-tree="${id}"]`);
    const grid = body.current?.querySelector<HTMLElement>('.a-groves');
    setHover(null);
    const done = () => {
      busy.current = false;
      setFocus(id);
      setLevel('tree');
    };
    if (!el || !grid || prefersReducedMotion()) return done();
    busy.current = true;
    grid.style.transformOrigin = originOf(el, grid);
    grid.animate(
      [
        { transform: 'scale(1)', opacity: 1 },
        { transform: 'scale(2.8)', opacity: 0 },
      ],
      { duration: 380, easing: 'cubic-bezier(.55,0,.8,.3)', fill: 'forwards' },
    ).onfinish = done;
  }, []);

  const zoomOut = useCallback(() => {
    if (level === 'tree') {
      zoomFrom.current = { id: focus, ms: 520 };
      setLevel('forest');
    } else close();
  }, [level, focus, close]);

  // Camera pull-back whenever the forest level appears.
  useLayoutEffect(() => {
    if (level !== 'forest') return;
    const from = zoomFrom.current;
    zoomFrom.current = null;
    const grid = body.current?.querySelector<HTMLElement>('.a-groves');
    const el = from && body.current?.querySelector<HTMLElement>(`[data-tree="${from.id}"]`);
    if (!from || !grid || !el || prefersReducedMotion()) return;
    grid.style.transformOrigin = originOf(el, grid);
    grid.animate(
      [
        { transform: 'scale(2.8)', opacity: 0.2 },
        { transform: 'scale(1)', opacity: 1 },
      ],
      { duration: from.ms, easing: 'cubic-bezier(.2,.8,.2,1)' },
    );
  }, [level]);

  // Keys: Esc / − steps out a level, + zooms into the focused tree, / searches.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (typing(e) && query) return setQuery('');
        e.preventDefault();
        e.stopImmediatePropagation();
        (document.activeElement as HTMLElement | null)?.blur?.();
        return zoomOut();
      }
      if (typing(e)) return;
      if (e.key === '-' || e.key === '_') zoomOut();
      else if ((e.key === '+' || e.key === '=') && level === 'forest') {
        const id = (document.activeElement as HTMLElement | null)?.dataset?.tree ?? hover;
        if (id) zoomIn(id);
      } else if (e.key === '/' && level === 'forest') {
        e.preventDefault();
        search.current?.focus();
      } else return;
      e.stopImmediatePropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [zoomOut, zoomIn, level, hover, query]);

  // Pinch / ctrl+wheel: in over a tree zooms into it, out steps back.
  useEffect(() => {
    const el = body.current;
    if (!el) return;
    let acc = 0;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      acc += e.deltaY;
      if (acc > 50) {
        acc = 0;
        zoomOut();
      } else if (acc < -50) {
        acc = 0;
        const t = (e.target as HTMLElement).closest<HTMLElement>('[data-tree]');
        if (level === 'forest' && t?.dataset.tree) zoomIn(t.dataset.tree);
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomIn, zoomOut, level]);

  const all = infos.flatMap((i) => i.leaves);
  const focused = byId.get(focus)!;
  const groveOf = (id: string) => GROVES.find((g) => g.id === id)?.label.toLowerCase() ?? '';

  return (
    <div className="a-forest" role="dialog" aria-modal="true" aria-label="Forest: all your chats">
      <header className="a-forest-head">
        <nav className="a-crumbs" aria-label="Zoom level">
          <button className={level === 'forest' ? 'on' : ''} onClick={() => level === 'tree' && zoomOut()}>
            forest
          </button>
          {level === 'tree' && (
            <>
              <span className="a-dim"> / {groveOf(focused.tree.grove)} / </span>
              <span className="on">{lower(focused.tree.title)}</span>
            </>
          )}
        </nav>
        {level === 'forest' ? (
          <>
            <span className="a-dim">
              {infos.length} chats · {GROVES.length} groves · {all.length} concepts · {pct(mean(all.map((l) => l.score)))}% your thinking
            </span>
            <label className="a-search">
              <span className="a-dim">search ›</span>
              <input
                ref={search}
                value={query}
                spellCheck={false}
                placeholder="a concept…"
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search concepts in all chats"
              />
            </label>
            <Radios<Filter>
              label="Show"
              value={filter}
              onChange={setFilter}
              options={[
                { v: 'all', label: 'all' },
                { v: 'you', label: 'mostly you' },
                { v: 'ai', label: 'mostly ai' },
              ]}
            />
          </>
        ) : (
          <span className="a-dim">
            <G score={focused.score} /> {pct(focused.score)}% your thinking · {focused.leaves.length} concepts ·{' '}
            {focused.live ? 'this chat' : `last opened ${lower(focused.tree.updated)}`}
          </span>
        )}
        <span className="a-forest-time">
          <Scrubber days={days} setDays={setDays} width={20} />
        </span>
        <button className="a-icon" onClick={close} aria-label="Close the forest" title="close  esc">
          ×
        </button>
      </header>

      <div className="a-forest-body" ref={body}>
        {level === 'forest' ? (
          <Groves
            infos={infos}
            byId={byId}
            hover={hover}
            setHover={setHover}
            query={query}
            filter={filter}
            grove={grove}
            setGrove={setGrove}
            onOpen={zoomIn}
          />
        ) : (
          <TreeDetail info={focused} />
        )}
      </div>

      <footer className="a-forest-foot a-dim">
        <span>
          <G mode="own" /> you <G mode="together" /> together <G mode="ai" /> ai · leaves on the ground = likely forgotten
          (illustrative model)
        </span>
        <span>
          {level === 'forest' ? (
            <>
              <K>←→</K> move <K>↵</K> zoom in <K>/</K> search <K>esc</K> back to chat
            </>
          ) : (
            <>
              <K>esc</K> back to the forest · pinch to zoom
            </>
          )}
        </span>
      </footer>
    </div>
  );
}

function originOf(el: HTMLElement, grid: HTMLElement) {
  const a = el.getBoundingClientRect();
  const b = grid.getBoundingClientRect();
  return `${a.left + a.width / 2 - b.left}px ${a.top + a.height * 0.4 - b.top}px`;
}

/* ───────────── Forest level ───────────── */

function Groves({
  infos,
  byId,
  hover,
  setHover,
  query,
  filter,
  grove,
  setGrove,
  onOpen,
}: {
  infos: TreeInfo[];
  byId: Map<string, TreeInfo>;
  hover: string | null;
  setHover: (id: string | null) => void;
  query: string;
  filter: Filter;
  grove: string | null;
  setGrove: (g: string | null) => void;
  onOpen: (id: string) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const q = query.trim().toLowerCase();
  const hovered = hover ? byId.get(hover) : undefined;

  const hitsOf = (i: TreeInfo) => (q ? new Set(i.leaves.filter((l) => l.label.toLowerCase().includes(q)).map((l) => l.id)) : null);
  const sharedWithHover = (i: TreeInfo) => {
    if (!hovered || hovered === i) return null;
    const labels = hovered.roots.get(i.tree.id);
    if (!labels) return null;
    const set = new Set(labels.map((l) => l.toLowerCase()));
    return new Set(i.leaves.filter((l) => set.has(l.label.toLowerCase())).map((l) => l.id));
  };

  // Arrow keys move between trees in reading order.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    const els = [...(wrap.current?.querySelectorAll<HTMLElement>('[data-tree]') ?? [])];
    const i = els.indexOf(document.activeElement as HTMLElement);
    e.preventDefault();
    if (i < 0) return els.find((el) => el.dataset.tree === LIVE_TREE.id)?.focus();
    const cur = els[i].getBoundingClientRect();
    let next: HTMLElement | undefined;
    if (e.key === 'ArrowLeft') next = els[i - 1];
    else if (e.key === 'ArrowRight') next = els[i + 1];
    else {
      // Nearest tree in the row above / below.
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      let best = Infinity;
      for (const el of els) {
        const r = el.getBoundingClientRect();
        if ((r.top - cur.top) * dir < 10) continue;
        const d = Math.abs(r.top - cur.top) * 4 + Math.abs(r.left - cur.left);
        if (d < best) {
          best = d;
          next = el;
        }
      }
    }
    next?.focus();
  };

  return (
    <div className="a-groves" ref={wrap} onKeyDown={onKeyDown}>
      {GROVE_ROWS.flat().map((gid) => {
        const g = GROVES.find((x) => x.id === gid)!;
        const members = infos.filter((i) => i.tree.grove === gid);
        const leaves = members.flatMap((i) => i.leaves);
        const away = grove !== null && grove !== gid;
        return (
          <section key={gid} className={`a-grove${away ? ' away' : ''}`} aria-label={`Grove: ${g.label}`}>
            <button className={`a-grove-name${grove === gid ? ' on' : ''}`} onClick={() => setGrove(grove === gid ? null : gid)}>
              {lower(g.label)}
            </button>
            <span className="a-dim">
              {' '}
              {members.length} · {pct(mean(leaves.map((l) => l.score)))}% yours
            </span>
            <div className="a-grove-trees">
              {members.map((i) => {
                const hits = hitsOf(i);
                const shared = sharedWithHover(i);
                const mismatch = (filter === 'you' && i.score < 0.5) || (filter === 'ai' && i.score >= 0.5);
                const dim = mismatch || (hits !== null && hits.size === 0) || away || (hovered !== undefined && hover !== i.tree.id && !shared);
                return (
                  <MiniTree
                    key={i.tree.id}
                    info={i}
                    dim={dim}
                    hits={hits ?? shared}
                    related={shared !== null}
                    hovered={hover === i.tree.id}
                    onHover={setHover}
                    onOpen={onOpen}
                  />
                );
              })}
            </div>
          </section>
        );
      })}
      {hovered && <Roots from={hovered} wrap={wrap} />}
    </div>
  );
}

/** Crown rows for n leaves: 1, 3, 5, 7 slots from the top, filled like a triangle. */
function crown(n: number): { r: number; c: number }[] {
  const shown = Math.min(n, CROWN * CROWN);
  const k = Math.max(1, Math.ceil(Math.sqrt(shown)));
  const out: { r: number; c: number }[] = [];
  let prev = 0;
  for (let row = 0; row < k; row++) {
    const upto = Math.round((shown * (row + 1) ** 2) / (k * k));
    const m = Math.min(2 * row + 1, upto - prev);
    prev += m;
    for (let j = 0; j < m; j++) out.push({ r: CROWN - k + row, c: MID - (m - 1) + 2 * j });
  }
  return out;
}

const FALL_AT = [-2, 3, -4, 5, -6, 2, -3, 4, -5, 6, -1, 1];

function MiniTree({
  info,
  dim,
  hits,
  related,
  hovered,
  onHover,
  onOpen,
}: {
  info: TreeInfo;
  dim: boolean;
  hits: Set<string> | null;
  related: boolean;
  hovered: boolean;
  onHover: (id: string | null) => void;
  onOpen: (id: string) => void;
}) {
  const { tree, live, leaves } = info;
  const slots = crown(leaves.length);
  const title = tree.title.toLowerCase();
  const fitTitle = title.length > W - 1 ? `${title.slice(0, W - 2)}…` : title;
  const meta = hits && hits.size && !related ? `${hits.size} match${hits.size === 1 ? '' : 'es'}` : `${pct(info.score)}% · ${live ? 'now' : lower(tree.updated)}`;
  const ref = useRef<HTMLButtonElement>(null);
  const [flip, setFlip] = useState(false);

  return (
    <button
      ref={ref}
      data-tree={tree.id}
      className={`a-mini${dim ? ' dim' : ''}${related ? ' rel' : ''}${hovered ? ' hov' : ''}${live ? ' live' : ''}`}
      style={{ width: `${W}ch`, height: H * LH }}
      onMouseEnter={() => {
        const r = ref.current?.getBoundingClientRect();
        setFlip(Boolean(r && r.left > window.innerWidth * 0.6));
        onHover(tree.id);
      }}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(tree.id)}
      onBlur={() => onHover(null)}
      onClick={() => onOpen(tree.id)}
      aria-label={`${tree.title}: ${leaves.length} concepts, ${pct(info.score)}% your thinking, ${info.fallen} likely forgotten. Zoom in`}
    >
      {leaves.slice(0, slots.length).map((l, i) => {
        const fallen = l.keep < FALLEN;
        const at = fallen ? { r: 5, c: MID + FALL_AT[i % FALL_AT.length] } : slots[i];
        return (
          <span
            key={l.id}
            className={`a-mini-leaf${fallen ? ' fallen' : l.keep < 0.6 ? ' fading' : ''}${hits?.has(l.id) ? ' hit' : ''}`}
            style={{ left: `${at.c}ch`, top: at.r * LH, '--spin': `${(hash01(l.id) - 0.5) * 320}deg` } as CSSProperties}
          >
            <G score={l.score} />
          </span>
        );
      })}
      <span className="a-mini-wood" style={{ left: `${MID}ch`, top: 4 * LH }}>
        │
      </span>
      <span className="a-mini-wood" style={{ left: `${MID}ch`, top: 5 * LH }}>
        │
      </span>
      <span className="a-mini-ground" style={{ top: 6 * LH }}>
        {'─'.repeat(MID)}┴{'─'.repeat(W - MID - 1)}
      </span>
      <span className="a-mini-title" style={{ top: 7 * LH }}>
        {fitTitle}
      </span>
      <span className="a-mini-meta" style={{ top: 8 * LH }}>
        <G score={info.score} /> {meta}
      </span>
      {hovered && <TreeCard info={info} flip={flip} />}
    </button>
  );
}

/** Box-drawn card with what the tree holds and where its roots go. */
function TreeCard({ info, flip }: { info: TreeInfo; flip: boolean }) {
  const roots = [...info.roots.entries()].slice(0, 3).map(([id, labels]) => {
    const t = id === LIVE_TREE.id ? LIVE_TREE.title : PAST_TREES.find((x) => x.id === id)?.title ?? id;
    return `→ ${t.toLowerCase()} (${labels.map((l) => l.toLowerCase()).join(', ')})`;
  });
  const lines = [
    `${MODE_META[scoreToMode(info.score)].label.toLowerCase()} · ${pct(info.score)}%`,
    `${info.leaves.length} concepts${info.fading ? ` · ${info.fading} fading` : ''}${info.fallen ? ` · ${info.fallen} fallen` : ''}`,
    ...(roots.length ? ['roots', ...roots] : ['no shared roots yet']),
    '↵ zoom in',
  ];
  return <Box title={info.tree.title.toLowerCase()} lines={lines} className={`a-tree-card${flip ? ' flip' : ''}`} />;
}

export function Box({ title, lines, className = '', max = 46 }: { title: string; lines: string[]; className?: string; max?: number }) {
  const fit = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
  const width = Math.min(max, Math.max(title.length + 6, ...lines.map((l) => l.length + 4)));
  const t = fit(title, width - 6);
  return (
    <span className={`a-box ${className}`} role="tooltip">
      <span className="a-box-line">
        <span className="a-box-b">┌─ </span>
        <b>{t}</b>
        <span className="a-box-b"> {'─'.repeat(Math.max(1, width - 5 - t.length))}┐</span>
      </span>
      {lines.map((l, i) => {
        const s = fit(l, width - 4);
        return (
          <span className="a-box-line" key={i} style={{ '--i': i } as CSSProperties}>
            <span className="a-box-b">│ </span>
            {s}
            {' '.repeat(Math.max(0, width - 4 - s.length))}
            <span className="a-box-b"> │</span>
          </span>
        );
      })}
      <span className="a-box-line">
        <span className="a-box-b">└{'─'.repeat(width - 2)}┘</span>
      </span>
    </span>
  );
}

/**
 * Roots: when a tree is hovered, a line runs underground to each tree in the same row that
 * shares a concept with it, labelled with the shared concept.
 */
function Roots({ from, wrap }: { from: TreeInfo; wrap: React.RefObject<HTMLDivElement | null> }) {
  const [lines, setLines] = useState<{ x0: number; x1: number; y: number; label: string }[]>([]);
  const [cw, setCw] = useState(7.8);
  useLayoutEffect(() => {
    const root = wrap.current;
    if (!root) return;
    // Offsets, not client rects: they ignore the zoom transform, so roots land right even mid-zoom.
    const box = (el: HTMLElement) => {
      let x = 0;
      let y = 0;
      for (let n: HTMLElement | null = el; n && n !== root; n = n.offsetParent as HTMLElement | null) {
        x += n.offsetLeft;
        y += n.offsetTop;
      }
      return { left: x, top: y, width: el.offsetWidth, bottom: y + el.offsetHeight };
    };
    const ea = root.querySelector<HTMLElement>(`[data-tree="${from.tree.id}"]`);
    if (!ea) return;
    const a = box(ea);
    const ch = a.width / W;
    setCw(ch);
    const out: { x0: number; x1: number; y: number; label: string }[] = [];
    let k = 0;
    for (const [id, labels] of from.roots) {
      const eb = root.querySelector<HTMLElement>(`[data-tree="${id}"]`);
      if (!eb) continue;
      const b = box(eb);
      if (Math.abs(b.top - a.top) > 4) continue;
      const xa = a.left + MID * ch;
      const xb = b.left + MID * ch;
      out.push({ x0: Math.min(xa, xb), x1: Math.max(xa, xb), y: a.bottom + (k % 2) * LH + 2, label: labels[0].toLowerCase() });
      k++;
    }
    setLines(out);
  }, [from, wrap]);

  return (
    <div className="a-roots" aria-hidden="true">
      {lines.map((l, i) => {
        const n = Math.max(2, Math.round((l.x1 - l.x0) / cw));
        const label = ` ${l.label} `.slice(0, Math.max(0, n - 4));
        const pad = n - 1 - label.length;
        const left = Math.floor(pad / 2);
        const text = `╰${'─'.repeat(Math.max(0, left - 1))}${label}${'─'.repeat(Math.max(0, pad - left - 1))}╯`;
        return (
          <span key={i} className="a-root" style={{ left: l.x0, top: l.y }}>
            {[...text].map((ch, j) => (
              <span key={j} style={{ animationDelay: `${Math.min(j, text.length - j) * 12}ms` }}>
                {ch}
              </span>
            ))}
          </span>
        );
      })}
    </div>
  );
}

/* ───────────── Tree level ───────────── */

function TreeDetail({ info }: { info: TreeInfo }) {
  const { state, dispatch, send, jumpTo, toast } = useStore();
  const keep = useMemo(() => new Map(info.leaves.map((l) => [l.id, l.keep])), [info]);
  const order = [...info.leaves].sort((a, b) => a.keep - b.keep || a.score - b.score);
  const highlight = useMemo(() => new Set(state.highlight), [state.highlight]);

  const quiz = (l: LeafInfo) => {
    if (info.live && CONCEPT_BY_ID[l.id]) {
      dispatch({ type: 'forest', open: false });
      send(`Quiz me on ${l.label.toLowerCase()}`);
    } else toast('prototype: past chats are read-only. this would reopen that chat with a quiz.');
  };

  return (
    <div className="a-detail">
      <div className="a-detail-tree">
        <AsciiTreeView
          tree={info.tree}
          retention={keep}
          highlight={highlight}
          onHover={(id) => dispatch({ type: 'highlight', ids: id ? [id] : [] })}
          onJump={(mid) => (info.live ? jumpTo(mid) : toast('prototype: past chats are read-only.'))}
        />
      </div>
      <aside className="a-detail-list" aria-label="Concepts, most faded first">
        <p className="a-row">
          <span>revisit</span>
          <span className="a-dim">most faded first</span>
        </p>
        <ul>
          {order.map((l) => {
            const gone = eroded(l.label.toLowerCase(), l.id, l.keep);
            return (
              <li
                key={l.id}
                className={highlight.has(l.id) ? 'on' : ''}
                onMouseEnter={() => dispatch({ type: 'highlight', ids: [l.id] })}
                onMouseLeave={() => dispatch({ type: 'highlight', ids: [] })}
              >
                <G score={l.score} className={l.keep < FALLEN ? 'is-fallen' : ''} />
                <span className="a-detail-label" title={l.label}>
                  {[...l.label.toLowerCase()].map((ch, i) => (
                    <span key={i} className={gone[i] ? 'er' : undefined}>
                      {ch}
                    </span>
                  ))}
                </span>
                <span className={`a-detail-keep${l.keep < FALLEN ? ' gone' : ''}`}>
                  {l.keep < FALLEN ? 'fallen' : `${pct(l.keep)}%`}
                </span>
                <span className="a-detail-acts">
                  <button className="a-btn" onClick={() => quiz(l)}>
                    quiz
                  </button>
                  {info.live && l.messageId && (
                    <button className="a-btn" onClick={() => jumpTo(l.messageId!)}>
                      jump
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="a-dim a-detail-note">
          % = likely still remembered at this point in time. what you reasoned through yourself fades slowest; each revisit
          makes it last longer.
        </p>
      </aside>
    </div>
  );
}
