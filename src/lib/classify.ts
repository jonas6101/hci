import type { Classification, Evidence, Mode } from './types';

/**
 * Transparent, rule-based classifier: "who is doing the thinking in this prompt?"
 *
 * It is deliberately simple and explainable — every label comes with the reasons
 * that produced it, and the user can always override it. In a production version
 * this could be replaced by an LLM call that returns the same shape.
 */

interface Rule {
  re: RegExp;
  weight: number;
  reason: (m: RegExpMatchArray) => string;
  /** The words to point at, relative to the match (default: the whole match). */
  span?: (m: RegExpMatchArray) => [number, number];
}

const q = (s: string) => `“${s.trim()}”`;

const OWN: Rule[] = [
  {
    re: /\b(i think|i guess|i believe|i suspect|i reckon|i'?d say|i would say|i feel like|i assume|i expect|my hunch)\b/i,
    weight: 1,
    reason: (m) => `Shares your own view (${q(m[0])})`,
  },
  {
    re: /\bmy (own )?(guess|first guess|idea|take|understanding|answer|attempt|theory|intuition|hypothesis|first thought|reasoning|version|draft|explanation)\b/i,
    weight: 1,
    reason: (m) => `Brings in your own ${m[2]}`,
  },
  {
    re: /\bin my own words\b/i,
    weight: 1.5,
    reason: () => 'Explains the idea in your own words',
  },
  {
    re: /\b(so basically|so it'?s like|it'?s like|is it because|does that mean|would that mean|if i understand|if i'?m right|am i right|is that right|correct me|right\?)/i,
    weight: 0.8,
    reason: (m) => `Checks your own understanding (${q(m[0])})`,
  },
  {
    re: /\b(i tried|i wrote|i came up with|i worked out|i figured|here'?s (my|what i))\b/i,
    weight: 1,
    reason: () => 'Shows work you did yourself',
  },
];

const TOGETHER: Rule[] = [
  {
    re: /\b(hint|nudge me|point me)\b/i,
    weight: 1.2,
    reason: () => 'Asks for a hint rather than the answer',
  },
  {
    re: /\b(quiz me|test me|ask me|check my)\b/i,
    weight: 1.2,
    reason: () => 'Asks the AI to test you',
  },
  {
    re: /^(why|how come)\b|\bwhy (do|does|is|are|would|can|did|should)\b/i,
    weight: 1,
    reason: () => 'Asks “why” — you’re after understanding, not just an answer',
  },
  {
    re: /\b(help me understand|walk me through|guide me|step by step|what if|what would happen|difference between|compare|couldn'?t we|could we|what about)\b/i,
    weight: 1,
    reason: (m) => `Explores the idea (${q(m[0])})`,
  },
  {
    re: /\b(don'?t (tell|give) me the answer|not the (full )?answer|without (giving|telling))\b/i,
    weight: 1.2,
    reason: () => 'Keeps the answer for you to find',
  },
];

const AI: Rule[] = [
  {
    re: /^(please\s+)?((can|could|would) you\s+)?(please\s+)?(write|give|make|create|generate|summari[sz]e|list|solve|do|draft|compose|rewrite|fix|translate|calculate|compute|produce|outline|prepare|answer|explain|define|describe|tell me)\b/i,
    weight: 1,
    reason: (m) => `Starts with ${q(m[5])} — asks the AI to produce it`,
    span: (m) => [m[0].length - m[5].length, m[0].length],
  },
  {
    re: /\b(just (give|tell|write|do)|the answer|for me|cheat ?sheet|summary|tl;?dr|exam notes)\b/i,
    weight: 0.8,
    reason: (m) => `Asks for a finished result (${q(m[0])})`,
  },
  {
    re: /^(what('?s| is| are)|who (is|was)|when (did|was))\b/i,
    weight: 0.7,
    reason: () => 'Looks up a fact for you',
  },
];

const GIVE_UP = /\b(i don'?t know|no idea|not sure|just tell me|tell me the answer|skip|give up|reveal)\b/i;

/** Template text inserted by Arbor's nudge — doesn't count until the user adds to it. */
const EMPTY_TEMPLATE = /\n*\s*my first guess:\s*$/i;

/** A reason, and where it comes from in the text (start < 0: no particular words). */
interface Hit {
  reason: string;
  start: number;
  end: number;
  mode: Mode;
}

function run(rules: Rule[], text: string, mode: Mode, offset: number) {
  let score = 0;
  const hits: Hit[] = [];
  for (const r of rules) {
    const m = text.match(r.re);
    if (m) {
      score += r.weight;
      const [a, b] = r.span ? r.span(m) : [0, m[0].length];
      const at = (m.index ?? 0) + offset;
      hits.push({ reason: r.reason(m), start: at + a, end: at + b, mode });
    }
  }
  return {
    score,
    hits,
    get reasons() {
      return hits.map((h) => h.reason);
    },
  };
}

const evidenceOf = (hits: Hit[]): Evidence[] =>
  hits.filter((h) => h.start >= 0 && h.end > h.start).map(({ start, end, mode, reason }) => ({ start, end, mode, reason }));

export interface ClassifyContext {
  /** Concept id if the AI just asked the user a quiz question. */
  pendingQuiz?: string | null;
}

export function classify(raw: string, ctx: ClassifyContext = {}): Classification {
  // Same length as `raw` (one-for-one quote swap), so match offsets point into the original text.
  const norm = raw.replace(/[’‘]/g, "'");
  const lead = norm.length - norm.trimStart().length;
  const text = norm.replace(EMPTY_TEMPLATE, '').trim();
  const words = text.split(/\s+/).filter(Boolean).length;

  if (!text) return { mode: 'together', confidence: 0, reasons: [], evidence: [] };

  // Answering a quiz question is retrieval practice — the strongest form of own thinking.
  if (ctx.pendingQuiz && !/\b(quiz|test) me\b/i.test(text)) {
    const g = text.match(GIVE_UP);
    if (g) {
      const at = (g.index ?? 0) + lead;
      return {
        mode: 'ai',
        confidence: 0.8,
        reasons: ['Asked the AI to reveal the answer'],
        evidence: [{ start: at, end: at + g[0].length, mode: 'ai', reason: 'Asked the AI to reveal the answer' }],
      };
    }
    return { mode: 'own', confidence: 0.9, reasons: ['Answers the quiz question from memory'], evidence: [] };
  }

  const own = run(OWN, text, 'own', lead);
  const tog = run(TOGETHER, text, 'together', lead);
  const ai = run(AI, text, 'ai', lead);

  // Long, first-person messages usually carry the user's own reasoning.
  const firstPerson = (text.match(/\b(i|my|i'm|i've|me)\b/gi) ?? []).length;
  if (words > 28 && firstPerson >= 2 && own.score === 0) {
    own.score += 0.6;
    own.hits.push({ reason: 'A longer message written in your own words', start: -1, end: -1, mode: 'own' });
  }

  const conf = (s: number) => Math.min(0.95, 0.55 + 0.15 * s);
  let mode: Mode;
  let hits: Hit[];
  let confidence: number;

  if (own.score > 0 && ai.score > own.score) {
    mode = 'together';
    hits = [...own.hits, ...ai.hits];
    confidence = 0.6;
  } else if (own.score > 0) {
    mode = 'own';
    hits = [...own.hits, ...tog.hits];
    confidence = conf(own.score);
  } else if (tog.score > 0) {
    mode = 'together';
    hits = [...tog.hits, ...ai.hits.map((h) => ({ ...h, reason: `${h.reason} — but framed as a question to explore` }))].slice(0, 3);
    confidence = conf(tog.score - ai.score * 0.3);
  } else if (ai.score > 0) {
    mode = 'ai';
    hits = ai.hits;
    confidence = conf(ai.score);
  } else if (words <= 5) {
    mode = 'ai';
    hits = [{ reason: 'Short request — the AI fills in the rest', start: -1, end: -1, mode: 'ai' }];
    confidence = 0.5;
  } else {
    mode = 'together';
    hits = [{ reason: 'An open question — no clear sign of delegating or of your own take', start: -1, end: -1, mode: 'together' }];
    confidence = 0.4;
  }

  return { mode, confidence, reasons: hits.map((h) => h.reason), evidence: evidenceOf(hits) };
}
