import { ChevronLeft, ChevronRight, Lock, Puzzle, RotateCw, SquarePen, UserRound } from 'lucide-react';
import { HOST_HISTORY, PAST_TREES } from '../../../data/forest';
import { LIVE_TREE } from '../../../data/scenario';
import { layoutTree } from '../../../lib/layout';
import { pct } from '../../../lib/modes';
import { useStore } from '../../../lib/store';
import { ArborLogo, Glyph } from './Glyph';

/** A minimal stand-in for the browser, so the overlay clearly reads as an extension. */
export function BrowserChrome() {
  const { state, dispatch, toast } = useStore();
  const { panelOpen, settings } = state;
  return (
    <div className="chrome">
      <div className="lights" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div className="chrome-nav" aria-hidden="true">
        <ChevronLeft size={16} />
        <ChevronRight size={16} />
        <RotateCw size={14} />
      </div>
      <div className="url">
        <Lock size={11} aria-hidden="true" />
        <span>chat.example.com/c/neural-networks</span>
      </div>
      <div className="chrome-ext">
        <button
          className={`ext-btn ${panelOpen ? 'on' : ''}`}
          onClick={() => dispatch({ type: 'panel', open: !panelOpen })}
          aria-pressed={panelOpen}
          aria-label={panelOpen ? 'Hide Arbor panel' : 'Show Arbor panel'}
          title="Arbor"
        >
          <ArborLogo size={18} />
          {!settings.enabled && <span className="ext-paused" aria-hidden="true" />}
        </button>
        <button className="ext-btn" aria-label="Extensions" onClick={() => toast('Prototype: browser extensions menu')}>
          <Puzzle size={16} />
        </button>
      </div>
    </div>
  );
}

const pastScore = Object.fromEntries(PAST_TREES.map((t) => [t.id, layoutTree(t).score]));
const titles: Record<string, string> = {
  ...Object.fromEntries(PAST_TREES.map((t) => [t.id, t.title])),
  [LIVE_TREE.id]: LIVE_TREE.chatTitle,
};

/** The host chat app's own sidebar. Arbor adds one small glyph per chat. */
export function HostSidebar() {
  const { state, dispatch, toast, liveTree } = useStore();
  const enabled = state.settings.enabled;
  const liveScore = layoutTree(liveTree).score;

  const open = (id: string) => {
    if (id === LIVE_TREE.id) return;
    if (!enabled) return toast('Prototype: only the current chat is live.');
    dispatch({ type: 'forest', open: true, focus: id });
    toast('Prototype: past chats open in your Arbor forest.');
  };

  return (
    <aside className="host-sidebar" aria-label="Chat history">
      <div className="host-brand">
        <span className="host-logo" aria-hidden="true" />
        Chat
      </div>
      <button className="host-new" onClick={() => toast('Prototype: only the current chat is live.')}>
        <SquarePen size={15} /> New chat
      </button>
      <nav className="host-history">
        {HOST_HISTORY.map((g) => (
          <div key={g.label}>
            <p className="host-group">{g.label}</p>
            {g.items.map((id) => {
              const score = id === LIVE_TREE.id ? liveScore : pastScore[id];
              return (
                <button
                  key={id}
                  className={`host-item ${id === LIVE_TREE.id ? 'active' : ''}`}
                  onClick={() => open(id)}
                  aria-current={id === LIVE_TREE.id ? 'page' : undefined}
                >
                  <span className="host-item-title">{titles[id]}</span>
                  {enabled && (
                    <span className="host-glyph" title={`Arbor: ${pct(score)}% your thinking`}>
                      <Glyph score={score} size={11} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="host-user">
        <span className="host-avatar" aria-hidden="true">
          <UserRound size={15} />
        </span>
        Student account
      </div>
    </aside>
  );
}
