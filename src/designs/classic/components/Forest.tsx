import { ArrowLeft, ChevronRight, Lightbulb, Maximize, MessageSquare, Minus, Plus, Search, Trees, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GROVES, GROVE_ROWS, PAST_TREES } from '../../../data/forest';
import { LIVE_TREE } from '../../../data/scenario';
import { fitTarget, useCamera } from '../../../lib/camera';
import { useSize } from '../../../lib/hooks';
import { GROUND_DEPTH, groveBounds, layoutForest, treeBounds, type ForestLayout, type PlacedTree } from '../../../lib/layout';
import { mean, pct } from '../../../lib/modes';
import { useStore } from '../../../lib/store';
import { fitText, measure } from '../../../lib/text';
import { Glyph } from './Glyph';
import { TreeSvg } from './TreeSvg';

const DRAWER_W = 360;
type Filter = 'all' | 'you' | 'ai';
const TITLE_FONT = '600 12.5px Inter, -apple-system, system-ui, sans-serif';
const META_FONT = '400 11px Inter, -apple-system, system-ui, sans-serif';

export function Forest() {
  const { state, dispatch, liveTree, jumpTo } = useStore();
  const trees = useMemo(() => [liveTree, ...PAST_TREES], [liveTree]);
  const forest = useMemo(() => layoutForest(trees, GROVES, GROVE_ROWS), [trees]);
  const forestRef = useRef(forest);
  forestRef.current = forest;

  const wrap = useRef<HTMLDivElement>(null);
  const size = useSize(wrap);
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const { cam, set, animateTo, zoomAt, panBy } = useCamera(sizeRef);

  const [selected, setSelected] = useState<string | null>(null);
  /** Labels shown without selecting (used for the opening zoom-out). */
  const [peek, setPeek] = useState<string | null>(null);
  const [groveFocus, setGroveFocus] = useState<string | null>(null);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const nav = useRef({ selected, groveFocus, query });
  nav.current = { selected, groveFocus, query };
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const started = useRef(false);

  const close = useCallback(() => dispatch({ type: 'forest', open: false }), [dispatch]);
  const fitAll = () => fitTarget(forestRef.current.bounds, sizeRef.current, { pad: 56 });

  const showAll = useCallback(() => {
    setSelected(null);
    setGroveFocus(null);
    animateTo(fitAll(), 900);
  }, [animateTo]);

  const selectTree = useCallback(
    (id: string) => {
      const p = forestRef.current.byId[id];
      if (!p) return;
      setSelected(id);
      setGroveFocus(p.tree.grove);
      setHover(null);
      animateTo(fitTarget(treeBounds(p, true), sizeRef.current, { pad: 48, right: DRAWER_W, maxK: 1.25 }), 900);
    },
    [animateTo],
  );

  const selectGrove = useCallback(
    (gid: string) => {
      const g = forestRef.current.groves.find((x) => x.grove.id === gid);
      if (!g) return;
      setSelected(null);
      setGroveFocus(gid);
      animateTo(fitTarget(groveBounds(g), sizeRef.current, { pad: 64, maxK: 1.2 }), 900);
    },
    [animateTo],
  );

  // Opening sequence: start on the live tree (where you just were), then zoom out to the forest.
  useEffect(() => {
    if (started.current || !size.w) return;
    started.current = true;
    const focus = state.forest.focus;
    if (focus && focus !== LIVE_TREE.id) {
      set(fitAll());
      setTimeout(() => selectTree(focus), 380);
      return;
    }
    const live = forest.byId[LIVE_TREE.id];
    set(fitTarget(treeBounds(live, true), size, { pad: 48, maxK: 1.25 }));
    setPeek(LIVE_TREE.id);
    setTimeout(() => {
      setPeek(null);
      animateTo(fitAll(), 1400);
    }, 600);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.w]);

  // Wheel / pinch zoom around the cursor.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if ((e.target as Element).closest?.('.drawer')) return; // let the drawer scroll
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0018)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  // Keyboard: Esc steps back out one level, +/- zoom, 0 fits everything.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.closest?.('input, textarea');
      if (e.key === 'Escape') {
        if (typing) {
          if (nav.current.query) setQuery('');
          else target.blur();
          return;
        }
        if (nav.current.selected || nav.current.groveFocus) showAll();
        else close();
        return;
      }
      if (typing) return;
      const { w, h } = sizeRef.current;
      if (e.key === '+' || e.key === '=') zoomAt(w / 2, h / 2, 1.25);
      else if (e.key === '-') zoomAt(w / 2, h / 2, 0.8);
      else if (e.key === '0') showAll();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close, showAll, zoomAt]);

  /* ── Derived view state ── */
  const focusId = selected ?? hover?.id ?? null;
  const related = useMemo(() => {
    if (!focusId) return null;
    const s = new Set([focusId]);
    forest.links.forEach((l) => {
      if (l.a === focusId || l.b === focusId) {
        s.add(l.a);
        s.add(l.b);
      }
    });
    return s;
  }, [focusId, forest.links]);

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!q) return null;
    const leaves = new Set<string>();
    const treeIds = new Set<string>();
    forest.trees.forEach((p) => {
      if (p.tree.title.toLowerCase().includes(q)) treeIds.add(p.tree.id);
      p.tree.branches.forEach((b) =>
        b.leaves.forEach((l) => {
          if (l.label.toLowerCase().includes(q)) {
            leaves.add(l.id);
            treeIds.add(p.tree.id);
          }
        }),
      );
    });
    return { leaves, trees: treeIds };
  }, [q, forest]);

  const opacityOf = (p: PlacedTree) => {
    const id = p.tree.id;
    if (selected) return id === selected ? 1 : related?.has(id) ? 0.5 : 0.12;
    if (peek) return id === peek ? 1 : 0.3;
    if (matches) return matches.trees.has(id) ? 1 : 0.14;
    if (filter === 'you' && p.layout.score < 0.5) return 0.14;
    if (filter === 'ai' && p.layout.score >= 0.5) return 0.14;
    if (hover && related) return related.has(id) ? 1 : 0.5;
    return 1;
  };

  const allLeaves = forest.trees.flatMap((p) => p.tree.branches.flatMap((b) => b.leaves));
  const overall = pct(mean(allLeaves.map((l) => l.score)));
  const { x, y, k } = cam;
  const sel = selected ? forest.byId[selected] : null;
  const groveLabel = (id: string) => GROVES.find((g) => g.id === id)?.label ?? id;

  return (
    <div className="forest" role="dialog" aria-modal="true" aria-label="Your knowledge forest">
      <header className="forest-top">
        <button className="btn btn-ghost" onClick={close}>
          <ArrowLeft size={15} /> Back to chat <kbd>Esc</kbd>
        </button>
        <nav className="crumbs" aria-label="Zoom level">
          <button className={!groveFocus && !selected ? 'current' : ''} onClick={showAll}>
            <Trees size={14} /> Forest
          </button>
          {groveFocus && (
            <>
              <ChevronRight size={14} className="crumb-sep" />
              <button className={!selected ? 'current' : ''} onClick={() => selectGrove(groveFocus)}>
                {groveLabel(groveFocus)}
              </button>
            </>
          )}
          {sel && (
            <>
              <ChevronRight size={14} className="crumb-sep" />
              <span className="current">{sel.tree.title}</span>
            </>
          )}
        </nav>
        <div className="forest-tools">
          <label className="search">
            <Search size={14} aria-hidden="true" />
            <input
              value={query}
              placeholder="Find a concept…"
              aria-label="Find a concept in your forest"
              onChange={(e) => {
                setQuery(e.target.value);
                if (selected) {
                  setSelected(null);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && matches?.trees.size) selectTree([...matches.trees][0]);
              }}
            />
            {query && (
              <button className="icon-btn" aria-label="Clear search" onClick={() => setQuery('')}>
                <X size={13} />
              </button>
            )}
          </label>
          <div className="segmented" role="radiogroup" aria-label="Filter trees">
            {(
              [
                ['all', 'All'],
                ['you', 'Mostly you'],
                ['ai', 'Mostly AI'],
              ] as [Filter, string][]
            ).map(([v, label]) => (
              <button key={v} role="radio" aria-checked={filter === v} className={filter === v ? 'on' : ''} onClick={() => setFilter(v)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div
        className={`forest-canvas ${drag.current?.moved ? 'dragging' : ''}`}
        ref={wrap}
        onPointerDown={(e) => {
          if (e.button !== 0 || (e.target as Element).closest('.forest-ui')) return;
          drag.current = { x: e.clientX, y: e.clientY, moved: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const dx = e.clientX - d.x;
          const dy = e.clientY - d.y;
          if (!d.moved && Math.hypot(dx, dy) < 4) return;
          if (!d.moved) {
            d.moved = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            e.currentTarget.classList.add('dragging');
            setHover(null);
          }
          d.x = e.clientX;
          d.y = e.clientY;
          panBy(dx, dy);
        }}
        onPointerUp={(e) => {
          if (drag.current?.moved) {
            suppressClick.current = true;
            setTimeout(() => (suppressClick.current = false), 0);
          }
          e.currentTarget.classList.remove('dragging');
          drag.current = null;
        }}
        onClick={(e) => {
          if (suppressClick.current) return;
          const t = e.target as Element;
          if (t.closest('.forest-tree, .forest-ui, .grove-label')) return;
          if (selected || groveFocus) showAll();
        }}
      >
        <svg className="forest-svg" width="100%" height="100%">
          <g transform={`translate(${x},${y}) scale(${k})`}>
            {forest.groves.map((g) => (
              <line key={g.grove.id} className="ground" x1={g.x0 + 16} x2={g.x1 - 16} y1={g.y} y2={g.y} />
            ))}
            <Roots forest={forest} focusId={focusId} k={k} />
            {forest.trees.map((p) => {
              const id = p.tree.id;
              const isSel = selected === id;
              return (
                <g
                  key={id}
                  className={`forest-tree ${isSel ? 'selected' : ''}`}
                  transform={`translate(${p.x},${p.y})`}
                  style={{ opacity: opacityOf(p) }}
                  tabIndex={0}
                  role="button"
                  aria-label={`${p.tree.title}: ${p.layout.count} concepts, ${pct(p.layout.score)}% your thinking`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (suppressClick.current) return;
                    if (!isSel) selectTree(id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      selectTree(id);
                    }
                  }}
                  onMouseMove={(e) => {
                    if (drag.current?.moved || isSel) return;
                    const r = wrap.current!.getBoundingClientRect();
                    setHover({ id, x: e.clientX - r.left, y: e.clientY - r.top });
                  }}
                  onMouseLeave={() => setHover(null)}
                >
                  <rect className="tree-hit" x={-p.slot / 2 + 12} y={p.layout.top - 12} width={p.slot - 24} height={-p.layout.top + 44} rx={18} />
                  <TreeSvg
                    layout={p.layout}
                    showLabels={isSel || peek === id}
                    highlight={matches?.leaves}
                    animate={false}
                    onLeafClick={
                      isSel && p.tree.live ? ({ leaf }) => leaf.messageId && jumpTo(leaf.messageId) : undefined
                    }
                  />
                </g>
              );
            })}
          </g>

          {/* Screen-space labels: always readable, whatever the zoom level. */}
          <g className="screen-labels">
            {forest.trees.map((p) => {
              const sx = p.x * k + x;
              const sy = p.y * k + y;
              const room = p.slot * k;
              if (room < 46) return null;
              const title = fitText(p.tree.title, room - 8, TITLE_FONT);
              const meta = `${p.tree.live ? 'Live · ' : ''}${pct(p.layout.score)}% you · ${p.layout.count}`;
              const showMeta = room > 84;
              // An opaque "plaque" so roots appear to run beneath the name rather than through it.
              const pw = Math.max(measure(title, TITLE_FONT), showMeta ? measure(meta, META_FONT) : 0) + 12;
              return (
                <g key={p.tree.id} style={{ opacity: opacityOf(p) }} className="tree-name">
                  <rect className="plaque" x={sx - pw / 2} y={sy + 5} width={pw} height={showMeta ? 34 : 20} rx={5} />
                  <text x={sx} y={sy + 19} textAnchor="middle" className="tree-title">
                    {title}
                  </text>
                  {showMeta && (
                    <text x={sx} y={sy + 34} textAnchor="middle" className="tree-meta">
                      {meta}
                    </text>
                  )}
                </g>
              );
            })}
            {forest.groves.map((g) => {
              const sx = ((g.x0 + g.x1) / 2) * k + x;
              const sy = g.y * k + y + Math.max(GROUND_DEPTH * k, 88);
              const dim = selected || (groveFocus && groveFocus !== g.grove.id);
              return (
                <g
                  key={g.grove.id}
                  className="grove-label"
                  role="button"
                  tabIndex={0}
                  aria-label={`Zoom to grove ${g.grove.label}`}
                  style={{ opacity: dim ? 0.35 : 1 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    selectGrove(g.grove.id);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && selectGrove(g.grove.id)}
                >
                  <text x={sx} y={sy} textAnchor="middle">
                    {g.grove.label.toUpperCase()}
                    <tspan className="grove-count">
                      {'  '}
                      {g.trees.length} trees · {pct(g.score)}% you
                    </tspan>
                  </text>
                </g>
              );
            })}
            <RootLabels forest={forest} focusId={focusId} cam={cam} />
          </g>
        </svg>

        {hover && hover.id !== selected && <HoverCard p={forest.byId[hover.id]} x={hover.x} y={hover.y} w={size.w} />}

        <div className="forest-ui forest-stats">
          <strong>{forest.trees.length}</strong> trees · <strong>{allLeaves.length}</strong> concepts ·{' '}
          <Glyph score={overall / 100} size={11} /> <strong>{overall}%</strong> your thinking
          {matches && (
            <span className="match-count">
              {' '}
              — {matches.leaves.size} match{matches.leaves.size === 1 ? '' : 'es'} in {matches.trees.size} tree
              {matches.trees.size === 1 ? '' : 's'}
            </span>
          )}
        </div>

        <div className="forest-ui forest-legend">
          <span>
            <Glyph mode="own" size={11} /> Your thinking
          </span>
          <span>
            <Glyph mode="together" size={11} /> Together
          </span>
          <span>
            <Glyph mode="ai" size={11} /> Delegated
          </span>
          <span className="legend-sep" />
          <span>
            <svg width="22" height="10" aria-hidden="true">
              <path d="M1,1 C1,9 21,9 21,1" className="legend-root" />
            </svg>
            Shared concept
          </span>
        </div>

        <div className="forest-ui zoom-ctrl" style={{ right: sel ? DRAWER_W + 16 : 16 }}>
          <button className="icon-btn" aria-label="Zoom in" onClick={() => zoomAt(size.w / 2, size.h / 2, 1.3)}>
            <Plus size={16} />
          </button>
          <button className="icon-btn" aria-label="Zoom out" onClick={() => zoomAt(size.w / 2, size.h / 2, 0.77)}>
            <Minus size={16} />
          </button>
          <button className="icon-btn" aria-label="Show whole forest" onClick={showAll}>
            <Maximize size={14} />
          </button>
        </div>

        {sel && <TreeDrawer p={sel} forest={forest} onSelect={selectTree} onClose={showAll} />}
      </div>
    </div>
  );
}

/* ───────────── Roots: shared concepts between trees ───────────── */

/** Roots dip below the (screen-space) tree names, so their depth depends on the zoom level k. */
function rootPath(a: PlacedTree, b: PlacedTree, sameGrove: boolean, k: number) {
  const yb = Math.max(a.y, b.y);
  const dy = Math.max((sameGrove ? 24 : 48) + Math.min(70, Math.abs(b.x - a.x) * 0.1), (sameGrove ? 68 : 80) / k);
  return { d: `M${a.x},${a.y + 3} C${a.x},${yb + dy} ${b.x},${yb + dy} ${b.x},${b.y + 3}`, mx: (a.x + b.x) / 2, my: yb + dy * 0.75 };
}

function Roots({ forest, focusId, k }: { forest: ForestLayout; focusId: string | null; k: number }) {
  return (
    <g className="roots">
      {forest.links.map((l) => {
        const focused = focusId !== null && (l.a === focusId || l.b === focusId);
        if (!l.sameGrove && !focused) return null;
        const { d } = rootPath(forest.byId[l.a], forest.byId[l.b], l.sameGrove, k);
        return <path key={`${l.a}-${l.b}`} d={d} className={`root ${focused ? 'focused' : ''} ${l.sameGrove ? '' : 'cross'}`} />;
      })}
    </g>
  );
}

function RootLabels({ forest, focusId, cam }: { forest: ForestLayout; focusId: string | null; cam: { x: number; y: number; k: number } }) {
  if (!focusId) return null;
  return (
    <>
      {forest.links
        .filter((l) => l.a === focusId || l.b === focusId)
        .map((l) => {
          const { mx, my } = rootPath(forest.byId[l.a], forest.byId[l.b], l.sameGrove, cam.k);
          return (
            <text key={`${l.a}-${l.b}`} className="root-label" x={mx * cam.k + cam.x} y={my * cam.k + cam.y + 4} textAnchor="middle">
              {l.labels.join(' · ')}
            </text>
          );
        })}
    </>
  );
}

/* ───────────── Hover card & drawer ───────────── */

function HoverCard({ p, x, y, w }: { p: PlacedTree; x: number; y: number; w: number }) {
  const left = x > w - 280 ? x - 260 : x + 18;
  return (
    <div className="forest-ui hover-card" style={{ left, top: y + 18 }} role="tooltip">
      <strong>{p.tree.title}</strong>
      <span className="muted">
        {GROVES.find((g) => g.id === p.tree.grove)?.label} · {p.tree.live ? 'Live now' : `Last grown ${p.tree.updated}`}
      </span>
      <span>
        <Glyph score={p.layout.score} size={11} /> {pct(p.layout.score)}% your thinking · {p.layout.count} concepts
      </span>
      <span className="muted small">Click to zoom in</span>
    </div>
  );
}

function TreeDrawer({
  p,
  forest,
  onSelect,
  onClose,
}: {
  p: PlacedTree;
  forest: ForestLayout;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const { dispatch, send } = useStore();
  const t = p.tree;
  const leaves = t.branches.flatMap((b) => b.leaves);
  const own = leaves.filter((l) => l.score >= 0.75).length;
  const tog = leaves.filter((l) => l.score >= 0.25 && l.score < 0.75).length;
  const delegated = leaves.filter((l) => l.score < 0.25);
  const you = pct(p.layout.score);
  const links = forest.links.filter((l) => l.a === t.id || l.b === t.id);

  const practice = (label: string) => {
    dispatch({ type: 'forest', open: false });
    setTimeout(() => send(`Quiz me on ${label.toLowerCase()}`), 350);
  };

  return (
    <aside className="forest-ui drawer" aria-label={`${t.title} details`}>
      <button className="icon-btn drawer-close" aria-label="Close details" onClick={onClose}>
        <X size={16} />
      </button>
      <p className="eyebrow">{GROVES.find((g) => g.id === t.grove)?.label}</p>
      <h2>{t.title}</h2>
      <p className="muted small">{t.live ? 'Live — this conversation' : `Past conversation · last grown ${t.updated}`}</p>

      <div className="balance-nums">
        <span className="num-you">
          You <strong>{you}%</strong>
        </span>
        <span className="num-ai">
          <strong>{100 - you}%</strong> AI
        </span>
      </div>
      <div className="balance-bar" role="img" aria-label={`You did ${you}% of the thinking`}>
        <div className="seg seg-you" style={{ width: `${you}%` }} />
        <div className="seg seg-ai" style={{ width: `${100 - you}%` }} />
      </div>
      <div className="counts">
        <span>
          <Glyph mode="own" size={11} /> {own} yours
        </span>
        <span>
          <Glyph mode="together" size={11} /> {tog} together
        </span>
        <span>
          <Glyph mode="ai" size={11} /> {delegated.length} delegated
        </span>
      </div>

      <section className="drawer-sec">
        <h3>Revisit in your own words</h3>
        {delegated.length ? (
          <>
            <p className="muted small">These leaves are still hollow — the AI did the thinking there.</p>
            <ul className="revisit">
              {delegated.map((l) => (
                <li key={l.id}>
                  <Glyph score={0} size={11} />
                  <span>{l.label}</span>
                  {t.live && (
                    <button className="btn btn-sm" onClick={() => practice(l.label)}>
                      <Lightbulb size={13} /> Quiz me
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {!t.live && <p className="note">In this prototype, practising works in the live chat only.</p>}
          </>
        ) : (
          <p className="muted small">Every leaf here has some of your own thinking in it.</p>
        )}
      </section>

      {links.length > 0 && (
        <section className="drawer-sec">
          <h3>Shares roots with</h3>
          {links.map((l) => {
            const other = forest.byId[l.a === t.id ? l.b : l.a];
            return (
              <button key={other.tree.id} className="link-row" onClick={() => onSelect(other.tree.id)}>
                <Glyph score={other.layout.score} size={11} />
                <span className="link-title">{other.tree.title}</span>
                <span className="link-shared">{l.labels.join(', ')}</span>
                <ChevronRight size={14} />
              </button>
            );
          })}
        </section>
      )}

      {t.live && (
        <button className="btn btn-primary drawer-cta" onClick={() => dispatch({ type: 'forest', open: false })}>
          <MessageSquare size={15} /> Back to this conversation
        </button>
      )}
    </aside>
  );
}
