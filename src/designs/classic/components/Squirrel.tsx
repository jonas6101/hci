import { useEffect, useRef, useState } from 'react';
import type { Mode } from '../../../lib/types';

/**
 * Arbor's mascot: a flat squirrel in the tree's bark colours, holding an acorn.
 * The acorn is its only coloured part and is drawn exactly like the ●◑○ glyph
 * (filled = you, half = together, hollow = AI), so the squirrel adds no new visual language.
 *   idle     — nothing to react to yet: empty paws
 *   own · together · ai — holds the matching acorn
 *   nudge    — lifts the hollow acorn: "what's your hunch?"
 *   cheer    — one small hop (you just added your own thinking)
 *   sleep    — Arbor is paused: eye closed
 * On its own it only moves when its pose changes, never on a loop, so it stays calm in the periphery.
 * When interactive (onPoke) it answers to you: on hover it notices you (tail swish, blink), on
 * click it tosses its acorn and hops, and if you click it a lot it gets dizzy.
 * Styles live in the "Mascot" section of styles.css.
 */
export type SquirrelPose = 'idle' | 'own' | 'together' | 'ai' | 'nudge' | 'cheer' | 'sleep';

const ACORN: Record<SquirrelPose, Mode | null> = {
  idle: null,
  sleep: null,
  own: 'own',
  cheer: 'own',
  together: 'together',
  ai: 'ai',
  nudge: 'ai',
};

/** Acorn centre and radius (viewBox units). */
const CX = 12.6;
const CY = 31.4;
const R = 4.6;

const DIZZY_CLICKS = 4;
const DIZZY_WINDOW = 1600;

export function Squirrel({ pose, size = 44, onPoke }: { pose: SquirrelPose; size?: number; onPoke?: (dizzy: boolean) => void }) {
  const acorn = ACORN[pose];
  const [look, setLook] = useState<'toss' | 'dizzy' | null>(null);
  const [n, setN] = useState(0);
  const clicks = useRef<number[]>([]);
  const settle = useRef(0);
  const recovering = useRef(false);
  useEffect(() => () => clearTimeout(settle.current), []);

  const poke = () => {
    if (!onPoke || recovering.current) return; // give it a second when it's dizzy
    const now = performance.now();
    clicks.current = [...clicks.current.filter((t) => now - t < DIZZY_WINDOW), now];
    const dizzy = clicks.current.length >= DIZZY_CLICKS;
    if (dizzy) clicks.current = [];
    recovering.current = dizzy;
    setN((x) => x + 1);
    setLook(dizzy ? 'dizzy' : 'toss');
    clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      setLook(null);
      recovering.current = false;
    }, dizzy ? 1300 : 800);
    onPoke(dizzy);
  };

  const svg = (
    <svg
      key={n}
      className={`squirrel pose-${pose}${acorn ? ` acorn-${acorn}` : ''}${look ? ` is-${look}` : ''}`}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
    >
      <g className="sq-body">
        <path
          className="sq-tail"
          d="M27 44.5C38.5 45.5 46.5 38 45.6 28C45 21.5 41 18.6 41.8 12.4C42.5 6.8 38.6 2.6 33.8 3.2C29.6 3.8 28 8 29.6 10.6C30.8 12.4 33.6 12 34.8 14.2C36.2 17 34.8 21.4 34.4 25.4C33.8 31.4 35.6 36.4 31 41.4Z"
        />
        <path
          className="sq-fur"
          d="M18.4 9.8L20.4 3.8L23.9 12.2C25.5 15.1 25 19 23.7 21.6C29.6 25 31.6 31 30.8 37C30 42 25.6 44.6 20.6 44.6C14.6 44.6 11.4 41.2 11.4 36.8C11.4 31.8 13.4 27.2 15.4 24.5C11.4 24.1 8.8 21.5 9 18.1C9.4 13.7 13.4 10 18.4 9.8Z"
        />
        <circle className="sq-eye" cx="15" cy="16.2" r="1.4" />
        <path className="sq-eye-closed" d="M13.5 16Q15 17.5 16.5 16" />

        <g className="sq-hold">
          <g className="sq-acorn">
            <circle className="sq-gap" cx={CX} cy={CY} r={R + 1.5} />
            <circle className="sq-nut" cx={CX} cy={CY} r={R} />
            <circle className="sq-nut-full" cx={CX} cy={CY} r={R} />
            <path className="sq-nut-half" d={`M${CX} ${CY - R}A${R} ${R} 0 0 1 ${CX} ${CY + R}Z`} />
          </g>
          <path className="sq-arm" d="M8.6 27Q12.6 24.8 16.6 27" />
        </g>
      </g>

      <g className="sq-zzz">
        <text x="6.5" y="9" fontSize="6">z</text>
        <text x="1" y="4" fontSize="8">z</text>
      </g>
    </svg>
  );
  if (!onPoke) return svg;
  return (
    <button className="sq-btn" onClick={poke} aria-label="Ask the squirrel" title="Poke me">
      {svg}
    </button>
  );
}
