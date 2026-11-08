import { BRANCHES, CONCEPTS, CONCEPT_BY_ID, type ConceptDef } from '../data/scenario';
import type { Mode } from './types';

/**
 * The scripted "assistant". Given the user's prompt and how Arbor classified it,
 * pick a plausible reply and report which concepts the exchange touched.
 * Swap this module for a real LLM call to turn the prototype into a live system.
 */

export interface TouchedConcept {
  id: string;
  label: string;
  branchId: string;
}

export interface EngineResult {
  reply: string;
  concepts: TouchedConcept[];
  pendingQuiz: string | null;
  reflectOn?: string;
}

interface EngineInput {
  text: string;
  mode: Mode;
  pendingQuiz: string | null;
  /** Concepts already in the live tree, with their current "you" score. */
  known: { id: string; score: number }[];
}

const touch = (c: ConceptDef): TouchedConcept => ({ id: c.id, label: c.label, branchId: c.branch });

export function matchConcepts(text: string): ConceptDef[] {
  const t = text.toLowerCase();
  return CONCEPTS.map((c) => ({
    c,
    score: c.keywords.reduce((s, k) => (t.includes(k) ? s + k.length : s), 0),
  }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.c);
}

const STOP = new Set(
  'a an the of to in on for and or but is are was were be been it its this that these those with about what whats what\'s how why when who which does do did can could would should will me my i you your we our us please tell explain give write show just so like think really also some any there their them they into from at by as if then than more most very much make get let lets let\'s quiz test hint'.split(
    ' ',
  ),
);

function extractLabel(text: string): string {
  const words = text
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w.toLowerCase()));
  const label = words.slice(0, 3).join(' ') || 'Open question';
  return label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
}

const isHint = (t: string) => /\bhint\b/i.test(t);
const isQuiz = (t: string) => /\b(quiz|test) me\b|\bask me\b/i.test(t);
const isSummary = (t: string) => /\b(summary|summari[sz]e|cheat ?sheet|recap|exam notes|everything so far)\b/i.test(t);
const GIVE_UP = /\b(i don'?t know|no idea|not sure|just tell me|tell me the answer|skip|give up|reveal)\b/i;

/** Is this message an answer to the pending quiz question (rather than a new question)? */
export function looksLikeQuizAnswer(text: string, quizId: string | null): boolean {
  if (!quizId || isQuiz(text)) return false;
  const m = matchConcepts(text);
  if (text.trim().endsWith('?') && m.length && m[0].id !== quizId) return false;
  return true;
}

function quizPrompt(c: ConceptDef): EngineResult {
  return {
    reply: `Sure — here’s one on **${c.label}**:\n\n${c.quiz.q}\n\nTake a moment and answer in your own words before you look anything up.`,
    concepts: [touch(c)],
    pendingQuiz: c.id,
  };
}

export function respond({ text, mode, pendingQuiz, known }: EngineInput): EngineResult {
  const matches = matchConcepts(text);

  // 1. The user is answering a quiz question.
  if (pendingQuiz && !isQuiz(text) && CONCEPT_BY_ID[pendingQuiz]) {
    const c = CONCEPT_BY_ID[pendingQuiz];
    if (GIVE_UP.test(text)) {
      return {
        reply: `No problem — here’s the answer: ${c.quiz.answer}\n\nWhen you’re ready, try explaining it back in your own words — that’s when it really sticks.`,
        concepts: [touch(c)],
        pendingQuiz: null,
        reflectOn: c.id,
      };
    }
    const lower = text.toLowerCase();
    const hit = c.quiz.expect.some((k) => lower.includes(k));
    return {
      reply: hit
        ? `**Yes — that’s it.** ${c.quiz.answer}\n\nYou just retrieved that from memory, which is one of the most effective ways to make it stick.`
        : `**Not quite — but you’re on your way.** ${c.quiz.answer}\n\nCompare that with what you wrote: which part was missing?`,
      concepts: [touch(c)],
      pendingQuiz: null,
      reflectOn: hit ? undefined : c.id,
    };
  }

  // 2. "Quiz me" without a specific topic → quiz the concept you own least.
  if (isQuiz(text) && !matches.length) {
    const weakest = [...known].sort((a, b) => a.score - b.score)[0];
    const c = CONCEPT_BY_ID[weakest?.id ?? 'backprop'] ?? CONCEPT_BY_ID.backprop;
    return quizPrompt(c);
  }

  // 3. A known concept.
  if (matches.length) {
    const c = matches[0];
    if (isQuiz(text)) return quizPrompt(c);
    const extra = matches.slice(1, 2).filter((m) => m.branch === c.branch);
    const concepts = [touch(c), ...extra.map(touch)];
    if (isHint(text)) return { reply: c.hint, concepts, pendingQuiz: null };
    // The user added their own take to a request → react to it, then deliver.
    if (/my first guess:\s*\S/i.test(text)) return { reply: `${c.confirm}\n\n${c.full}`, concepts, pendingQuiz: null };
    if (mode === 'own') return { reply: c.confirm, concepts, pendingQuiz: null };
    if (mode === 'together') return { reply: c.explain, concepts, pendingQuiz: null };
    return { reply: c.full, concepts, pendingQuiz: null, reflectOn: c.id };
  }

  // 4. Summary of everything covered so far.
  if (isSummary(text) && known.length) {
    const lines = known
      .map((k) => CONCEPT_BY_ID[k.id])
      .filter(Boolean)
      .map((c) => `- **${c.label}** — ${c.quiz.answer}`);
    return {
      reply: `Here’s a compact cheat-sheet of what we’ve covered:\n\n${lines.join('\n')}`,
      concepts: [],
      pendingQuiz: null,
    };
  }

  // 5. Anything else → a side question on its own branch.
  const label = extractLabel(text);
  const id = `side-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const intro =
    mode === 'own'
      ? 'Interesting thought — and a reasonable way to look at it. It goes a bit beyond what we’ve covered so far, but it connects to how networks learn from data.'
      : mode === 'together'
        ? 'Good thing to explore. It goes a bit beyond what we’ve covered so far — what’s your current intuition about it?'
        : 'Here’s the short version: that goes a bit beyond what we’ve covered so far, but it builds on the same ideas — neurons, weights, and learning from a loss.';
  return {
    reply: `${intro}\n\n_Prototype note: this scripted assistant knows about neurons, layers, weights, activation functions, loss, gradient descent, backpropagation, learning rate, overfitting and regularization._`,
    concepts: [{ id, label, branchId: 'other' }],
    pendingQuiz: null,
  };
}

export function branchLabel(id: string) {
  return BRANCHES[id] ?? 'Side questions';
}
