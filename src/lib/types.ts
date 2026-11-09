/** Who did the thinking for a prompt. */
export type Mode = 'own' | 'together' | 'ai';

/** A stretch of the prompt that made the classifier lean one way (character offsets). */
export interface Evidence {
  start: number;
  end: number;
  mode: Mode;
  reason: string;
}

export interface Classification {
  mode: Mode;
  /** 0..1 — how sure the heuristic is. Shown to the user for transparency. */
  confidence: number;
  /** Human-readable explanations ("Starts with 'write' …"). */
  reasons: string[];
  /** True once the user corrected the label by hand. */
  overridden?: boolean;
  /** Where in the text each reason comes from, so a design can point at the words. */
  evidence?: Evidence[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  /** User messages only. */
  classification?: Classification;
  /** Concepts this exchange touched. */
  conceptIds: string[];
  streaming?: boolean;
  /** Assistant only: concept the "Make it yours" actions refer to. */
  reflectOn?: string;
  /** Assistant only: the answer is hidden until the user guesses or reveals it (predict → reveal). */
  veiled?: boolean;
  /** Assistant only: what the user predicted before revealing the answer. */
  guess?: string;
}

/** A concept that has appeared in the live conversation. */
export interface LiveConcept {
  id: string;
  label: string;
  branchId: string;
  /** Creation order — the tree grows upwards in this order. */
  order: number;
  /** User messages that touched this concept. */
  messageIds: string[];
}

export interface Leaf {
  id: string;
  label: string;
  /** 0 = AI did the thinking, 0.5 = together, 1 = you. */
  score: number;
  messageId?: string;
  count?: number;
}

export interface Branch {
  id: string;
  label: string;
  leaves: Leaf[];
}

export interface TreeData {
  id: string;
  title: string;
  grove: string;
  updated: string;
  live?: boolean;
  branches: Branch[];
}

export interface Grove {
  id: string;
  label: string;
}

export type NudgeLevel = 'off' | 'gentle' | 'active';
/** Design styles: each is its own UI over the same store (see src/designs/). */
export type Design = 'ascii' | 'classic';
export type Theme = 'system' | 'light' | 'dark';

export interface Settings {
  enabled: boolean;
  nudge: NudgeLevel;
  showTags: boolean;
  theme: Theme;
  /** Show the squirrel mascot in the panel. */
  mascot: boolean;
  design: Design;
}
