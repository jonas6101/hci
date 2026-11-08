import type { Grove, Leaf, TreeData } from './types';
import { mean } from './modes';

/* ───────────────────────── Single tree ─────────────────────────
 *
 * The tree grows upward in conversation order: the first topic is the lowest
 * branch, the newest one sits at the crown. Branches alternate sides of the trunk;
 * each branch carries its concepts as leaves rising diagonally outward.
 * All coordinates are relative to the base of the trunk (0, 0) = ground.
 */

export const G = {
  REACH: 50, // trunk → branch node, horizontal
  RISE: 30, // trunk attachment → branch node, vertical
  LEAF_DY: 25,
  LEAF_DX: 7,
  GAP: 18, // vertical gap between blocks on the same side
  STAGGER: 34, // minimum distance between consecutive attachments on the trunk
  FIRST: 30,
  LABEL_HALF_WIDTH: 210,
};

export interface PlacedLeaf extends Leaf {
  /** Relative to the branch attachment point (0, base). */
  x: number;
  y: number;
}

export interface PlacedBranch {
  id: string;
  label: string;
  score: number;
  side: 1 | -1;
  /** y of the attachment point on the trunk. */
  base: number;
  leaves: PlacedLeaf[];
}

export interface TreeLayout {
  branches: PlacedBranch[];
  trunkTop: number;
  /** Highest point (most negative y). */
  top: number;
  /** Half width without labels. */
  halfWidth: number;
  score: number;
  count: number;
}

export function layoutTree(tree: TreeData): TreeLayout {
  const sideTop: Record<string, number> = { '1': 0, '-1': 0 };
  let prevBase = 0;
  let halfWidth = G.REACH + 10;
  let top = -40;
  const all: number[] = [];

  const branches: PlacedBranch[] = tree.branches.map((b, i) => {
    const side: 1 | -1 = i % 2 === 0 ? 1 : -1;
    const n = b.leaves.length;
    let base = i === 0 ? -G.FIRST : prevBase - G.STAGGER;
    base = Math.min(base, sideTop[String(side)] - G.GAP);
    const leaves: PlacedLeaf[] = b.leaves.map((l, j) => ({
      ...l,
      x: side * (G.REACH + G.LEAF_DX * (j + 1)),
      y: -G.RISE - G.LEAF_DY * (j + 1),
    }));
    const blockTop = base - G.RISE - G.LEAF_DY * n - 12;
    sideTop[String(side)] = blockTop;
    prevBase = base;
    top = Math.min(top, blockTop);
    halfWidth = Math.max(halfWidth, G.REACH + G.LEAF_DX * n + 10);
    b.leaves.forEach((l) => all.push(l.score));
    return { id: b.id, label: b.label, score: mean(b.leaves.map((l) => l.score)), side, base, leaves };
  });

  const trunkTop = branches.length ? Math.min(...branches.map((b) => b.base)) - 18 : -26;
  return { branches, trunkTop, top: Math.min(top, trunkTop), halfWidth, score: mean(all), count: all.length };
}

/* ───────────────────────── Forest ───────────────────────── */

export interface PlacedTree {
  tree: TreeData;
  layout: TreeLayout;
  /** Trunk base in world coordinates. */
  x: number;
  y: number;
  slot: number;
}

export interface PlacedGrove {
  grove: Grove;
  x0: number;
  x1: number;
  y: number;
  trees: PlacedTree[];
  score: number;
  count: number;
}

export interface RootLink {
  a: string;
  b: string;
  labels: string[];
  sameGrove: boolean;
}

export interface Bounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface ForestLayout {
  trees: PlacedTree[];
  groves: PlacedGrove[];
  links: RootLink[];
  bounds: Bounds;
  byId: Record<string, PlacedTree>;
}

const SLOT_MIN = 190;
const GROVE_GAP = 150;
const ROW_GAP = 190;
export const GROUND_DEPTH = 110;

export function layoutForest(trees: TreeData[], groves: Grove[], rows: string[][]): ForestLayout {
  const placed: PlacedTree[] = [];
  const placedGroves: PlacedGrove[] = [];
  let ground = 0;
  let y0 = 0;
  let x0 = Infinity;
  let x1 = -Infinity;

  rows.forEach((row, ri) => {
    const rowGroves = row.map((gid) => ({
      grove: groves.find((g) => g.id === gid)!,
      items: trees.filter((t) => t.grove === gid).map((t) => ({ tree: t, layout: layoutTree(t) })),
    }));
    const all = rowGroves.flatMap((g) => g.items);
    const maxH = Math.max(120, ...all.map((i) => -i.layout.top));
    const slot = (i: { layout: TreeLayout }) => Math.max(SLOT_MIN, i.layout.halfWidth * 2 + 60);
    const width =
      rowGroves.reduce((s, g) => s + g.items.reduce((s2, i) => s2 + slot(i), 0), 0) + GROVE_GAP * (rowGroves.length - 1);

    ground = ri === 0 ? 0 : ground + ROW_GAP + maxH;
    if (ri === 0) y0 = -maxH - 30;

    let x = -width / 2;
    rowGroves.forEach(({ grove, items }) => {
      const gx0 = x;
      const gTrees: PlacedTree[] = items.map((i) => {
        const s = slot(i);
        const p = { ...i, x: x + s / 2, y: ground, slot: s };
        x += s;
        return p;
      });
      placed.push(...gTrees);
      const leaves = gTrees.flatMap((t) => t.tree.branches.flatMap((b) => b.leaves.map((l) => l.score)));
      placedGroves.push({ grove, x0: gx0, x1: x, y: ground, trees: gTrees, score: mean(leaves), count: leaves.length });
      x0 = Math.min(x0, gx0);
      x1 = Math.max(x1, x);
      x += GROVE_GAP;
    });
  });

  // Shared concepts between trees become roots ("the wood wide web").
  const labelsOf = (t: TreeData) =>
    new Map(t.branches.flatMap((b) => b.leaves.map((l) => [l.label.toLowerCase(), l.label] as const)));
  const links: RootLink[] = [];
  for (let i = 0; i < placed.length; i++) {
    const la = labelsOf(placed[i].tree);
    for (let j = i + 1; j < placed.length; j++) {
      const lb = labelsOf(placed[j].tree);
      const shared = [...la.keys()].filter((k) => lb.has(k)).map((k) => la.get(k)!);
      if (shared.length) {
        links.push({
          a: placed[i].tree.id,
          b: placed[j].tree.id,
          labels: shared,
          sameGrove: placed[i].tree.grove === placed[j].tree.grove,
        });
      }
    }
  }

  return {
    trees: placed,
    groves: placedGroves,
    links,
    bounds: { x0: x0 - 40, y0, x1: x1 + 40, y1: ground + GROUND_DEPTH + 40 },
    byId: Object.fromEntries(placed.map((p) => [p.tree.id, p])),
  };
}

export function treeBounds(p: PlacedTree, withLabels: boolean): Bounds {
  const hw = withLabels ? G.LABEL_HALF_WIDTH : p.layout.halfWidth + 20;
  return { x0: p.x - hw, x1: p.x + hw, y0: p.y + p.layout.top - 16, y1: p.y + 50 };
}

export function groveBounds(g: PlacedGrove): Bounds {
  const top = Math.min(...g.trees.map((t) => t.y + t.layout.top));
  return { x0: g.x0 - 20, x1: g.x1 + 20, y0: top - 30, y1: g.y + GROUND_DEPTH };
}
