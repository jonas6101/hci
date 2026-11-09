import { useEffect, useRef } from 'react';
import { useStore } from '../../lib/store';
import { G, K, useUi } from './ui';

/* The design's interaction concepts, each with the principle behind it and a way to try it. */

interface Concept {
  name: string;
  principle: string;
  body: string;
  try: string;
  run: () => void;
}

function useConcepts(): Concept[] {
  const { state, dispatch } = useStore();
  const ui = useUi();
  const delegate = 'Write me a summary of backpropagation for my exam';
  const lastUser = [...state.messages].reverse().find((m) => m.role === 'user');
  return [
    {
      name: 'thought linter',
      principle: 'explainable feedforward',
      body: 'arbor reads your prompt as you type, the way a spellchecker reads spelling. the words that hand the thinking away get a wavy underline (dashed: together, solid: yours), and the reason sits right below. you see why before you send.',
      try: 'type a delegating prompt',
      run: () => ui.fill(delegate),
    },
    {
      name: 'modeline',
      principle: 'ambient awareness · calm technology',
      body: 'like vim’s -- insert --, the bar at the bottom always says who is thinking right now, and which keys work in this moment. it sits in the periphery and never asks for attention. even the caret takes the colour of the mode.',
      try: 'start typing, watch the bottom left',
      run: () => ui.fill('I think '),
    },
    {
      name: 'predict → reveal',
      principle: 'desirable difficulty · generation effect',
      body: 'with nudges on active, a delegated answer arrives veiled: its shape is visible, its words are not. type a hunch and reveal it, and the words you already had light up. or just reveal it. it is never blocked, one key either way.',
      try: 'send a delegating prompt',
      run: () => {
        dispatch({ type: 'settings', patch: { nudge: 'active' } });
        ui.fill(delegate);
      },
    },
    {
      name: 'two views, one tree',
      principle: 'multiple views · object constancy',
      body: 'the same knowledge as a growing plant or as a `tree` outline that is faster to scan and read aloud. switch, and every leaf glides to its place in the other view, so you never lose it.',
      try: 'switch the view',
      run: () => ui.setView(ui.view === 'tree' ? 'outline' : 'tree'),
    },
    {
      name: 'forgetting scrubber',
      principle: 'feedforward of consequences',
      body: 'drag time forward to see what would fade if you stopped reviewing. letters drop out of labels and forgotten leaves fall to the ground. what you delegated falls first, what you reasoned through stays. an illustrative model, not a measurement.',
      try: 'jump two weeks ahead',
      run: () => ui.setDays(14),
    },
    {
      name: 'semantic zoom',
      principle: 'overview first, zoom and filter, details on demand',
      body: 'pinch out and the tree becomes one of many. every chat shrinks to a crown of glyphs, fallen leaves show what is fading. hover a tree and labelled roots run to the chats it shares ideas with. zoom into one for the full tree and what to revisit.',
      try: 'open the forest',
      run: () => dispatch({ type: 'forest', open: true }),
    },
    {
      name: 'drawn links',
      principle: 'brushing & linking',
      body: 'hover a message and a line is drawn from it to the leaves it grew. hover a leaf and the line finds its message, pointing up or down if it is scrolled away.',
      try: 'hover any message',
      run: () => ui.focusPrompt(),
    },
    {
      name: 'relabel in place',
      principle: 'user control · error recovery',
      body: 'click the glyph next to one of your messages: the evidence is underlined in your own words, with the confidence. not right? relabel it and the tree regrows.',
      try: 'open the last label',
      run: () => {
        if (!lastUser) return;
        ui.setWhy(lastUser.id);
        dispatch({ type: 'flash', id: lastUser.id });
      },
    },
    {
      name: 'command line',
      principle: 'flexibility & efficiency · recognition over recall',
      body: 'everything is reachable from the keyboard. type / and every command is listed with what it does. tab cycles demo prompts. nothing has to be remembered.',
      try: 'type /',
      run: () => ui.fill('/'),
    },
    {
      name: 'squirrel',
      principle: 'ambient presence, non-judgmental tone',
      body: 'a small companion holds an acorn in the glyph language and says what the last prompt meant. on its own it moves only when something changes, never on a loop, and it never looks sad when you delegate. hover it and it notices you; poke it and it tosses its acorn and tells you something useful: which leaf is least yours, what would fade, where the forest is.',
      try: 'see it cheer: share your own take',
      run: () => ui.fill('I think the learning rate is the size of each step downhill, so if it is too big we overshoot'),
    },
  ];
}

export function Concepts() {
  const { state, dispatch, finishOnboarding } = useStore();
  const { sheet, setSheet } = useUi();
  const concepts = useConcepts();
  const first = useRef<HTMLButtonElement>(null);
  const open = sheet === 'concepts' || state.onboarding;
  const close = () => {
    if (state.onboarding) finishOnboarding();
    setSheet(null);
  };
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => first.current?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || (state.onboarding && e.key === 'Enter' && document.activeElement === first.current)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        closeRef.current();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, state.onboarding]);

  if (!open) return null;

  if (state.onboarding)
    return (
      <div className="a-sheet-back" onMouseDown={(e) => e.target === e.currentTarget && close()}>
        <div className="a-intro" role="dialog" aria-modal="true" aria-labelledby="a-intro-title">
          <p className="a-dim">arbor · a browser extension for llm chats</p>
          <h2 id="a-intro-title">who’s doing the thinking?</h2>
          <ul className="a-intro-modes">
            <li>
              <G mode="own" /> <b>your thinking</b> <span className="a-dim">you reasoned it through</span>
            </li>
            <li>
              <G mode="together" /> <b>together</b> <span className="a-dim">you explored it with the ai</span>
            </li>
            <li>
              <G mode="ai" /> <b>delegated</b> <span className="a-dim">the ai did the thinking. fine, just visible</span>
            </li>
          </ul>
          <p>
            arbor reads each prompt as you type and grows every concept into a leaf on this chat’s tree. filled leaves are
            yours. zoom out and all your chats form a forest.
          </p>
          <p className="a-intro-acts">
            <button ref={first} className="a-btn" onClick={close}>
              start
            </button>
            <K>↵</K>
            <button
              className="a-btn"
              onClick={() => {
                finishOnboarding();
                setSheet('concepts');
              }}
            >
              how it works: 10 concepts
            </button>
            <K>?</K>
          </p>
        </div>
      </div>
    );

  return (
    <div className="a-sheet-back" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="a-sheet" role="dialog" aria-modal="true" aria-labelledby="a-sheet-title">
        <header className="a-sheet-head">
          <h2 id="a-sheet-title">interaction concepts</h2>
          <span className="a-dim">arbor · ascii design</span>
          <button ref={first} className="a-icon" onClick={close} aria-label="Close" title="close  esc">
            ×
          </button>
        </header>
        <ol className="a-concepts">
          {concepts.map((c, i) => (
            <li key={c.name} style={{ animationDelay: `${i * 35}ms` }}>
              <span className="a-c-n">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <p className="a-c-head">
                  <b>{c.name}</b> <span className="a-dim">{c.principle}</span>
                </p>
                <p className="a-c-body">{c.body}</p>
                <button
                  className="a-c-try"
                  onClick={() => {
                    close();
                    dispatch({ type: 'panel', open: true });
                    c.run();
                  }}
                >
                  try → {c.try}
                </button>
              </div>
            </li>
          ))}
        </ol>
        <p className="a-sheet-foot a-dim">
          one store, many designs: the conversation, classifier and scripted assistant are shared. type <K>/design classic</K>{' '}
          to compare.
        </p>
      </div>
    </div>
  );
}
