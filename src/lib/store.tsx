import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import { BRANCHES, CONCEPT_BY_ID, LIVE_TREE, SEED } from '../data/scenario';
import { classify } from './classify';
import { looksLikeQuizAnswer, respond, type TouchedConcept } from './engine';
import { MODE_SCORE } from './modes';
import type { ChatMessage, Classification, LiveConcept, Mode, Settings, TreeData } from './types';

export interface State {
  messages: ChatMessage[];
  concepts: Record<string, LiveConcept>;
  pendingQuiz: string | null;
  busy: boolean;
  settings: Settings;
  panelOpen: boolean;
  forest: { open: boolean; focus: string | null };
  /** Text pushed into the composer from elsewhere (nudges, "explain it back"…). */
  draft: { text: string; nonce: number };
  highlight: string[];
  /** What the composer is showing right now, so the mascot can react while you type. */
  composer: { lens: Mode | null; nudge: boolean };
  flash: { id: string; nonce: number } | null;
  onboarding: boolean;
  toast: { text: string; nonce: number } | null;
}

type Action =
  | { type: 'user'; msg: ChatMessage }
  | { type: 'assistantStart'; msg: ChatMessage; concepts: TouchedConcept[]; userId: string; pendingQuiz: string | null }
  | { type: 'stream'; id: string; text: string }
  | { type: 'assistantDone'; id: string }
  | { type: 'reclassify'; id: string; mode: Mode }
  | { type: 'reveal'; id: string; guess: string }
  | { type: 'settings'; patch: Partial<Settings> }
  | { type: 'panel'; open: boolean }
  | { type: 'forest'; open: boolean; focus?: string | null }
  | { type: 'draft'; text: string }
  | { type: 'highlight'; ids: string[] }
  | { type: 'composer'; lens: Mode | null; nudge: boolean }
  | { type: 'flash'; id: string }
  | { type: 'onboarding'; open: boolean }
  | { type: 'toast'; text: string }
  | { type: 'reset'; empty: boolean };

let uid = 0;
const newId = (p: string) => `${p}${++uid}-${Date.now().toString(36)}`;

function addTouches(concepts: Record<string, LiveConcept>, touched: TouchedConcept[], userId: string) {
  const next = { ...concepts };
  for (const t of touched) {
    const existing = next[t.id];
    if (existing) {
      if (!existing.messageIds.includes(userId)) next[t.id] = { ...existing, messageIds: [...existing.messageIds, userId] };
    } else {
      next[t.id] = { ...t, order: Object.keys(next).length, messageIds: [userId] };
    }
  }
  return next;
}

function seedState(): Pick<State, 'messages' | 'concepts'> {
  const messages: ChatMessage[] = [];
  let concepts: Record<string, LiveConcept> = {};
  for (const s of SEED) {
    const u: ChatMessage = { id: newId('u'), role: 'user', text: s.user, classification: classify(s.user), conceptIds: s.concepts };
    const first = CONCEPT_BY_ID[s.concepts[0]];
    const a: ChatMessage = {
      id: newId('a'),
      role: 'assistant',
      text: first[s.variant],
      conceptIds: s.concepts,
      reflectOn: s.variant === 'full' ? first.id : undefined,
    };
    messages.push(u, a);
    concepts = addTouches(
      concepts,
      s.concepts.map((id) => ({ id, label: CONCEPT_BY_ID[id].label, branchId: CONCEPT_BY_ID[id].branch })),
      u.id,
    );
  }
  return { messages, concepts };
}

const SETTINGS_KEY = 'arbor.settings.v1';
const ONBOARD_KEY = 'arbor.onboarded.v1';

function loadSettings(): Settings {
  const defaults: Settings = { enabled: true, nudge: 'active', showTags: true, theme: 'system', mascot: true, design: 'ascii' };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch {
    return defaults;
  }
}

function hasOnboarded() {
  try {
    return localStorage.getItem(ONBOARD_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * URL parameters for demos and user tests, e.g.
 * `?design=ascii&intro=0&view=forest&theme=dark&empty=1&nudge=gentle&arbor=off&mascot=0`.
 */
function urlParams() {
  try {
    return new URLSearchParams(window.location.search);
  } catch {
    return new URLSearchParams();
  }
}

function init(): State {
  const p = urlParams();
  const settings = loadSettings();
  const theme = p.get('theme');
  if (theme === 'light' || theme === 'dark' || theme === 'system') settings.theme = theme;
  const nudge = p.get('nudge');
  if (nudge === 'off' || nudge === 'gentle' || nudge === 'active') settings.nudge = nudge;
  if (p.get('arbor') === 'off') settings.enabled = false;
  if (p.get('arbor') === 'on') settings.enabled = true;
  if (p.get('mascot') === '0') settings.mascot = false;
  if (p.get('mascot') === '1') settings.mascot = true;
  const design = p.get('design');
  if (design === 'ascii' || design === 'classic') settings.design = design;
  return {
    ...(p.get('empty') === '1' ? { messages: [], concepts: {} } : seedState()),
    pendingQuiz: null,
    busy: false,
    settings,
    panelOpen: p.get('panel') !== '0',
    forest: { open: p.get('view') === 'forest', focus: p.get('tree') },
    draft: { text: '', nonce: 0 },
    highlight: [],
    composer: { lens: null, nudge: false },
    flash: null,
    onboarding: p.get('intro') === '1' || (p.get('intro') !== '0' && !hasOnboarded()),
    toast: null,
  };
}

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'user':
      return { ...s, messages: [...s.messages, a.msg], busy: true };
    case 'assistantStart':
      return {
        ...s,
        messages: [
          ...s.messages.map((m) => (m.id === a.userId ? { ...m, conceptIds: a.concepts.map((c) => c.id) } : m)),
          a.msg,
        ],
        concepts: addTouches(s.concepts, a.concepts, a.userId),
        pendingQuiz: a.pendingQuiz,
      };
    case 'stream':
      return { ...s, messages: s.messages.map((m) => (m.id === a.id ? { ...m, text: a.text } : m)) };
    case 'assistantDone':
      return { ...s, busy: false, messages: s.messages.map((m) => (m.id === a.id ? { ...m, streaming: false } : m)) };
    case 'reclassify':
      return {
        ...s,
        messages: s.messages.map((m) =>
          m.id === a.id && m.classification
            ? { ...m, classification: { ...m.classification, mode: a.mode, overridden: true } }
            : m,
        ),
      };
    case 'reveal': {
      // A guess before reading turns a delegated prompt into thinking together.
      const i = s.messages.findIndex((m) => m.id === a.id);
      const guess = a.guess.trim();
      const userIdx = guess ? s.messages.slice(0, i).map((m) => m.role).lastIndexOf('user') : -1;
      return {
        ...s,
        messages: s.messages.map((m, j) => {
          if (j === i) return { ...m, veiled: false, guess: guess || undefined };
          if (j === userIdx && m.classification && m.classification.mode === 'ai') {
            return {
              ...m,
              classification: {
                ...m.classification,
                mode: 'together',
                reasons: [...m.classification.reasons, 'You predicted the answer before reading it'],
              },
            };
          }
          return m;
        }),
      };
    }
    case 'settings':
      return { ...s, settings: { ...s.settings, ...a.patch } };
    case 'panel':
      return { ...s, panelOpen: a.open };
    case 'forest':
      return { ...s, forest: { open: a.open, focus: a.focus ?? null } };
    case 'draft':
      return { ...s, draft: { text: a.text, nonce: s.draft.nonce + 1 } };
    case 'highlight':
      return { ...s, highlight: a.ids };
    case 'composer':
      if (s.composer.lens === a.lens && s.composer.nudge === a.nudge) return s;
      return { ...s, composer: { lens: a.lens, nudge: a.nudge } };
    case 'flash':
      return { ...s, flash: { id: a.id, nonce: (s.flash?.nonce ?? 0) + 1 } };
    case 'onboarding':
      return { ...s, onboarding: a.open };
    case 'toast':
      return { ...s, toast: { text: a.text, nonce: (s.toast?.nonce ?? 0) + 1 } };
    case 'reset': {
      const base = a.empty ? { messages: [], concepts: {} } : seedState();
      return { ...s, ...base, pendingQuiz: null, busy: false, highlight: [], forest: { open: false, focus: null } };
    }
  }
}

/* ───────────── Derived data ───────────── */

export function conceptScore(c: LiveConcept, byId: Record<string, ChatMessage>): number {
  const scores = c.messageIds.map((id) => byId[id]?.classification).filter(Boolean) as Classification[];
  return scores.length ? Math.max(...scores.map((x) => MODE_SCORE[x.mode])) : 0;
}

export function buildLiveTree(s: Pick<State, 'messages' | 'concepts'>): TreeData {
  const byId = Object.fromEntries(s.messages.map((m) => [m.id, m]));
  const concepts = Object.values(s.concepts).sort((a, b) => a.order - b.order);
  const branchOrder: string[] = [];
  for (const c of concepts) if (!branchOrder.includes(c.branchId)) branchOrder.push(c.branchId);
  return {
    id: LIVE_TREE.id,
    title: LIVE_TREE.title,
    grove: LIVE_TREE.grove,
    updated: 'Today',
    live: true,
    branches: branchOrder.map((bid) => ({
      id: bid,
      label: BRANCHES[bid] ?? 'Side questions',
      leaves: concepts
        .filter((c) => c.branchId === bid)
        .map((c) => ({
          id: c.id,
          label: c.label,
          score: conceptScore(c, byId),
          messageId: c.messageIds[c.messageIds.length - 1],
          count: c.messageIds.length,
        })),
    })),
  };
}

/* ───────────── Context ───────────── */

interface Ctx {
  state: State;
  dispatch: React.Dispatch<Action>;
  liveTree: TreeData;
  /** `veil`: hide the answer until the user guesses or reveals it (predict → reveal). */
  send: (text: string, cls?: Classification, opts?: { veil?: boolean }) => void;
  /** Classify with the current conversation context (e.g. a pending quiz). */
  classifyDraft: (text: string) => Classification;
  jumpTo: (messageId: string) => void;
  toast: (text: string) => void;
  finishOnboarding: () => void;
}

const StoreContext = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, init);
  const ref = useRef(state);
  ref.current = state;
  const timers = useRef<number[]>([]);
  const initialSettings = useRef(state.settings);

  // Persist only changes the user makes (not URL-parameter overrides on load).
  useEffect(() => {
    if (state.settings === initialSettings.current) return;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
    } catch {
      /* storage unavailable — settings stay in memory */
    }
  }, [state.settings]);

  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);

  const classifyDraft = useCallback((text: string) => {
    const pq = ref.current.pendingQuiz;
    return classify(text, { pendingQuiz: looksLikeQuizAnswer(text, pq) ? pq : null });
  }, []);

  const send = useCallback(
    (text: string, cls?: Classification, opts?: { veil?: boolean }) => {
      const s = ref.current;
      if (s.busy || !text.trim()) return;
      const classification = cls ?? classifyDraft(text);
      const user: ChatMessage = { id: newId('u'), role: 'user', text: text.trim(), classification, conceptIds: [] };
      dispatch({ type: 'user', msg: user });

      const byId = Object.fromEntries(s.messages.map((m) => [m.id, m]));
      const known = Object.values(s.concepts)
        .filter((c) => c.branchId !== 'other')
        .map((c) => ({ id: c.id, score: conceptScore(c, byId) }));
      const pq = looksLikeQuizAnswer(text, s.pendingQuiz) ? s.pendingQuiz : null;
      const result = respond({ text, mode: classification.mode, pendingQuiz: pq, known });

      const aid = newId('a');
      const think = 650 + Math.random() * 400;
      timers.current.push(
        window.setTimeout(() => {
          dispatch({
            type: 'assistantStart',
            userId: user.id,
            concepts: result.concepts,
            pendingQuiz: result.pendingQuiz,
            msg: {
              id: aid,
              role: 'assistant',
              text: '',
              conceptIds: result.concepts.map((c) => c.id),
              streaming: true,
              reflectOn: result.reflectOn,
              veiled: opts?.veil || undefined,
            },
          });
          const tokens = result.reply.split(/(\s+)/);
          let i = 0;
          const tick = () => {
            i = Math.min(tokens.length, i + 4);
            dispatch({ type: 'stream', id: aid, text: tokens.slice(0, i).join('') });
            if (i < tokens.length) timers.current.push(window.setTimeout(tick, 28));
            else dispatch({ type: 'assistantDone', id: aid });
          };
          tick();
        }, think),
      );
    },
    [classifyDraft],
  );

  const jumpTo = useCallback((messageId: string) => {
    dispatch({ type: 'forest', open: false });
    dispatch({ type: 'flash', id: messageId });
  }, []);

  const toast = useCallback((text: string) => dispatch({ type: 'toast', text }), []);

  const finishOnboarding = useCallback(() => {
    try {
      localStorage.setItem(ONBOARD_KEY, '1');
    } catch {
      /* ignore */
    }
    dispatch({ type: 'onboarding', open: false });
  }, []);

  const liveTree = useMemo(() => buildLiveTree(state), [state.messages, state.concepts]);

  const value = useMemo(
    () => ({ state, dispatch, liveTree, send, classifyDraft, jumpTo, toast, finishOnboarding }),
    [state, liveTree, send, classifyDraft, jumpTo, toast, finishOnboarding],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore outside StoreProvider');
  return ctx;
}
