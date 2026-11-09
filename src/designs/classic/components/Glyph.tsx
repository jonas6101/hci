import { MODE_SCORE } from '../../../lib/modes';
import type { Mode } from '../../../lib/types';

/**
 * The one visual token for "who did the thinking":
 *   filled = you · half = together · hollow = AI.
 * Shape carries the meaning, colour reinforces it (works for colour-blind users too).
 */
export function Glyph({ score, mode, size = 12 }: { score?: number; mode?: Mode; size?: number }) {
  const s = score ?? (mode ? MODE_SCORE[mode] : 0);
  const c = size / 2;
  const r = size / 2 - 1;
  const a = Math.min(s, 0.9999) * Math.PI * 2;
  const x = c + r * Math.sin(a);
  const y = c - r * Math.cos(a);
  return (
    <svg className="glyph" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={c} cy={c} r={r} fill="var(--surface)" stroke={s > 0 ? 'var(--you)' : 'var(--ai)'} strokeWidth={1.4} />
      {s >= 1 ? (
        <circle cx={c} cy={c} r={r} fill="var(--you)" />
      ) : s > 0 ? (
        <path d={`M${c},${c} L${c},${c - r} A${r},${r} 0 ${a > Math.PI ? 1 : 0} 1 ${x},${y} Z`} fill="var(--you)" />
      ) : null}
    </svg>
  );
}

export function ArborLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="arbor-logo">
      <path d="M12 22V9" stroke="var(--bark-strong)" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 15 L7 11.5 M12 12 L17 8.5" stroke="var(--bark-strong)" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="5.2" r="3" fill="var(--you)" />
      <circle cx="6" cy="10.5" r="2.5" fill="var(--surface)" stroke="var(--you)" strokeWidth="1.4" />
      <path d="M6 8 A2.5 2.5 0 0 1 6 13 Z" fill="var(--you)" />
      <circle cx="18" cy="7.5" r="2.5" fill="var(--surface)" stroke="var(--ai)" strokeWidth="1.4" />
    </svg>
  );
}
