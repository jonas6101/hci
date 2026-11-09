import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { CONCEPT_BY_ID, LIVE_TREE } from '../../data/scenario';
import { prefersReducedMotion } from '../../lib/hooks';
import { MODE_META, pct } from '../../lib/modes';
import { useStore } from '../../lib/store';
import type { ChatMessage, Classification, Evidence, Mode } from '../../lib/types';
import { Md, parseMd } from './Md';
import { G, K, Radios, lower, shortReason, typing, useUi } from './ui';

/* The conversation as a two-column log: who · what. */

export function Transcript() {
  const { state } = useStore();
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const { messages, busy, flash } = state;
  const last = messages[messages.length - 1];
  const lastAi = [...messages].reverse().find((m) => m.role === 'assistant');

  // Keep the newest message in view while it streams, unless the user scrolled up.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!flash) return;
    const el = document.getElementById(`a-msg-${flash.id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  }, [flash]);

  const prompts = messages.filter((m) => m.role === 'user').length;

  return (
    <div
      className="a-scroll"
      ref={scroller}
      onScroll={(e) => {
        const el = e.currentTarget;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      }}
    >
      <div className="a-log" aria-live="polite">
        <header className="a-chat-title">
          <h1>{lower(LIVE_TREE.chatTitle)}</h1>
          <span className="a-dim">
            {prompts} prompt{prompts === 1 ? '' : 's'}
          </span>
        </header>
        {messages.length === 0 && (
          <div className="a-empty">
            <p>what do you want to learn today?</p>
            <p className="a-dim">
              ask anything about neural networks, or press <K>tab</K> for a demo prompt.
            </p>
          </div>
        )}
        {messages.map((m) =>
          m.role === 'user' ? <UserMsg key={m.id} m={m} /> : <AiMsg key={m.id} m={m} isLast={m.id === lastAi?.id} />,
        )}
        {busy && last?.role === 'user' && <Thinking />}
      </div>
    </div>
  );
}

/* ───────────── Your messages ───────────── */

/** Brushing: hovering a message lights its leaves, and the link overlay draws a line to them. */
function useBrush(m: ChatMessage) {
  const { state, dispatch } = useStore();
  const { setLink } = useUi();
  const on = state.settings.enabled && m.conceptIds.length > 0;
  return {
    related: state.settings.enabled && m.conceptIds.some((id) => state.highlight.includes(id)),
    onMouseEnter: () => {
      if (!on) return;
      dispatch({ type: 'highlight', ids: m.conceptIds });
      setLink({ kind: 'message', id: m.id });
    },
    onMouseLeave: () => {
      if (!on) return;
      dispatch({ type: 'highlight', ids: [] });
      setLink(null);
    },
  };
}

function UserMsg({ m }: { m: ChatMessage }) {
  const { state } = useStore();
  const { why, setWhy } = useUi();
  const [hot, setHot] = useState<number | null>(null);
  const { related, ...brush } = useBrush(m);
  const c = m.classification;
  const tagged = state.settings.enabled && state.settings.showTags && c;
  const open = tagged && why === m.id;

  return (
    <div id={`a-msg-${m.id}`} className={`a-msg is-user${related ? ' rel' : ''}${open ? ' open' : ''}`} {...brush}>
      <div className="a-who">
        {tagged ? (
          <button
            className="a-who-btn"
            aria-expanded={Boolean(open)}
            aria-label={`${MODE_META[c.mode].label}. ${open ? 'Hide' : 'Show'} why`}
            title="why this label?"
            onClick={() => setWhy(open ? null : m.id)}
          >
            you <G mode={c.mode} />
          </button>
        ) : (
          <span>you</span>
        )}
      </div>
      <div className="a-body">
        <p className="a-user-text">{tagged ? <Marked text={m.text} evidence={c.evidence ?? []} hot={hot} /> : m.text}</p>
        {open && <Why m={m} c={c} onHot={setHot} />}
      </div>
    </div>
  );
}

const MARK: Record<Mode, string> = { own: '─', together: '┄', ai: '~' };

/** Text with the classifier's evidence underlined (solid = you, dashed = together, wavy = AI). */
export function Marked({ text, evidence, hot }: { text: string; evidence: Evidence[]; hot: number | null }) {
  const spans = evidence
    .map((e, i) => ({ ...e, i }))
    .sort((a, b) => a.start - b.start)
    .filter((e, k, arr) => k === 0 || e.start >= arr[k - 1].end);
  const out: ReactNode[] = [];
  let at = 0;
  for (const e of spans) {
    if (e.start > at) out.push(text.slice(at, e.start));
    out.push(
      <span key={e.i} className={`a-ev m-${e.mode}${hot === e.i ? ' hot' : ''}`}>
        {text.slice(e.start, e.end)}
      </span>,
    );
    at = e.end;
  }
  out.push(text.slice(at));
  return <>{out}</>;
}

/** The evidence as diagnostics: the words, and why they made the classifier lean that way. */
export function Diagnostics({
  text,
  c,
  onHot,
}: {
  text: string;
  c: Classification;
  onHot: (i: number | null) => void;
}) {
  const ev = c.evidence ?? [];
  const covered = new Set(ev.map((e) => e.reason));
  const extra = c.reasons.filter((r) => !covered.has(r));
  return (
    <ul className="a-diag">
      {ev.map((e, i) => (
        <li key={i} className={`m-${e.mode}`} onMouseEnter={() => onHot(i)} onMouseLeave={() => onHot(null)}>
          <span className="a-diag-mark">{MARK[e.mode]}</span>
          <span className="a-diag-word">{lower(text.slice(e.start, e.end)).slice(0, 14)}</span>
          <span className="a-diag-why">{shortReason(e.reason)}</span>
        </li>
      ))}
      {extra.map((r) => (
        <li key={r}>
          <span className="a-diag-mark">·</span>
          <span className="a-diag-why">{shortReason(r)}</span>
        </li>
      ))}
    </ul>
  );
}

function Why({ m, c, onHot }: { m: ChatMessage; c: Classification; onHot: (i: number | null) => void }) {
  const { dispatch } = useStore();
  return (
    <div className="a-why" role="region" aria-label="Why this label">
      <p className={`a-why-head m-${c.mode}`}>
        <G mode={c.mode} /> {lower(MODE_META[c.mode].label)} <span className="a-dim">— {lower(MODE_META[c.mode].desc)}</span>
      </p>
      {c.overridden ? <p className="a-dim">relabelled by you.</p> : <Diagnostics text={m.text} c={c} onHot={onHot} />}
      <div className="a-why-fix">
        <span className="a-dim">{c.overridden ? 'label' : `${pct(c.confidence)}% sure · not right?`}</span>
        <Radios<Mode>
          label="Who did the thinking"
          value={c.mode}
          onChange={(mode) => dispatch({ type: 'reclassify', id: m.id, mode })}
          options={[
            { v: 'own', label: <>you</> },
            { v: 'together', label: <>together</> },
            { v: 'ai', label: <>ai</> },
          ]}
        />
      </div>
    </div>
  );
}

/* ───────────── Assistant messages ───────────── */

function AiMsg({ m, isLast }: { m: ChatMessage; isLast: boolean }) {
  const { state } = useStore();
  const { related, ...brush } = useBrush(m);
  const veiled = Boolean(m.veiled) && state.settings.enabled;
  const p = useDecode(Boolean(m.veiled));
  const { total } = parseMd(m.text);
  const stems = m.guess ? guessStems(m.guess) : null;

  const seg = (t: string, at: number): ReactNode => {
    if (veiled) return t.replace(/\S/g, '░');
    if (p !== null) return decode(t, at, p, total);
    if (stems) return markHits(t, stems);
    return t;
  };

  const concept = m.reflectOn ? CONCEPT_BY_ID[m.reflectOn] : undefined;
  const reflect = state.settings.enabled && isLast && concept && !m.streaming && !veiled && !state.busy;

  return (
    <div id={`a-msg-${m.id}`} className={`a-msg is-ai${related ? ' rel' : ''}`} {...brush}>
      <div className="a-who">ai</div>
      <div className="a-body">
        <div className={`a-ai-text${veiled ? ' veiled' : ''}`}>
          <Md text={m.text} seg={seg} tail={m.streaming ? <span className="a-caret">▍</span> : null} />
        </div>
        {veiled && <Veil m={m} />}
        {!veiled && m.guess && stems && <GuessResult guess={m.guess} text={m.text} stems={stems} />}
        {reflect && <Reflect id={concept.id} label={concept.label} />}
      </div>
    </div>
  );
}

/** Predict → reveal: the answer is here, shape and all, but hidden until you guess (or don't). */
function Veil({ m }: { m: ChatMessage }) {
  const { dispatch } = useStore();
  const [guess, setGuess] = useState('');
  const reveal = () => dispatch({ type: 'reveal', id: m.id, guess });
  return (
    <div className="a-veil" role="group" aria-label="Veiled answer">
      <p>
        <span className="a-veil-mark">▒</span> veiled. what do you expect it to say? <span className="a-dim">a rough guess helps it stick.</span>
      </p>
      <form
        className="a-guess"
        onSubmit={(e) => {
          e.preventDefault();
          reveal();
        }}
      >
        <label htmlFor={`g-${m.id}`}>guess ›</label>
        <input
          id={`g-${m.id}`}
          className="a-guess-input"
          value={guess}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          placeholder="type a hunch, or leave it empty"
          onChange={(e) => setGuess(e.target.value)}
        />
        <button type="submit" className="a-btn">
          {guess.trim() ? 'reveal' : 'just show me'}
        </button>
        <K>↵</K>
      </form>
    </div>
  );
}

const STOP = new Set(
  'that this with from have they them then than what when where which while would could should about into your just like some there their these those being been were does also only very much more most will shall because think maybe guess probably something through every each goes going gets using used make made other thing things kind sort really'.split(
    ' ',
  ),
);
const stem = (w: string) => w.toLowerCase().replace(/[^a-z]/g, '').slice(0, 5);
const words = (s: string) => s.match(/[A-Za-z][A-Za-z'-]*/g) ?? [];

function guessStems(guess: string) {
  return new Set(
    words(guess)
      .filter((w) => w.length >= 4 && !STOP.has(w.toLowerCase()))
      .map(stem),
  );
}

/** Words of the answer you already had in your guess light up. */
function markHits(t: string, stems: Set<string>): ReactNode {
  const parts = t.split(/([A-Za-z][A-Za-z'-]*)/g);
  return parts.map((p, i) =>
    i % 2 === 1 && p.length >= 4 && stems.has(stem(p)) ? (
      <mark key={i} className="a-hit">
        {p}
      </mark>
    ) : (
      p
    ),
  );
}

function GuessResult({ guess, text, stems }: { guess: string; text: string; stems: Set<string> }) {
  const plain = text.replace(/[*_]/g, '');
  const hit = [...new Set(words(plain).filter((w) => w.length >= 4 && stems.has(stem(w))).map((w) => w.toLowerCase()))];
  return (
    <div className="a-veil is-done">
      <p>
        <span className="a-dim">your guess ›</span> <span className="a-guess-text">{guess}</span>
      </p>
      <p>
        <G mode="together" />{' '}
        {hit.length
          ? `${hit.length} word${hit.length === 1 ? '' : 's'} you already had: ${hit.slice(0, 6).join(', ')}${hit.length > 6 ? ', …' : '.'}`
          : 'no direct overlap. what did you miss?'}{' '}
        <span className="a-dim">you predicted first, so this one counts as thinking together.</span>
      </p>
    </div>
  );
}

const GLITCH = '#%&*+=?@$/\\<>~░▒';

/** A decode sweep from the veil to the text: a band of noise runs across, leaving letters behind. */
function decode(t: string, at: number, p: number, total: number): string {
  const band = 28;
  const head = p * (total + band);
  let out = '';
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    const g = at + i;
    if (/\s/.test(ch) || g < head - band) out += ch;
    else if (g < head) out += GLITCH[(Math.random() * GLITCH.length) | 0];
    else out += '░';
  }
  return out;
}

/** Progress (0..1) of the decode sweep right after a veiled answer is revealed; null otherwise. */
function useDecode(veiled: boolean) {
  const [p, setP] = useState<number | null>(null);
  const was = useRef(veiled);
  useEffect(() => {
    const before = was.current;
    was.current = veiled;
    if (!before || veiled || prefersReducedMotion()) return;
    const start = performance.now();
    const dur = 900;
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / dur);
      setP(k >= 1 ? null : k);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [veiled]);
  return p;
}

/** "Make it yours": explain it back (generation) or get quizzed (retrieval). Keys e / q. */
function Reflect({ id, label }: { id: string; label: string }) {
  const { send } = useStore();
  const { fill } = useUi();
  const explain = () => fill(`In my own words, ${label.toLowerCase()} is `);
  const quiz = () => send(`Quiz me on ${label.toLowerCase()}`);
  const ref = useRef({ explain, quiz });
  ref.current = { explain, quiz };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'e') {
        e.preventDefault();
        ref.current.explain();
      } else if (e.key === 'q') {
        e.preventDefault();
        ref.current.quiz();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [id]);
  return (
    <p className="a-reflect" aria-label="Arbor suggestion">
      <span className="a-dim">↳ make “{label.toLowerCase()}” yours</span>
      <button className="a-btn" onClick={explain}>
        <u>e</u>xplain it back
      </button>
      <button className="a-btn" onClick={quiz}>
        <u>q</u>uiz me
      </button>
    </p>
  );
}

const SPIN = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';

function Thinking() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const t = window.setInterval(() => setI((x) => (x + 1) % SPIN.length), 80);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="a-msg is-ai" aria-label="Assistant is thinking">
      <div className="a-who">ai</div>
      <div className="a-body a-dim">
        <span className="a-spin">{SPIN[i]}</span> thinking
      </div>
    </div>
  );
}
