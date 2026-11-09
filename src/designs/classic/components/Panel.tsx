import { Info, Pause, Play, RotateCcw, Settings as SettingsIcon, Trees, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useDismiss } from '../../../lib/hooks';
import { MODE_META, MODE_SCORE, mean, pct } from '../../../lib/modes';
import { useStore, type State } from '../../../lib/store';
import type { Design, Mode, NudgeLevel, Theme } from '../../../lib/types';
import { AsciiTreeView } from '../../../shared/AsciiTreeView';
import { ArborLogo, Glyph } from './Glyph';
import { Squirrel, type SquirrelPose } from './Squirrel';

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
          {state.settings.mascot ? <Squirrel pose="sleep" size={64} /> : <Pause size={22} />}
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
      {state.settings.mascot ? <Mascot insight={insightFor(state)} /> : <p className="insight">{insightFor(state)}</p>}
    </section>
  );
}

/* ───────────── Mascot ───────────── */

/** While typing, the squirrel reads the composer's lens (feedforward), in the same words as the tags. */
const LENS_LINE: Record<Mode, string> = {
  own: 'You’re reasoning this one through yourself — its leaf will grow in filled.',
  together: 'You’re exploring this with the AI — the leaf will be half yours.',
  ai: 'This one hands the thinking to the AI. Totally fine — just good to know.',
};
const NUDGE_LINE = 'Before you send: what’s your hunch? A rough guess is plenty.';

/** True for a moment after a new prompt labelled "your thinking" arrives. */
function useCheer(count: number, lastMode: Mode | null) {
  const [cheer, setCheer] = useState(false);
  const prev = useRef(count);
  useEffect(() => {
    const grew = count > prev.current;
    prev.current = count;
    if (!grew || lastMode !== 'own') return;
    setCheer(true);
    const t = window.setTimeout(() => setCheer(false), 1500);
    return () => {
      clearTimeout(t);
      setCheer(false);
    };
  }, [count, lastMode]);
  return cheer;
}

/**
 * The squirrel speaks the panel's insight and mirrors who is thinking: live while you type,
 * otherwise the last prompt. Its acorn is the ●◑○ glyph, so it adds no new visual language.
 */
function Mascot({ insight }: { insight: string }) {
  const { state } = useStore();
  const { composer } = state;
  const turns = state.messages.filter((m) => m.role === 'user' && m.classification);
  const lastMode = turns.length ? turns[turns.length - 1].classification!.mode : null;
  const cheer = useCheer(turns.length, lastMode);

  const pose: SquirrelPose = composer.nudge ? 'nudge' : cheer ? 'cheer' : (composer.lens ?? lastMode ?? 'idle');
  const [say, sayKey] = composer.nudge
    ? [NUDGE_LINE, 'nudge']
    : composer.lens
      ? [LENS_LINE[composer.lens], `lens-${composer.lens}`]
      : [insight, `insight-${turns.length}-${lastMode}`];

  return (
    <div className="mascot">
      <p className="insight" key={sayKey}>
        {say}
      </p>
      <Squirrel pose={pose} />
    </div>
  );
}

/* ───────────── Live tree ───────────── */

function LiveTree() {
  const { state, dispatch, liveTree, jumpTo } = useStore();
  const wrap = useRef<HTMLDivElement>(null);
  const highlight = useMemo(() => new Set(state.highlight), [state.highlight]);

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

  return (
    <div className="live-tree" ref={wrap}>
      <AsciiTreeView
        tree={liveTree}
        highlight={highlight}
        onHover={(id) => dispatch({ type: 'highlight', ids: id ? [id] : [] })}
        onJump={jumpTo}
      />
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
const DESIGN_OPTS: { v: Design; label: string }[] = [
  { v: 'classic', label: 'Classic' },
  { v: 'ascii', label: 'ASCII' },
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
          <label className="toggle-row">
            <span>Show squirrel</span>
            <input type="checkbox" checked={s.mascot} onChange={(e) => set({ mascot: e.target.checked })} />
          </label>

          <p className="pop-sub">Theme</p>
          <div className="segmented" role="radiogroup" aria-label="Theme">
            {THEME_OPTS.map((o) => (
              <button key={o.v} role="radio" aria-checked={s.theme === o.v} className={s.theme === o.v ? 'on' : ''} onClick={() => set({ theme: o.v })}>
                {o.label}
              </button>
            ))}
          </div>

          <p className="pop-sub">Design</p>
          <div className="segmented" role="radiogroup" aria-label="Design style">
            {DESIGN_OPTS.map((o) => (
              <button key={o.v} role="radio" aria-checked={s.design === o.v} className={s.design === o.v ? 'on' : ''} onClick={() => set({ design: o.v })}>
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
