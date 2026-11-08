import { Info, Pause, Play, RotateCcw, Settings as SettingsIcon, Trees, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { layoutTree, type PlacedBranch, type PlacedLeaf } from '../lib/layout';
import { useDismiss, useSize } from '../lib/hooks';
import { MODE_META, MODE_SCORE, mean, pct, scoreToMode } from '../lib/modes';
import { useStore, type State } from '../lib/store';
import type { NudgeLevel, Theme } from '../lib/types';
import { ArborLogo, Glyph } from './Glyph';
import { TreeSvg, type LeafEvent } from './TreeSvg';

export function ArborPanel() {
  const { state, dispatch, liveTree } = useStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const enabled = state.settings.enabled;

  return (
    <aside className="panel" aria-label="Arbor">
      <header className="panel-head">
        <div className="panel-brand">
          <ArborLogo size={20} />
          <span>Arbor</span>
        </div>
        <div className="panel-actions">
          <SettingsMenu open={settingsOpen} setOpen={setSettingsOpen} />
          <button className="icon-btn" aria-label="Close Arbor panel" onClick={() => dispatch({ type: 'panel', open: false })}>
            <X size={16} />
          </button>
        </div>
      </header>

      {!enabled ? (
        <div className="panel-paused">
          <Pause size={22} />
          <h3>Arbor is paused</h3>
          <p>The chat now looks exactly as it would without the extension. Nothing is labelled or collected.</p>
          <button className="btn btn-you" onClick={() => dispatch({ type: 'settings', patch: { enabled: true } })}>
            <Play size={14} /> Resume Arbor
          </button>
        </div>
      ) : (
        <>
          <Balance />
          <div className="tree-head">
            <div>
              <p className="eyebrow">Knowledge tree</p>
              <h2>{liveTree.title}</h2>
            </div>
            <button
              className="btn btn-sm"
              onClick={() => dispatch({ type: 'forest', open: true })}
              title="Zoom out to see all your knowledge (or pinch out on the tree)"
            >
              <Trees size={14} /> Forest
            </button>
          </div>
          <LiveTree />
          <Legend />
        </>
      )}
    </aside>
  );
}

/* ───────────── Who's thinking ───────────── */

function insightFor(state: State): string {
  const turns = state.messages.filter((m) => m.role === 'user' && m.classification);
  if (!turns.length) return 'Start chatting — Arbor reflects who is doing the thinking.';
  const modes = turns.map((t) => t.classification!.mode);
  const last = turns[turns.length - 1];
  const lastMode = modes[modes.length - 1];
  const concept = last.conceptIds.map((id) => state.concepts[id]?.label).find(Boolean);
  if (modes.length >= 3 && modes.slice(-3).every((m) => m === 'ai'))
    return 'Your last three prompts handed the thinking to the AI. Try putting one answer in your own words.';
  if (lastMode === 'own')
    return concept ? `You reasoned through “${concept}” yourself — its leaf is filled in.` : 'You brought your own reasoning to the last prompt.';
  if (lastMode === 'together')
    return concept ? `You explored “${concept}” with the AI rather than just taking an answer.` : 'You explored the last question with the AI.';
  return concept
    ? `You delegated “${concept}”. Fine for quick facts — for things you want to learn, try a guess first.`
    : 'You delegated the last prompt. Fine for quick facts — for things you want to learn, try a guess first.';
}

function Balance() {
  const { state, jumpTo } = useStore();
  const turns = state.messages.filter((m) => m.role === 'user' && m.classification);
  const you = turns.length ? pct(mean(turns.map((t) => MODE_SCORE[t.classification!.mode]))) : 50;

  return (
    <section className="balance" aria-labelledby="balance-title">
      <div className="section-row">
        <p className="eyebrow" id="balance-title">
          Who’s thinking
        </p>
        <span className="muted small">
          {turns.length} prompt{turns.length === 1 ? '' : 's'} in this chat
        </span>
      </div>
      <div className="balance-nums">
        <span className="num-you">
          <Glyph mode="own" size={12} /> You <strong>{turns.length ? `${you}%` : '–'}</strong>
        </span>
        <span className="num-ai">
          <strong>{turns.length ? `${100 - you}%` : '–'}</strong> AI <Glyph mode="ai" size={12} />
        </span>
      </div>
      <div className="balance-bar" role="img" aria-label={`You did ${you}% of the thinking, the AI ${100 - you}%`}>
        <div className="seg seg-you" style={{ width: `${you}%` }} />
        <div className="seg seg-ai" style={{ width: `${100 - you}%` }} />
      </div>
      {turns.length > 0 && (
        <div className="trail" aria-label="Thinking trail — one mark per prompt, oldest first">
          {turns.map((t, i) => (
            <button
              key={t.id}
              className="trail-dot"
              onClick={() => jumpTo(t.id)}
              aria-label={`Prompt ${i + 1}: ${MODE_META[t.classification!.mode].label}. Jump to message`}
              title={`${MODE_META[t.classification!.mode].label} — “${t.text.slice(0, 60)}${t.text.length > 60 ? '…' : ''}”`}
            >
              <Glyph mode={t.classification!.mode} size={12} />
            </button>
          ))}
        </div>
      )}
      <p className="insight">{insightFor(state)}</p>
    </section>
  );
}

/* ───────────── Live tree ───────────── */

interface Tip {
  x: number;
  y: number;
  leaf: PlacedLeaf;
  branch: PlacedBranch;
}

function LiveTree() {
  const { state, dispatch, liveTree, jumpTo } = useStore();
  const wrap = useRef<HTMLDivElement>(null);
  const { w } = useSize(wrap);
  const layout = useMemo(() => layoutTree(liveTree), [liveTree]);
  const highlight = useMemo(() => new Set(state.highlight), [state.highlight]);
  const [tip, setTip] = useState<Tip | null>(null);
  const prevCount = useRef(layout.count);

  const W = Math.max(w, 300);
  const top = layout.top - 18;
  const bottom = 56;
  const height = bottom - top;

  // Bring a newly sprouted leaf into view.
  useEffect(() => {
    if (layout.count > prevCount.current && wrap.current) {
      const newest = Object.values(state.concepts).sort((a, b) => b.order - a.order)[0];
      const b = layout.branches.find((br) => br.leaves.some((l) => l.id === newest?.id));
      const l = b?.leaves.find((x) => x.id === newest?.id);
      if (b && l) {
        const y = b.base + l.y - top;
        wrap.current.scrollTo({ top: Math.max(0, y - wrap.current.clientHeight / 2), behavior: 'smooth' });
      }
    }
    prevCount.current = layout.count;
  }, [layout, state.concepts, top]);

  // Semantic zoom: pinching out on the tree zooms out to the forest.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey && e.deltaY > 4) {
        e.preventDefault();
        dispatch({ type: 'forest', open: true });
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [dispatch]);

  const onEnter = ({ leaf, branch, event }: LeafEvent) => {
    const r = (event.currentTarget.querySelector('.sprout') as Element).getBoundingClientRect();
    const x = Math.min(window.innerWidth - 135, Math.max(135, r.left + r.width / 2));
    setTip({ x, y: r.top, leaf, branch });
    dispatch({ type: 'highlight', ids: [leaf.id] });
  };
  const onLeave = () => {
    setTip(null);
    dispatch({ type: 'highlight', ids: [] });
  };

  return (
    <div className="live-tree" ref={wrap}>
      {layout.branches.length === 0 ? (
        <div className="tree-empty">
          <svg width="80" height="70" viewBox="-40 -60 80 70" aria-hidden="true">
            <path d="M0,0 L0,-30" className="limb" />
            <path d="M0,-18 C-8,-26 -16,-26 -20,-22 C-14,-16 -6,-14 0,-18" className="seed-leaf" />
            <path d="M0,-26 C8,-36 18,-36 22,-31 C14,-24 6,-22 0,-26" className="seed-leaf" />
            <line x1="-30" x2="30" y1="0" y2="0" className="ground" />
          </svg>
          <p>Your tree grows as you explore topics in this chat.</p>
        </div>
      ) : (
        <svg
          className="tree-svg"
          width={W}
          height={height}
          viewBox={`${-W / 2} ${top} ${W} ${height}`}
          role="img"
          aria-label={`Knowledge tree for ${liveTree.title}: ${layout.count} concepts, ${pct(layout.score)}% your thinking`}
        >
          <line className="ground" x1={-80} x2={80} y1={0} y2={0} />
          <TreeSvg
            layout={layout}
            showLabels
            labelRoom={W / 2}
            highlight={highlight}
            onLeafEnter={onEnter}
            onLeafLeave={onLeave}
            onLeafClick={({ leaf }) => leaf.messageId && jumpTo(leaf.messageId)}
          />
          <text className="root-title" x={0} y={24} textAnchor="middle">
            {liveTree.title}
          </text>
          <text className="root-meta" x={0} y={40} textAnchor="middle">
            {layout.count} concepts · {pct(layout.score)}% your thinking
          </text>
        </svg>
      )}
      {tip && (
        <div className="tooltip" style={{ left: tip.x, top: tip.y }} role="tooltip">
          <strong>{tip.leaf.label}</strong>
          <span className="tip-mode">
            <Glyph score={tip.leaf.score} size={11} /> {MODE_META[scoreToMode(tip.leaf.score)].label}
          </span>
          <span className="tip-meta">
            {tip.branch.label} · {tip.leaf.count ?? 1} message{(tip.leaf.count ?? 1) === 1 ? '' : 's'} · click to jump
          </span>
        </div>
      )}
    </div>
  );
}

function Legend() {
  const { dispatch } = useStore();
  return (
    <footer className="legend">
      <span>
        <Glyph mode="own" size={11} /> You
      </span>
      <span>
        <Glyph mode="together" size={11} /> Together
      </span>
      <span>
        <Glyph mode="ai" size={11} /> AI
      </span>
      <button className="icon-btn" aria-label="How Arbor works" onClick={() => dispatch({ type: 'onboarding', open: true })}>
        <Info size={15} />
      </button>
    </footer>
  );
}

/* ───────────── Settings ───────────── */

const NUDGE_OPTS: { v: NudgeLevel; label: string; desc: string }[] = [
  { v: 'off', label: 'Off', desc: 'No labels while typing, no interruptions.' },
  { v: 'gentle', label: 'Gentle', desc: 'A live label while you type. Never interrupts.' },
  { v: 'active', label: 'Active', desc: 'Before you delegate, Arbor offers to add your own take first.' },
];
const THEME_OPTS: { v: Theme; label: string }[] = [
  { v: 'system', label: 'System' },
  { v: 'light', label: 'Light' },
  { v: 'dark', label: 'Dark' },
];

function SettingsMenu({ open, setOpen }: { open: boolean; setOpen: (o: boolean) => void }) {
  const { state, dispatch, toast } = useStore();
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));
  const s = state.settings;
  const set = (patch: Partial<typeof s>) => dispatch({ type: 'settings', patch });

  return (
    <div className="settings-wrap" ref={ref}>
      <button className="icon-btn" aria-label="Arbor settings" aria-expanded={open} onClick={() => setOpen(!open)}>
        <SettingsIcon size={16} />
      </button>
      {open && (
        <div className="popover settings-pop" role="dialog" aria-label="Arbor settings">
          <p className="pop-sub">Nudges</p>
          <div className="segmented" role="radiogroup" aria-label="Nudges">
            {NUDGE_OPTS.map((o) => (
              <button key={o.v} role="radio" aria-checked={s.nudge === o.v} className={s.nudge === o.v ? 'on' : ''} onClick={() => set({ nudge: o.v })}>
                {o.label}
              </button>
            ))}
          </div>
          <p className="pop-desc">{NUDGE_OPTS.find((o) => o.v === s.nudge)?.desc}</p>

          <label className="toggle-row">
            <span>Label my messages</span>
            <input type="checkbox" checked={s.showTags} onChange={(e) => set({ showTags: e.target.checked })} />
          </label>

          <p className="pop-sub">Theme</p>
          <div className="segmented" role="radiogroup" aria-label="Theme">
            {THEME_OPTS.map((o) => (
              <button key={o.v} role="radio" aria-checked={s.theme === o.v} className={s.theme === o.v ? 'on' : ''} onClick={() => set({ theme: o.v })}>
                {o.label}
              </button>
            ))}
          </div>

          <div className="pop-sep" />
          <button
            className="menu-item"
            onClick={() => {
              set({ enabled: false });
              setOpen(false);
            }}
          >
            <Pause size={14} /> Pause Arbor
          </button>
          <button
            className="menu-item"
            onClick={() => {
              dispatch({ type: 'onboarding', open: true });
              setOpen(false);
            }}
          >
            <Info size={14} /> Replay introduction
          </button>
          <div className="pop-sep" />
          <p className="pop-sub">Demo</p>
          <button
            className="menu-item"
            onClick={() => {
              dispatch({ type: 'reset', empty: false });
              setOpen(false);
              toast('Demo reset to the starting conversation.');
            }}
          >
            <RotateCcw size={14} /> Reset conversation
          </button>
          <button
            className="menu-item"
            onClick={() => {
              dispatch({ type: 'reset', empty: true });
              setOpen(false);
              toast('Started from an empty chat — watch the tree grow from a seed.');
            }}
          >
            <RotateCcw size={14} /> Start from an empty chat
          </button>
        </div>
      )}
    </div>
  );
}
