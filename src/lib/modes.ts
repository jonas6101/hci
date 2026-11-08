import type { Mode } from './types';

export const MODE_SCORE: Record<Mode, number> = { own: 1, together: 0.5, ai: 0 };

/** One vocabulary, used everywhere (tags, legend, tree, forest) for consistency. */
export const MODE_META: Record<Mode, { label: string; short: string; lens: string; desc: string }> = {
  own: {
    label: 'Your thinking',
    short: 'You',
    lens: 'You’re thinking',
    desc: 'You brought your own reasoning — the AI reacted to it.',
  },
  together: {
    label: 'Thinking together',
    short: 'Together',
    lens: 'Thinking together',
    desc: 'You explored the idea with the AI instead of just taking an answer.',
  },
  ai: {
    label: 'Delegated to AI',
    short: 'AI',
    lens: 'Delegating to AI',
    desc: 'You handed the thinking to the AI. Totally fine — just good to know.',
  },
};

export const MODES: Mode[] = ['own', 'together', 'ai'];

export function scoreToMode(score: number): Mode {
  if (score >= 0.75) return 'own';
  if (score >= 0.25) return 'together';
  return 'ai';
}

export function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function pct(score: number): number {
  return Math.round(score * 100);
}
