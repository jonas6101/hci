import { useEffect, useState } from 'react';
import { MODE_SCORE, mean } from '../../lib/modes';
import { TIME_MAX, TIME_TICKS } from '../../lib/retention';
import { useStore } from '../../lib/store';
import { Composer } from './Composer';
import { Concepts } from './Concepts';
import { Forest } from './Forest';
import { Links } from './Links';
import { Modeline } from './Modeline';
import { Pane } from './Pane';
import { Transcript } from './Transcript';
import { G, UiProvider, typing, useUi } from './ui';
import './ascii.css';

/**
 * The ASCII design: everything on one character grid, in one monospace voice.
 * Interaction concepts are listed in Concepts.tsx (press ? in the app).
 */
export default function AsciiApp() {
  return (
    <UiProvider>
      <Shell />
    </UiProvider>
  );
}

function Shell() {
  const { state, dispatch } = useStore();
  const ui = useUi();
  const { theme } = state.settings;

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
  }, [theme]);

  // Global keys (when no text field has focus). Overlays handle their own keys first.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      const stops = TIME_TICKS.map((t) => t.days);
      const key = e.key;
      if (key === '/') ui.fill('/');
      else if (key === 'i') ui.focusPrompt();
      else if (key === '?') ui.setSheet(ui.sheet ? null : 'concepts');
      else if (key === 't' && !state.forest.open) ui.setView(ui.view === 'tree' ? 'outline' : 'tree');
      else if (key === 'f') dispatch({ type: 'forest', open: !state.forest.open });
      else if (key === ']') ui.setDays(stops.find((d) => d > ui.days) ?? TIME_MAX);
      else if (key === '[') ui.setDays([...stops].reverse().find((d) => d < ui.days) ?? 0);
      else if (key === 'Escape') {
        ui.setWhy(null);
        dispatch({ type: 'highlight', ids: [] });
        return;
      } else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ui, state.forest.open, dispatch]);

  return (
    <div className="ascii">
      <TopLine />
      <div className="a-main">
        <main className="a-chat" aria-label="Conversation">
          <Transcript />
          <Composer />
        </main>
        {state.panelOpen && <Pane />}
        {state.forest.open && <Forest />}
      </div>
      <Modeline />
      <Links />
      <Concepts />
      <Toast />
    </div>
  );
}

/** A browser reduced to one line, so the overlay still reads as an extension on someone else's chat. */
function TopLine() {
  const { state, dispatch, toast } = useStore();
  const turns = state.messages.filter((m) => m.role === 'user' && m.classification);
  const score = turns.length ? mean(turns.map((t) => MODE_SCORE[t.classification!.mode])) : 0.5;
  return (
    <header className="a-top">
      <span className="a-top-nav a-dim" aria-hidden="true">
        ‹ › ↻
      </span>
      <span className="a-url">
        <span className="a-dim">https://</span>chat.example.com<span className="a-dim">/c/neural-networks</span>
      </span>
      <span className="a-top-ext">
        <button
          className={`a-ext${state.panelOpen ? ' on' : ''}`}
          aria-pressed={state.panelOpen}
          title="arbor"
          onClick={() => dispatch({ type: 'panel', open: !state.panelOpen })}
        >
          {state.settings.enabled ? <G score={score} /> : <span aria-hidden="true">z</span>} arbor
        </button>
        <button className="a-ext a-dim" onClick={() => toast('prototype: browser extensions menu')} aria-label="Extensions">
          ⋯
        </button>
      </span>
    </header>
  );
}

function Toast() {
  const { state } = useStore();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!state.toast) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 3200);
    return () => clearTimeout(t);
  }, [state.toast]);
  return (
    <div className={`a-toast${visible ? ' show' : ''}`} role="status" aria-live="polite">
      <span className="a-dim">arbor › </span>
      {state.toast?.text}
    </div>
  );
}
