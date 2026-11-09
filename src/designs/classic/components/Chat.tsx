import { ArrowUp, FlaskConical, Lightbulb, PenLine, Sparkles, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CONCEPT_BY_ID, DEMO_PROMPTS, LIVE_TREE } from '../../../data/scenario';
import { useDismiss } from '../../../lib/hooks';
import { MODES, MODE_META, pct } from '../../../lib/modes';
import { useStore } from '../../../lib/store';
import type { ChatMessage, Classification } from '../../../lib/types';
import { ArborLogo, Glyph } from './Glyph';
import { Markdown } from './Markdown';

export function ChatView() {
  const { state } = useStore();
  const listRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const { messages, busy, flash } = state;
  const last = messages[messages.length - 1];
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');

  // Keep the newest message in view while streaming, unless the user scrolled up.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!flash) return;
    const el = document.getElementById(`msg-${flash.id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  }, [flash]);

  return (
    <main className="chat" aria-label="Conversation">
      <header className="chat-head">
        <h1>{LIVE_TREE.chatTitle}</h1>
      </header>
      <div
        className="chat-scroll"
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
      >
        <div className="chat-list" aria-live="polite">
          {messages.length === 0 && (
            <div className="chat-empty">
              <h2>What do you want to learn today?</h2>
              <p>Ask anything about neural networks — or pick a demo prompt below.</p>
            </div>
          )}
          {messages.map((m) =>
            m.role === 'user' ? (
              <UserMessage key={m.id} m={m} />
            ) : (
              <AssistantMessage key={m.id} m={m} showReflect={m.id === lastAssistant?.id} />
            ),
          )}
          {busy && last?.role === 'user' && (
            <div className="msg assistant">
              <div className="ai-avatar" aria-hidden="true">
                <Sparkles size={14} />
              </div>
              <div className="thinking" aria-label="Assistant is thinking">
                <i />
                <i />
                <i />
              </div>
            </div>
          )}
        </div>
      </div>
      <Composer />
    </main>
  );
}

function UserMessage({ m }: { m: ChatMessage }) {
  const { state, dispatch } = useStore();
  const { enabled, showTags } = state.settings;
  const related = enabled && m.conceptIds.some((id) => state.highlight.includes(id));
  return (
    <div
      id={`msg-${m.id}`}
      className={`msg user ${related ? 'related' : ''}`}
      onMouseEnter={() => enabled && dispatch({ type: 'highlight', ids: m.conceptIds })}
      onMouseLeave={() => enabled && dispatch({ type: 'highlight', ids: [] })}
    >
      <div className="bubble">{m.text}</div>
      {enabled && showTags && m.classification && <MessageTag m={m} c={m.classification} />}
    </div>
  );
}

/** Arbor's label on a user message — with its reasons and a way to correct it. */
function MessageTag({ m, c }: { m: ChatMessage; c: Classification }) {
  const { dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));
  const meta = MODE_META[c.mode];
  const toggle = () => {
    const r = ref.current?.getBoundingClientRect();
    setUp(Boolean(r && r.bottom > window.innerHeight * 0.55));
    setOpen(!open);
  };
  return (
    <div className="tag-wrap" ref={ref}>
      <button
        className={`tag mode-${c.mode}`}
        onClick={toggle}
        aria-expanded={open}
        aria-label={`Arbor: ${meta.label}. Show why`}
      >
        <Glyph mode={c.mode} size={11} />
        {meta.label}
        {c.overridden && <span className="tag-edited">· edited</span>}
      </button>
      {open && (
        <div className={`popover tag-pop ${up ? 'up' : ''}`} role="dialog" aria-label="Why this label">
          <p className="pop-title">
            <ArborLogo size={14} /> {meta.label}
          </p>
          <p className="pop-desc">{meta.desc}</p>
          {c.reasons.length > 0 && !c.overridden && (
            <>
              <p className="pop-sub">Why Arbor thinks so</p>
              <ul className="pop-reasons">
                {c.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <p className="pop-conf">Confidence {pct(c.confidence)}%</p>
            </>
          )}
          <p className="pop-sub">Not right? Relabel it</p>
          <div className="segmented" role="radiogroup" aria-label="Who did the thinking">
            {MODES.map((mode) => (
              <button
                key={mode}
                role="radio"
                aria-checked={c.mode === mode}
                className={c.mode === mode ? 'on' : ''}
                onClick={() => {
                  dispatch({ type: 'reclassify', id: m.id, mode });
                  setOpen(false);
                }}
              >
                <Glyph mode={mode} size={11} /> {MODE_META[mode].short}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AssistantMessage({ m, showReflect }: { m: ChatMessage; showReflect: boolean }) {
  const { state, dispatch, send } = useStore();
  const enabled = state.settings.enabled;
  const concept = m.reflectOn ? CONCEPT_BY_ID[m.reflectOn] : undefined;
  const related = enabled && m.conceptIds.some((id) => state.highlight.includes(id));
  return (
    <div className={`msg assistant ${related ? 'related' : ''}`}>
      <div className="ai-avatar" aria-hidden="true">
        <Sparkles size={14} />
      </div>
      <div className="ai-body">
        <div className="ai-text">
          <Markdown text={m.text} />
          {m.streaming && <span className="caret" aria-hidden="true" />}
        </div>
        {enabled && concept && showReflect && !m.streaming && !state.busy && (
          <div className="reflect" aria-label="Arbor suggestion">
            <span className="reflect-label">
              <ArborLogo size={14} /> Make “{concept.label}” yours
            </span>
            <button
              className="chip"
              onClick={() => dispatch({ type: 'draft', text: `In my own words, ${concept.label.toLowerCase()} is ` })}
            >
              <PenLine size={13} /> Explain it back
            </button>
            <button className="chip" onClick={() => send(`Quiz me on ${concept.label.toLowerCase()}`)}>
              <Lightbulb size={13} /> Quiz me
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── Composer ───────────────────────── */

function Composer() {
  const { state, dispatch, send, classifyDraft, toast } = useStore();
  const { enabled: arborOn, nudge: nudgeLevel } = state.settings;
  const enabled = arborOn && nudgeLevel !== 'off';
  const [text, setText] = useState('');
  const [lens, setLens] = useState<Classification | null>(null);
  const [nudge, setNudge] = useState<{ text: string; c: Classification } | null>(null);
  const ta = useRef<HTMLTextAreaElement>(null);

  const focusEnd = () =>
    requestAnimationFrame(() => {
      const el = ta.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });

  // Live "lens": classify while typing (debounced) — feedforward before sending.
  useEffect(() => {
    const t = setTimeout(() => setLens(text.trim() ? classifyDraft(text) : null), 200);
    return () => clearTimeout(t);
  }, [text, classifyDraft, state.pendingQuiz]);

  // Text pushed in from elsewhere ("Explain it back", forest "Quiz me", …)
  useEffect(() => {
    if (!state.draft.nonce) return;
    setText(state.draft.text);
    setNudge(null);
    focusEnd();
  }, [state.draft]);

  // Auto-grow
  useLayoutEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  const doSend = (t: string, c: Classification) => {
    send(t, c);
    setText('');
    setNudge(null);
  };

  const submit = () => {
    if (state.busy || !text.trim()) return;
    const c = classifyDraft(text);
    if (nudge && nudge.text === text) return doSend(text, c); // second ↵ = send anyway
    if (enabled && nudgeLevel === 'active' && c.mode === 'ai') {
      setNudge({ text, c });
      return;
    }
    doSend(text, c);
  };

  // Share what the composer shows (lens, nudge) so the panel's squirrel can react while you type.
  const liveLens = enabled && lens ? lens.mode : null;
  const nudgeOpen = enabled && nudge !== null;
  useEffect(() => {
    dispatch({ type: 'composer', lens: liveLens, nudge: nudgeOpen });
  }, [liveLens, nudgeOpen, dispatch]);

  const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

  return (
    <div className="composer-wrap">
      {enabled && nudge && (
        <div className="nudge" role="dialog" aria-labelledby="nudge-title">
          <div className="nudge-head">
            <Glyph mode="ai" size={14} />
            <strong id="nudge-title">This hands the thinking to the AI</strong>
            <button className="icon-btn" aria-label="Dismiss" onClick={() => setNudge(null)}>
              <X size={15} />
            </button>
          </div>
          <p>A quick guess of your own first — even a rough one — helps the answer stick.</p>
          <div className="nudge-actions">
            <button
              className="btn btn-you"
              onClick={() => {
                setText(`${text.trimEnd()}\n\nMy first guess: `);
                setNudge(null);
                focusEnd();
              }}
            >
              <PenLine size={14} /> Add my take
            </button>
            <button
              className="btn"
              onClick={() => {
                setText(`Give me a hint, not the full answer: ${lower(text.trim())}`);
                setNudge(null);
                focusEnd();
              }}
            >
              <Lightbulb size={14} /> Ask for a hint instead
            </button>
            <button className="btn btn-ghost" onClick={() => doSend(nudge.text, nudge.c)}>
              Send anyway <kbd>↵</kbd>
            </button>
          </div>
          <p className="nudge-foot">
            <ArborLogo size={12} /> Arbor nudge ·{' '}
            <button
              className="link"
              onClick={() => {
                dispatch({ type: 'settings', patch: { nudge: 'gentle' } });
                doSend(nudge.text, nudge.c);
                toast('Nudges set to Gentle — you’ll only see labels. Change it in Arbor settings.');
              }}
            >
              Don’t interrupt me
            </button>
          </p>
        </div>
      )}

      {!nudge && (
        <div className="demo-prompts" aria-label="Demo prompts">
          <span className="demo-label">
            <FlaskConical size={12} /> Demo
          </span>
          {DEMO_PROMPTS.map((p) => (
            <button
              key={p}
              className="demo-chip"
              onClick={() => {
                setText(p);
                focusEnd();
              }}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      <form
        className={`composer ${enabled && lens ? `lens-${lens.mode}` : ''}`}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <textarea
          ref={ta}
          value={text}
          rows={1}
          placeholder={state.pendingQuiz ? 'Type your answer…' : 'Message the assistant…'}
          aria-label="Message"
          onChange={(e) => {
            setText(e.target.value);
            if (nudge && e.target.value !== nudge.text) setNudge(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            } else if (e.key === 'Escape' && nudge) {
              setNudge(null);
            }
          }}
        />
        <div className="composer-bar">
          {enabled ? (
            <span className={`lens ${lens ? `mode-${lens.mode}` : 'idle'}`} aria-live="polite">
              {lens ? (
                <>
                  <Glyph mode={lens.mode} size={12} />
                  {MODE_META[lens.mode].lens}
                </>
              ) : (
                <>
                  <ArborLogo size={13} /> Arbor reflects who’s thinking as you type
                </>
              )}
            </span>
          ) : (
            <span />
          )}
          <button type="submit" className="send" disabled={state.busy || !text.trim()} aria-label="Send message">
            <ArrowUp size={17} />
          </button>
        </div>
      </form>
      <p className="fineprint">Prototype — the assistant’s answers are scripted.</p>
    </div>
  );
}
