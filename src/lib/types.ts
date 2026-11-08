/** Who did the thinking for a prompt. */
export type Mode = 'own' | 'together' | 'ai';

export interface Classification {
  mode: Mode;
  /** 0..1 — how sure the heuristic is. Shown to the user for transparency. */
  confidence: number;
  /** Human-readable explanations ("Starts with 'write' …"). */
  reasons: string[];
  /** True once the user corrected the label by hand. */
  overridden?: boolean;
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
export type Theme = 'system' | 'light' | 'dark';

export interface Settings {
  enabled: boolean;
  nudge: NudgeLevel;
  showTags: boolean;
  theme: Theme;
}
