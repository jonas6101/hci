import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../../lib/hooks';
import type { Mode } from '../../lib/types';
import { G } from './ui';

/**
 * The squirrel, in characters. It mirrors who is thinking with the acorn in its paws, which is
 * the ●◑○ glyph itself, so it adds no new visual language. On its own it moves only when its
 * pose changes (never on a loop), so it stays calm in the periphery.
 *
 *    .--.
 *   (    \ ,/\
 *    `.   (  •>        idle · own · together · ai — holds the matching acorn
 *      `--(_)●         nudge — lifts the acorn up to its nose: "what's your hunch?"
 *                      cheer — one hop, eyes ^ · sleep — eye closed, z
 *
 * When it is interactive (onPoke), it answers to you:
 *   hover — it notices you, once: ear twitch, blink, a ripple down the tail
 *   click — it tosses the acorn and watches it fly (eyes °), then says something useful
 *   click it a lot — it gets dizzy (eyes @)
 */
export type Pose = 'idle' | Mode | 'nudge' | 'cheer' | 'sleep';

const ACORN: Record<Pose, Mode | null> = {
  idle: null,
  sleep: null,
  own: 'own',
  cheer: 'own',
  together: 'together',
  ai: 'ai',
  nudge: 'ai',
};

/** One frame of the hover sequence: which parts differ from the resting drawing. */
interface Frame {
  tail?: string;
  back?: string;
  ear?: string;
  hip?: string;
  eye?: string;
}
const REST = { tail: ' .--.', back: '(    \\', ear: ',/\\', hip: ' `.' };
/** It notices you: ear twitch, blink, then a ripple runs down the tail. ~0.6 s, once. */
const NOTICE: Frame[] = [{ ear: ',/|' }, { eye: '-' }, {}, { tail: ' .-~.' }, { tail: ' .~-.', back: '(    )' }, { hip: ' `~' }, {}];
const NOTICE_MS = 85;
const DIZZY_CLICKS = 4;
const DIZZY_WINDOW = 1600;

export function Squirrel({ pose, onPoke }: { pose: Pose; onPoke?: (dizzy: boolean) => void }) {
  const [frame, setFrame] = useState<Frame>({});
  const [look, setLook] = useState<'up' | 'dizzy' | null>(null);
  const [toss, setToss] = useState(0);
  const clicks = useRef<number[]>([]);
  const timers = useRef<number[]>([]);
  const playing = useRef(false);
  const recovering = useRef(false);
  const settle = useRef(0);
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      clearTimeout(settle.current);
    },
    [],
  );

  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

  const notice = () => {
    if (!onPoke || pose === 'sleep' || playing.current || prefersReducedMotion()) return;
    playing.current = true;
    NOTICE.forEach((f, i) => later(() => setFrame(f), i * NOTICE_MS));
    later(() => (playing.current = false), NOTICE.length * NOTICE_MS);
  };

  const poke = () => {
    if (!onPoke || recovering.current) return; // give it a second when it's dizzy
    const now = performance.now();
    clicks.current = [...clicks.current.filter((t) => now - t < DIZZY_WINDOW), now];
    const dizzy = clicks.current.length >= DIZZY_CLICKS;
    if (dizzy) clicks.current = [];
    setToss((n) => n + 1);
    setLook(dizzy ? 'dizzy' : 'up');
    recovering.current = dizzy;
    // One reset at a time: a later poke replaces the pending one instead of being cut short by it.
    clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      setLook(null);
      recovering.current = false;
    }, dizzy ? 1500 : 750);
    onPoke(dizzy);
  };

  const acorn = ACORN[pose];
  const raised = pose === 'nudge';
  const eye =
    pose === 'sleep' ? '-' : look === 'dizzy' ? '@' : look === 'up' ? '°' : frame.eye ?? (pose === 'cheer' ? '^' : '•');
  const art = (
    <span className={`a-sq pose-${pose}${look ? ` toss is-${look}` : ''}`} key={toss} aria-hidden="true">
      <span className="a-sq-z">{pose === 'sleep' ? 'z' : ' '}</span>
      <span className="a-sq-l">{frame.tail ?? REST.tail}</span>
      <span className="a-sq-l">{`${frame.back ?? REST.back} ${frame.ear ?? REST.ear}`}</span>
      <span className="a-sq-l">
        {`${frame.hip ?? REST.hip}   (  `}
        <span className="a-sq-eye">{eye}</span>
        {'>'}
        <span className="a-sq-nut is-up">{raised && acorn ? <G mode={acorn} /> : ' '}</span>
      </span>
      <span className="a-sq-l">
        {'   `--(_)'}
        <span className="a-sq-nut">{!raised && acorn ? <G mode={acorn} /> : ' '}</span>
      </span>
    </span>
  );

  if (!onPoke) return art;
  return (
    <button
      className="a-sq-btn"
      onMouseEnter={notice}
      onFocus={notice}
      onClick={poke}
      aria-label="Ask the squirrel"
      title="poke me"
    >
      {art}
    </button>
  );
}
