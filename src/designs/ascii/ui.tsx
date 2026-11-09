import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { MODE_SCORE } from '../../lib/modes';
import { useStore } from '../../lib/store';
import type { Mode } from '../../lib/types';

/* ───────────── UI state that only this design needs ─────────────
 * The conversation, settings, highlight and forest focus live in the shared store;
 * the rest (time scrubber, tree view, open sheets, link source) is local to the ASCII design.
 */

export type TreeView = 'tree' | 'outline';
export type Sheet = 'concepts' | null;
/** What the pointer is on, so the link overlay knows where to draw from. */
export type LinkSource = { kind: 'message'; id: string } | { kind: 'leaf'; id: string; messageId?: string } | null;

interface Ui {
  /** Forgetting scrubber: days from now (0 = now). */
  days: number;
  setDays: (d: number) => void;
  view: TreeView;
  setView: (v: TreeView) => void;
  sheet: Sheet;
  setSheet: (s: Sheet) => void;
  /** User message whose "why this label" is open. */
  why: string | null;
  setWhy: (id: string | null) => void;
  link: LinkSource;
  setLink: (l: LinkSource) => void;
  /** Put text in the composer and focus it. */
  fill: (text: string) => void;
  focusPrompt: () => void;
}

const UiContext = createContext<Ui | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const { dispatch } = useStore();
  const [days, setDays] = useState(0);
  const [view, setView] = useState<TreeView>(() => (param('layout') === 'outline' ? 'outline' : 'tree'));
  const [sheet, setSheet] = useState<Sheet>(null);
  const [why, setWhy] = useState<string | null>(null);
  const [link, setLink] = useState<LinkSource>(null);

  const focusPrompt = useCallback(() => {
    requestAnimationFrame(() => {
      const el = document.getElementById('a-prompt') as HTMLTextAreaElement | null;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  }, []);
  const fill = useCallback((text: string) => dispatch({ type: 'draft', text }), [dispatch]);

  const value = useMemo(
    () => ({ days, setDays, view, setView, sheet, setSheet, why, setWhy, link, setLink, fill, focusPrompt }),
    [days, view, sheet, why, link, fill, focusPrompt],
  );
  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi() {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('useUi outside UiProvider');
  return ctx;
}

function param(name: string) {
  try {
    return new URLSearchParams(window.location.search).get(name);
  } catch {
    return null;
  }
}

/* ───────────── Primitives ───────────── */

/**
 * The one glyph: filled = you, half = together, hollow = AI. Drawn as a pie in a 1ch cell,
 * so it sits on the character grid like any letter and works in every font.
 */
export function G({ score, mode, className = '' }: { score?: number; mode?: Mode; className?: string }) {
  const s = score ?? (mode ? MODE_SCORE[mode] : 0);
  const c = 2 * Math.PI * 2.5;
  return (
    <span className={`a-g ${className}`} aria-hidden="true">
      <svg viewBox="0 0 12 12">
        <circle className={`a-g-ring ${s > 0 ? 'is-you' : 'is-ai'}`} cx="6" cy="6" r="5" />
        <circle
          className="a-g-fill"
          cx="6"
          cy="6"
          r="2.5"
          strokeWidth="5"
          strokeDasharray={`${Math.min(1, s) * c} ${c}`}
          transform="rotate(-90 6 6)"
        />
      </svg>
    </span>
  );
}

/** A key cap, written the terminal way. */
export function K({ children }: { children: ReactNode }) {
  return <kbd className="a-k">{children}</kbd>;
}

/** `(•) label` radio group. */
export function Radios<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { v: T; label: ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <span className="a-radios" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.v} role="radio" aria-checked={value === o.v} className="a-radio" onClick={() => onChange(o.v)}>
          <span className="a-radio-box" aria-hidden="true">
            {value === o.v ? '(•)' : '( )'}
          </span>
          {o.label}
        </button>
      ))}
    </span>
  );
}

/** `[x] label` checkbox. */
export function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <button role="checkbox" aria-checked={checked} className="a-check" onClick={() => onChange(!checked)}>
      <span aria-hidden="true">{checked ? '[x]' : '[ ]'}</span> {children}
    </button>
  );
}

export const lower = (s: string) => s.toLowerCase();

/** Reasons, lower-cased and without the quoted words the evidence already points at. */
export const shortReason = (r: string) => lower(r.replace(/\s*\(“[^”]*”\)/, ''));

/** Is the keyboard event aimed at a text field? */
export const typing = (e: KeyboardEvent | React.KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  return Boolean(t?.closest?.('input, textarea, [contenteditable="true"]'));
};
