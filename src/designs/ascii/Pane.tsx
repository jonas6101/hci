import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { CONCEPT_BY_ID } from '../../data/scenario';
import { useDismiss } from '../../lib/hooks';
import { MODE_META, MODE_SCORE, mean, pct } from '../../lib/modes';
import { TIME_MAX, TIME_TICKS, daysAt, formatDays, posOf, retention } from '../../lib/retention';
import { useStore, type State } from '../../lib/store';
import type { Mode, NudgeLevel, Theme } from '../../lib/types';
import { AsciiTreeView } from '../../shared/AsciiTreeView';
import { Squirrel, type Pose } from './Squirrel';
import { Check, G, K, Radios, lower, useUi } from './ui';

export function Pane() {
  const { state, dispatch } = useStore();
  const { setSheet } = useUi();
  const [settings, setSettings] = useState(false);

  return (
    <aside className="a-pane" aria-label="Arbor">
      <header className="a-pane-head">
        <span className="a-brand">arbor</span>
        <span className="a-pane-actions">
          <button className="a-icon" onClick={() => setSheet('concepts')} aria-label="Interaction concepts" title="interaction concepts  ?">
            ?
          </button>
          <Settings open={settings} setOpen={setSettings} />
          <button className="a-icon" aria-label="Close the Arbor pane" title="close" onClick={() => dispatch({ type: 'panel', open: false })}>
            ×
          </button>
        </span>
      </header>

      {state.settings.enabled ? (
        <>
          <Balance />
          {state.settings.mascot && <Companion />}
          <TreeSection />
        </>
      ) : (
        <div className="a-paused">
          {state.settings.mascot && <Squirrel pose="sleep" />}
          <p>arbor is paused.</p>
          <p className="a-dim">the chat looks exactly as it would without the extension. nothing is labelled or collected.</p>
          <button className="a-btn" onClick={() => dispatch({ type: 'settings', patch: { enabled: true } })}>
            resume
          </button>
        </div>
      )}
    </aside>
  );
}

/* ───────────── Who's thinking ───────────── */

const BAR = 24;

/** Count up/down to a new value so changes in the bar are visible as motion. */
function useTween(value: number, ms = 450) {
  const [v, setV] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      const x = a + (value - a) * (1 - (1 - k) ** 3);
      from.current = x;
      setV(x);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return v;
}

function Balance() {
  const { state, jumpTo } = useStore();
  const turns = state.messages.filter((m) => m.role === 'user' && m.classification);
  const you = turns.length ? mean(turns.map((t) => MODE_SCORE[t.classification!.mode])) : 0.5;
  const shown = useTween(you);
  const filled = Math.round(shown * BAR);

  return (
    <section className="a-balance" aria-label="Who's thinking">
      <p className="a-row">
        <span>who’s thinking</span>
        <span className="a-dim">
          {turns.length} prompt{turns.length === 1 ? '' : 's'}
        </span>
      </p>
      <p className="a-bar" role="img" aria-label={`You did ${pct(you)}% of the thinking, the AI ${100 - pct(you)}%`}>
        <span className="a-bar-you">you {turns.length ? `${pct(shown)}%`.padStart(4) : '  –'}</span>{' '}
        <span className="a-bar-y">{'█'.repeat(filled)}</span>
        <span className="a-bar-a">{'░'.repeat(BAR - filled)}</span>{' '}
        <span className="a-bar-ai">{turns.length ? `${100 - pct(shown)}%`.padEnd(4) : '–  '} ai</span>
      </p>
      {turns.length > 0 && (
        <p className="a-trail" aria-label="Thinking trail, one mark per prompt, oldest first">
          <span className="a-dim">trail </span>
          {turns.map((t, i) => (
            <button
              key={t.id}
              className="a-trail-g"
              onClick={() => jumpTo(t.id)}
              aria-label={`Prompt ${i + 1}: ${MODE_META[t.classification!.mode].label}. Jump to message`}
              title={`${lower(MODE_META[t.classification!.mode].label)} — “${t.text.slice(0, 60)}${t.text.length > 60 ? '…' : ''}”`}
            >
              <G mode={t.classification!.mode} />
            </button>
          ))}
        </p>
      )}
    </section>
  );
}

/* ───────────── Squirrel and what it says ───────────── */

function insightFor(state: State): string {
  const turns = state.messages.filter((m) => m.role === 'user' && m.classification);
  if (!turns.length) return 'start chatting. i’ll reflect who is doing the thinking.';
  const modes = turns.map((t) => t.classification!.mode);
  const last = turns[turns.length - 1];
  const lastMode = modes[modes.length - 1];
  const concept = last.conceptIds.map((id) => state.concepts[id]?.label.toLowerCase()).find(Boolean);
  if (modes.length >= 3 && modes.slice(-3).every((m) => m === 'ai'))
    return 'your last three prompts handed the thinking to the ai. try one answer in your own words?';
  if (lastMode === 'own')
    return concept ? `you reasoned through “${concept}” yourself. its leaf is filled in.` : 'you brought your own reasoning to that one.';
  if (lastMode === 'together')
    return concept ? `you explored “${concept}” with the ai instead of just taking an answer.` : 'you explored that one with the ai.';
  return concept
    ? `you delegated “${concept}”. fine for quick facts. for things you want to learn, try a guess first.`
    : 'you delegated that one. fine for quick facts. for things you want to learn, try a guess first.';
}

const LENS_LINE: Record<Mode, string> = {
  own: 'you’re reasoning this one through yourself. its leaf will grow in filled.',
  together: 'you’re exploring this with the ai. the leaf will be half yours.',
  ai: 'this one hands the thinking to the ai. totally fine, just good to know.',
};

/** True for a moment after a new prompt labelled "your thinking" arrives. */
function useCheer(count: number, lastMode: Mode | null) {
  const [cheer, setCheer] = useState(false);
  const prev = useRef(count);
  useEffect(() => {
    const grew = count > prev.current;
    prev.current = count;
    if (!grew || lastMode !== 'own') return;
    setCheer(true);
    const t = window.setTimeout(() => setCheer(false), 1400);
    return () => {
      clearTimeout(t);
      setCheer(false);
    };
  }, [count, lastMode]);
  return cheer;
}

interface Tip {
  text: string;
  action?: { label: string; run: () => void };
}

/** Poking the squirrel cycles through things worth knowing right now, each with something to do. */
function useTips(): Tip[] {
  const { state, dispatch, liveTree, send } = useStore();
  const { days, setDays } = useUi();
  const leaves = liveTree.branches.flatMap((b) => b.leaves);
  const weakest = [...leaves].filter((l) => CONCEPT_BY_ID[l.id]).sort((a, b) => a.score - b.score)[0];
  const tips: Tip[] = [];
  if (weakest && weakest.score < 1) {
    const label = weakest.label.toLowerCase();
    tips.push({
      text: `“${label}” is ${weakest.score === 0 ? 'still all the ai’s' : 'only half yours'}. want me to quiz you on it?`,
      action: state.busy ? undefined : { label: 'quiz me', run: () => send(`Quiz me on ${label}`) },
    });
  } else if (leaves.length) {
    tips.push({ text: 'every leaf on this tree is yours. i’m impressed.' });
  }
  if (leaves.length)
    tips.push(
      days > 0
        ? { text: 'that’s the future. want to come back to now?', action: { label: 'back to now', run: () => setDays(0) } }
        : { text: 'curious what sticks? i can skip ahead a week.', action: { label: 'skip ahead', run: () => setDays(7) } },
    );
  tips.push({
    text: 'every chat you have grows a tree. pinch out on this one to see the forest.',
    action: { label: 'forest', run: () => dispatch({ type: 'forest', open: true }) },
  });
  return tips;
}

const DIZZY_LINE = 'whoa. okay. okay. i’m dizzy.';

function Companion() {
  const { state } = useStore();
  const turns = state.messages.filter((m) => m.role === 'user' && m.classification);
  const lastMode = turns.length ? turns[turns.length - 1].classification!.mode : null;
  const cheer = useCheer(turns.length, lastMode);
  const veiled = state.messages.some((m) => m.veiled);
  const lens = state.composer.lens;

  const pose: Pose = veiled ? 'nudge' : cheer ? 'cheer' : (lens ?? lastMode ?? 'idle');
  const [say, key] = veiled
    ? ['it’s veiled for now. what’s your hunch? a rough guess is plenty.', 'veil']
    : lens
      ? [LENS_LINE[lens], `lens-${lens}`]
      : [insightFor(state), `in-${turns.length}-${lastMode}`];

  // A tip holds the floor until something new happens, or for a while.
  const tips = useTips();
  const [tip, setTip] = useState<{ i: number; n: number } | null>(null);
  useEffect(() => setTip(null), [key]);
  useEffect(() => {
    if (!tip) return;
    const t = window.setTimeout(() => setTip(null), 10000);
    return () => clearTimeout(t);
  }, [tip]);
  const poke = (dizzy: boolean) =>
    setTip((t) => ({ i: dizzy ? -1 : t && t.i >= 0 ? (t.i + 1) % tips.length : 0, n: (t?.n ?? 0) + 1 }));
  const shown = tip ? (tip.i < 0 ? { text: DIZZY_LINE } : tips[Math.min(tip.i, tips.length - 1)]) : null;

  return (
    <section className="a-companion">
      <Squirrel pose={pose} onPoke={poke} />
      <p className={`a-say${shown ? ' is-tip' : ''}`} key={shown ? `tip-${tip!.n}` : key} aria-live="polite">
        {shown ? shown.text : say}
        {shown?.action && (
          <>
            {' '}
            <button
              className="a-btn"
              onClick={() => {
                shown.action!.run();
                setTip(null);
              }}
            >
              {shown.action.label}
            </button>
          </>
        )}
      </p>
    </section>
  );
}

/* ───────────── Tree ───────────── */

function TreeSection() {
  const { state, dispatch, liveTree, jumpTo, send } = useStore();
  const { view, setView, days, setDays, setLink } = useUi();
  const wrap = useRef<HTMLDivElement>(null);
  const highlight = useMemo(() => new Set(state.highlight), [state.highlight]);
  const messageOf = useMemo(
    () => new Map(liveTree.branches.flatMap((b) => b.leaves.map((l) => [l.id, l.messageId] as const))),
    [liveTree],
  );
  const keep = useMemo(
    () => new Map(liveTree.branches.flatMap((b) => b.leaves.map((l) => [l.id, retention(l.score, days, l.count ?? 1)] as const))),
    [liveTree, days],
  );

  // Semantic zoom: pinching out on the tree zooms out to the forest.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    let acc = 0;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      acc = Math.max(0, acc + e.deltaY);
      if (acc > 40) {
        acc = 0;
        dispatch({ type: 'forest', open: true });
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [dispatch]);

  return (
    <section className="a-tree" aria-label="Knowledge tree">
      <p className="a-row a-tree-head">
        <span>knowledge tree</span>
        <Radios
          label="Tree view"
          value={view}
          onChange={setView}
          options={[
            { v: 'tree', label: 'tree' },
            { v: 'outline', label: 'outline' },
          ]}
        />
      </p>
      <div className="a-tree-scroll" ref={wrap}>
        <AsciiTreeView
          tree={liveTree}
          view={view}
          retention={days > 0 ? keep : undefined}
          highlight={highlight}
          onHover={(id) => {
            dispatch({ type: 'highlight', ids: id ? [id] : [] });
            setLink(id ? { kind: 'leaf', id, messageId: messageOf.get(id) } : null);
          }}
          onJump={jumpTo}
          onNodeKey={(n, e) => {
            if (e.key === 'q' && n.kind === 'leaf' && CONCEPT_BY_ID[n.id]) {
              e.preventDefault();
              e.stopPropagation(); // the "make it yours" shortcut listens for q too
              send(`Quiz me on ${n.fullLabel.toLowerCase()}`);
            }
          }}
        />
      </div>
      <footer className="a-tree-foot">
        <Scrubber days={days} setDays={setDays} />
        <p className="a-row a-legend">
          <span>
            <G mode="own" /> you <G mode="together" /> together <G mode="ai" /> ai
          </span>
          <button className="a-btn" onClick={() => dispatch({ type: 'forest', open: true })} title="zoom out to the forest (or pinch out on the tree)">
            <u>f</u>orest
          </button>
        </p>
      </footer>
    </section>
  );
}

/* ───────────── Forgetting scrubber ───────────── */

/**
 * Drag time forward to see what would fade if you stopped reviewing. Log-scaled, so the first
 * days (when most forgetting happens) get the most room. Keys: ← → step between ticks, [ ] too.
 */
export function Scrubber({ days, setDays, width = 26 }: { days: number; setDays: (d: number) => void; width?: number }) {
  const track = useRef<HTMLSpanElement>(null);
  const drag = useRef(false);
  const at = (d: number) => Math.round(posOf(d) * (width - 1));
  const thumb = at(days);
  const ticks = new Set(TIME_TICKS.slice(1, -1).map((t) => at(t.days)));

  const fromPointer = (e: RPointerEvent) => {
    const r = track.current?.getBoundingClientRect();
    if (!r) return;
    setDays(daysAt((e.clientX - r.left) / r.width));
  };
  const step = (dir: 1 | -1) => {
    const stops = TIME_TICKS.map((t) => t.days);
    const next = dir > 0 ? stops.find((d) => d > days) : [...stops].reverse().find((d) => d < days);
    setDays(next ?? (dir > 0 ? TIME_MAX : 0));
  };

  return (
    <div className="a-scrub">
      <p className="a-row">
        <span>
          fade{' '}
          <button className="a-scrub-now" onClick={() => setDays(0)} aria-label="Back to now">
            now
          </button>{' '}
          <span
            ref={track}
            className="a-scrub-track"
            role="slider"
            tabIndex={0}
            aria-label="Preview forgetting over time"
            aria-valuemin={0}
            aria-valuemax={TIME_MAX}
            aria-valuenow={days}
            aria-valuetext={formatDays(days)}
            onPointerDown={(e) => {
              drag.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              fromPointer(e);
            }}
            onPointerMove={(e) => drag.current && fromPointer(e)}
            onPointerUp={() => (drag.current = false)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowUp') step(1);
              else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') step(-1);
              else if (e.key === 'Home') setDays(0);
              else if (e.key === 'End') setDays(TIME_MAX);
              else return;
              e.preventDefault();
            }}
          >
            {Array.from({ length: width }, (_, i) =>
              i === thumb ? (
                <span key={i} className="a-scrub-thumb">
                  ●
                </span>
              ) : (
                <span key={i} className={i < thumb ? 'a-scrub-done' : undefined}>
                  {i < thumb ? '━' : ticks.has(i) ? '┼' : i === width - 1 ? '┤' : '─'}
                </span>
              ),
            )}
          </span>{' '}
          <span className="a-dim">3m</span>
        </span>
        <span className={days ? 'a-scrub-val' : 'a-dim'}>{formatDays(days)}</span>
      </p>
      {days > 0 && (
        <p className="a-scrub-note a-dim">
          if you stopped reviewing: delegated ideas fade first. <span title="Ebbinghaus-style curve; stability grows with your own thinking (generation effect) and with repeat visits">illustrative model</span>.
        </p>
      )}
    </div>
  );
}

/* ───────────── Settings ───────────── */

const NUDGE_DESC: Record<NudgeLevel, string> = {
  off: 'no lint, no veil. your messages keep their labels.',
  gentle: 'a live lint while you type. never in your way.',
  active: 'the lint, and delegated answers arrive veiled so you can guess first.',
};

function Settings({ open, setOpen }: { open: boolean; setOpen: (o: boolean) => void }) {
  const { state, dispatch, toast } = useStore();
  const { setSheet, setDays } = useUi();
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));
  const s = state.settings;
  const set = (patch: Partial<typeof s>) => dispatch({ type: 'settings', patch });
  const close = () => setOpen(false);

  return (
    <div className="a-settings-wrap" ref={ref}>
      <button className="a-icon" aria-label="Arbor settings" aria-expanded={open} title="settings" onClick={() => setOpen(!open)}>
        ⚙
      </button>
      {open && (
        <div className="a-pop a-settings" role="dialog" aria-label="Arbor settings">
          <p className="a-pop-title">settings</p>
          <div className="a-set">
            <span className="a-set-k">nudges</span>
            <Radios<NudgeLevel>
              label="Nudges"
              value={s.nudge}
              onChange={(v) => set({ nudge: v })}
              options={[
                { v: 'off', label: 'off' },
                { v: 'gentle', label: 'gentle' },
                { v: 'active', label: 'active' },
              ]}
            />
          </div>
          <p className="a-set-desc a-dim">{NUDGE_DESC[s.nudge]}</p>
          <div className="a-set">
            <span className="a-set-k">show</span>
            <span>
              <Check checked={s.showTags} onChange={(v) => set({ showTags: v })}>
                labels
              </Check>{' '}
              <Check checked={s.mascot} onChange={(v) => set({ mascot: v })}>
                squirrel
              </Check>
            </span>
          </div>
          <div className="a-set">
            <span className="a-set-k">theme</span>
            <Radios<Theme>
              label="Theme"
              value={s.theme}
              onChange={(v) => set({ theme: v })}
              options={[
                { v: 'system', label: 'system' },
                { v: 'light', label: 'light' },
                { v: 'dark', label: 'dark' },
              ]}
            />
          </div>
          <div className="a-set">
            <span className="a-set-k">design</span>
            <Radios
              label="Design style"
              value={s.design}
              onChange={(v) => set({ design: v })}
              options={[
                { v: 'ascii', label: 'ascii' },
                { v: 'classic', label: 'classic' },
              ]}
            />
          </div>
          <p className="a-pop-actions">
            <button className="a-btn" onClick={() => (set({ enabled: false }), close())}>
              pause arbor
            </button>
            <button className="a-btn" onClick={() => (setSheet('concepts'), close())}>
              concepts
            </button>
            <button className="a-btn" onClick={() => (dispatch({ type: 'onboarding', open: true }), close())}>
              intro
            </button>
          </p>
          <p className="a-pop-actions">
            <span className="a-dim">demo</span>
            <button className="a-btn" onClick={() => (dispatch({ type: 'reset', empty: false }), setDays(0), close(), toast('demo reset'))}>
              reset
            </button>
            <button
              className="a-btn"
              onClick={() => (dispatch({ type: 'reset', empty: true }), setDays(0), close(), toast('empty chat: watch the tree grow from a seed'))}
            >
              empty chat
            </button>
          </p>
          <p className="a-dim a-pop-foot">
            or type <K>/</K> for commands
          </p>
        </div>
      )}
    </div>
  );
}
