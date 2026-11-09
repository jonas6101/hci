import { useEffect, useState, type ReactNode } from 'react';
import { MODE_SCORE, mean, pct } from '../../lib/modes';
import { formatDays } from '../../lib/retention';
import { useStore } from '../../lib/store';
import { K, useUi } from './ui';

/**
 * The modeline: like vim's "-- INSERT --", it always says who is thinking right now, in the
 * periphery, and lists the keys that work in this moment (recognition over recall).
 */
export function Modeline() {
  const { state } = useStore();
  const { days, view, sheet } = useUi();
  const { settings, composer, busy, messages, forest } = state;
  const [focus, setFocus] = useState<'prompt' | 'guess' | 'tree' | 'other'>('other');

  useEffect(() => {
    const read = () => {
      const el = document.activeElement as HTMLElement | null;
      setFocus(
        el?.id === 'a-prompt' ? 'prompt' : el?.classList.contains('a-guess-input') ? 'guess' : el?.closest('.at-grid') ? 'tree' : 'other',
      );
    };
    const later = () => setTimeout(read, 0);
    document.addEventListener('focusin', read);
    document.addEventListener('focusout', later);
    read();
    return () => {
      document.removeEventListener('focusin', read);
      document.removeEventListener('focusout', later);
    };
  }, []);

  const veiled = messages.some((m) => m.veiled);
  const turns = messages.filter((m) => m.role === 'user' && m.classification);
  const you = turns.length ? pct(mean(turns.map((t) => MODE_SCORE[t.classification!.mode]))) : null;

  let badge: { cls: string; text: string };
  if (!settings.enabled) badge = { cls: 'idle', text: 'paused' };
  else if (forest.open) badge = { cls: 'idle', text: 'forest' };
  else if (veiled) badge = { cls: 'veil', text: '▒ veiled' };
  else if (busy) badge = { cls: 'idle', text: 'ai writing' };
  else if (composer.lens === 'own') badge = { cls: 'own', text: '● your thinking' };
  else if (composer.lens === 'together') badge = { cls: 'together', text: '◑ together' };
  else if (composer.lens === 'ai') badge = { cls: 'ai', text: '○ delegating' };
  else badge = { cls: 'idle', text: 'arbor' };

  let keys: ReactNode;
  if (sheet) keys = <><K>esc</K> close</>;
  else if (forest.open) keys = <><K>esc</K> back · <K>[ ]</K> time</>;
  else if (focus === 'guess') keys = <><K>↵</K> reveal · type a guess first, or don’t</>;
  else if (focus === 'prompt')
    keys = (
      <>
        <K>↵</K> send · <K>⇧↵</K> newline · <K>/</K> commands · <K>tab</K> demo prompts · <K>esc</K> leave
      </>
    );
  else if (focus === 'tree')
    keys = (
      <>
        <K>↑↓</K> move · <K>↵</K> jump to message · <K>q</K> quiz me
      </>
    );
  else
    keys = (
      <>
        <K>i</K> type · <K>/</K> commands
      </>
    );

  return (
    <footer className="a-modeline" aria-label="Status">
      <span className={`a-badge b-${badge.cls}`} aria-live="polite">
        {` ${badge.text} `}
      </span>
      <span className="a-ml-keys">{keys}</span>
      <span className="a-ml-right">
        {days > 0 && <span className="a-ml-time">time {formatDays(days)}</span>}
        {settings.enabled && you !== null && <span>you {you}%</span>}
        <span className="a-ml-global">
          <K>t</K> {view === 'tree' ? 'outline' : 'tree'} <K>f</K> forest <K>[ ]</K> time <K>?</K> concepts
        </span>
      </span>
    </footer>
  );
}
