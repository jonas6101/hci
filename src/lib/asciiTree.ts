import { mean, pct } from './modes';
import type { TreeData } from './types';

/* ───────────────────────── ASCII tree ─────────────────────────
 *
 * The knowledge tree drawn in characters, with the same growth rules as layoutTree():
 * the first topic is the lowest branch, branches alternate sides of the trunk, and each
 * branch's concepts climb outward along a twig. The trunk thickens as the tree gains
 * concepts and tapers towards the crown; roots spread under the ground line.
 *
 * Everything sits on a character grid (row r from the top, column c) so the renderer can
 * animate each character on its own. Every character carries
 *   key — stable across re-layouts, so a growing tree glides instead of jumping
 *   t   — growth order: when it appears as the tree grows in
 *   h   — 0 at the ground, 1 at the crown: how far it bends in the wind
 * and for every node, `paths` lists the wood it hangs from, ordered from the node down to
 * the roots (d = distance), so a hover can light it up like sap flowing.
 *
 * asciiOutline() lays the same tree out as a `tree`-command outline. Nodes keep their keys in
 * both layouts, so a renderer can morph between the two views and every leaf glides to its
 * new place (object constancy) while the wood is redrawn around it.
 */

export type WoodKind = 'trunk' | 'limb' | 'twig' | 'ground' | 'root';

export interface Wood {
  key: string;
  r: number;
  c: number;
  ch: string;
  kind: WoodKind;
  t: number;
  h: number;
}

export interface TreeNode {
  key: string;
  id: string;
  kind: 'leaf' | 'branch';
  branchId: string;
  r: number;
  /** Column of the glyph. */
  c: number;
  /** Which way the label runs from the glyph. */
  side: 1 | -1;
  score: number;
  /** Fitted to the available width (may end in "…"). */
  label: string;
  fullLabel: string;
  t: number;
  messageId?: string;
  /** Leaves: messages that touched the concept. Branches: number of leaves. */
  count: number;
}

export interface PathStep {
  key: string;
  d: number;
}

export interface AsciiTree {
  view: 'tree' | 'outline';
  cols: number;
  rows: number;
  /** Column of the trunk's centre. */
  trunk: number;
  /** Row of the ground line (tree view): where fallen leaves land. */
  ground: number | null;
  wood: Wood[];
  nodes: TreeNode[];
  title: { r: number; c: number; text: string };
  meta: { r: number; c: number; text: string; t: number };
  /** Node id → its wood down to the roots. `sub:<branchId>` → that branch's twigs, upwards. */
  paths: Record<string, PathStep[]>;
  maxT: number;
  score: number;
  count: number;
}

const ROOT_DEPTH = 3;
/** How far (in characters) the lowest limb runs flat before rising. */
const REACH = 3;

const hash = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

/** Trunk columns relative to the trunk column, for a given width. */
const span = (w: number): [number, number] => (w === 3 ? [-1, 1] : w === 2 ? [0, 1] : [0, 0]);

/** Trunk width at relative height t (0 = ground, 1 = crown): thick at the base, thin at the top. */
const taper = (base: number, t: number) => (base === 3 ? (t < 0.45 ? 3 : t < 0.75 ? 2 : 1) : base === 2 ? (t < 0.6 ? 2 : 1) : 1);

interface Placed {
  wood: Wood[];
  nodes: TreeNode[];
  paths: Record<string, PathStep[]>;
  /** Columns needed left and right of the trunk column, labels included. */
  needL: number;
  needR: number;
}

/** Lay the tree out with the trunk at column 0 and the ground at row 0 (rows above are negative). */
function place(tree: TreeData, reach: number, t0: number): Placed {
  const count = tree.branches.reduce((n, b) => n + b.leaves.length, 0);
  const base = count >= 7 ? 3 : count >= 3 ? 2 : 1;
  const nb = tree.branches.length;

  // Pass 1: rows. A branch attaches at row a; its node sits one row up, its leaves climb two rows each.
  const sideTop: Record<number, number> = { 1: 0, [-1]: 0 };
  let prev = 0;
  let topA = 0;
  const rows = tree.branches.map((b, i) => {
    const side: 1 | -1 = i % 2 === 0 ? 1 : -1;
    let a = i === 0 ? -2 : prev - 2;
    a = Math.min(a, sideTop[side] - 1);
    const flat = Math.max(0, Math.round(reach * (1 - i / Math.max(1, nb))));
    sideTop[side] = a - 2 - 2 * b.leaves.length;
    prev = a;
    topA = Math.min(topA, a);
    return { b, side, a, flat };
  });
  const trunkAt = (r: number) => span(taper(base, -r / (1 - topA)));

  const wood: Wood[] = [];
  const nodes: TreeNode[] = [];
  const paths: Record<string, PathStep[]> = {};

  // Trunk, from the ground up.
  const trunkKeys: string[][] = [];
  for (let r = 0; r >= topA; r--) {
    const [l, rr] = trunkAt(r);
    const keys: string[] = [];
    for (let c = l; c <= rr; c++) {
      const key = `tr:${-r}:${c - l}`;
      wood.push({ key, r, c, ch: '|', kind: 'trunk', t: t0 + -r, h: 0 });
      keys.push(key);
    }
    trunkKeys[-r] = keys;
  }

  // Ground line, spreading out from the trunk.
  const [bl, br] = trunkAt(0);
  const spread = 6 + base * 2;
  const flare: string[] = [];
  for (let c = -spread; c <= spread; c++) {
    if (c >= bl && c <= br) continue;
    const d = c < bl ? bl - c : c - br;
    const ch = d === 1 ? (c < bl ? '/' : '\\') : d <= 3 ? '_' : d <= 5 ? '.' : hash(c) < 0.4 ? '-' : '~';
    const key = `gd:${c < bl ? 'l' : 'r'}${d}`;
    wood.push({ key, r: 0, c, ch, kind: d === 1 ? 'trunk' : 'ground', t: t0 + d * 0.35, h: 0 });
    if (d === 1) flare.push(key);
  }

  // Roots under the ground.
  const mid = (r: number, ch: string) => Array.from({ length: br - bl + 1 }, (_, k) => [r, bl + k, ch] as const);
  const two = br - bl === 1;
  const roots = [
    [1, bl - 1, '/'],
    [1, br + 1, '\\'],
    ...mid(1, '|'),
    [2, bl - 3, '.'],
    [2, br + 3, '.'],
    [2, bl - 1, "'"],
    [2, br + 1, "'"],
    ...(two ? mid(2, '|') : ([[2, 0, '|']] as const)),
    [3, two ? bl : 0, "'"],
  ] as const;
  const rootRows: string[][] = [flare, [], [], []];
  roots.forEach(([r, c, ch], i) => {
    const key = `rt:${i}`;
    wood.push({ key, r, c, ch, kind: 'root', t: t0 + r * 0.9 + Math.abs(c) * 0.15, h: 0 });
    rootRows[r].push(key);
  });

  // Branches: limb, node, then the leaves along the twig.
  for (const { b, side: s, a, flat } of rows) {
    const [l, rr] = trunkAt(a);
    const edge = s > 0 ? rr : l;
    const ha = -a;
    const limb: string[] = [];
    for (let k = 1; k <= flat + 1; k++) {
      const key = `lb:${b.id}:${k}`;
      wood.push({ key, r: a, c: edge + s * k, ch: k <= flat ? '_' : s > 0 ? '/' : '\\', kind: 'limb', t: t0 + ha + k * 0.8, h: 0 });
      limb.unshift(key);
    }
    const nr = a - 1;
    const nc = edge + s * (flat + 2);
    const tNode = t0 + ha + (flat + 2) * 0.8;
    nodes.push({
      key: `n:${b.id}`,
      id: b.id,
      kind: 'branch',
      branchId: b.id,
      r: nr,
      c: nc,
      side: s,
      score: mean(b.leaves.map((x) => x.score)),
      label: b.label,
      fullLabel: b.label,
      t: tNode,
      count: b.leaves.length,
    });

    // The way down: limb, trunk from the attachment to the ground, then the roots.
    const down: PathStep[] = [];
    let d = 1;
    for (const key of limb) down.push({ key, d: d++ });
    for (let h = ha; h >= 0; h--) {
      for (const key of trunkKeys[h]) down.push({ key, d });
      d++;
    }
    for (const row of rootRows) {
      for (const key of row) down.push({ key, d });
      d++;
    }
    paths[b.id] = down;

    const twigs: string[] = [];
    b.leaves.forEach((leaf, j) => {
      const c = nc + s * (j + 1);
      const key = `tw:${leaf.id}`;
      wood.push({ key, r: nr - 1 - 2 * j, c, ch: s > 0 ? '/' : '\\', kind: 'twig', t: tNode + 1 + 2 * j, h: 0 });
      twigs.push(key);
      nodes.push({
        key: `n:${leaf.id}`,
        id: leaf.id,
        kind: 'leaf',
        branchId: b.id,
        r: nr - 2 - 2 * j,
        c,
        side: s,
        score: leaf.score,
        label: leaf.label,
        fullLabel: leaf.label,
        t: tNode + 2 + 2 * j,
        messageId: leaf.messageId,
        count: leaf.count ?? 1,
      });
      const own = [...twigs].reverse().map((k, i) => ({ key: k, d: 1 + i * 2 }));
      const off = twigs.length * 2;
      paths[leaf.id] = [...own, ...down.map((x) => ({ key: x.key, d: x.d + off }))];
    });
    paths[`sub:${b.id}`] = twigs.map((key, i) => ({ key, d: 1 + i * 2 }));
  }

  let needL = spread + 1;
  let needR = spread + 1;
  for (const w of wood) {
    needL = Math.max(needL, -w.c);
    needR = Math.max(needR, w.c);
  }
  for (const n of nodes) {
    const end = n.c + n.side * (1 + n.fullLabel.length);
    needL = Math.max(needL, -Math.min(n.c, end));
    needR = Math.max(needR, Math.max(n.c, end));
  }
  return { wood, nodes, paths, needL, needR };
}

/** Lay out `tree` in `cols` characters. Returns null for a tree without branches. */
export function asciiTree(tree: TreeData, cols: number): AsciiTree | null {
  if (!tree.branches.length) return null;
  const title = tree.title.toLowerCase();
  const t0 = title.length * 0.45 + 1; // the title types itself first

  // Lower limbs reach out further; shorten them until every label fits.
  let p = place(tree, REACH, t0);
  for (let reach = REACH - 1; reach >= 0 && p.needL + 1 + p.needR > cols; reach--) p = place(tree, reach, t0);

  const { needL, needR } = p;
  const T =
    needL + 1 + needR <= cols
      ? needL + Math.floor((cols - needL - 1 - needR) / 2)
      : Math.round(((cols - 1) * needL) / (needL + needR));

  const top = Math.min(...p.wood.map((w) => w.r), ...p.nodes.map((n) => n.r));
  const height = -top;
  const row = (r: number) => r - top;

  const wood = p.wood
    .map((w) => ({ ...w, r: row(w.r), c: T + w.c, h: w.r < 0 ? -w.r / height : 0 }))
    .filter((w) => w.c >= 0 && w.c < cols);
  const nodes = p.nodes.map((n) => {
    const c = T + n.c;
    const room = n.side > 0 ? cols - (c + 2) : c - 1;
    const label = n.fullLabel.length > room ? `${n.fullLabel.slice(0, Math.max(1, room - 1))}…` : n.fullLabel;
    return { ...n, r: row(n.r), c, label };
  });

  const leaves = tree.branches.flatMap((b) => b.leaves.map((l) => l.score));
  const score = mean(leaves);
  const count = leaves.length;
  const metaText = `${count} concept${count === 1 ? '' : 's'} · ${pct(score)}% your thinking`;
  const center = (text: string) => Math.max(0, Math.min(cols - text.length, T - Math.floor(text.length / 2)));

  const maxT = Math.max(...wood.map((w) => w.t), ...nodes.map((n) => n.t + 1 + n.label.length * 0.35));
  const titleRow = row(ROOT_DEPTH + 1);
  return {
    view: 'tree',
    ground: row(0),
    cols,
    rows: titleRow + 2,
    trunk: T,
    wood,
    nodes,
    title: { r: titleRow, c: center(title), text: title },
    meta: { r: titleRow + 1, c: center(metaText), text: metaText, t: maxT + 1 },
    paths: p.paths,
    maxT: maxT + 1,
    score,
    count,
  };
}

/* ───────────────────────── Outline ─────────────────────────
 *
 *   neural networks
 *   ├── ◑ building blocks
 *   │   ├── ● artificial neuron
 *   │   └── ○ layers
 *   └── ● how it learns
 *       └── ● gradient descent
 *
 *   4 concepts · 72% your thinking
 */
export function asciiOutline(tree: TreeData, cols: number): AsciiTree | null {
  if (!tree.branches.length) return null;
  const title = tree.title.toLowerCase();
  const t0 = 1;
  const X = 1; // left margin
  const wood: Wood[] = [];
  const nodes: TreeNode[] = [];
  const paths: Record<string, PathStep[]> = {};
  /** Keys of the column-0 characters, by row: the "trunk" of the outline. */
  const spine: string[] = [];
  const fit = (text: string, c: number) => {
    const room = cols - (c + 2);
    return text.length > room ? `${text.slice(0, Math.max(1, room - 1))}…` : text;
  };
  const put = (key: string, r: number, c: number, ch: string, kind: WoodKind) =>
    wood.push({ key, r, c: X + c, ch, kind, t: t0 + r * 1.1 + c * 0.12, h: 0 });

  let r = 1;
  tree.branches.forEach((b, bi) => {
    const lastB = bi === tree.branches.length - 1;
    const br = r;
    const bk = (k: number) => `ol:b:${b.id}:${k}`;
    put(bk(0), br, 0, lastB ? '└' : '├', 'limb');
    put(bk(1), br, 1, '─', 'limb');
    put(bk(2), br, 2, '─', 'limb');
    spine[br] = bk(0);
    // The way back to the title: this connector, then the spine up to the first row.
    const up = (from: number, d0: number) => {
      const steps: PathStep[] = [];
      let d = d0;
      for (let row = from - 1; row >= 1; row--) if (spine[row]) steps.push({ key: spine[row], d: d++ });
      return steps;
    };
    const down: PathStep[] = [
      { key: bk(2), d: 1 },
      { key: bk(1), d: 2 },
      { key: bk(0), d: 3 },
      ...up(br, 4),
    ];
    paths[b.id] = down;
    nodes.push({
      key: `n:${b.id}`,
      id: b.id,
      kind: 'branch',
      branchId: b.id,
      r: br,
      c: X + 4,
      side: 1,
      score: mean(b.leaves.map((x) => x.score)),
      label: fit(b.label, X + 4),
      fullLabel: b.label,
      t: t0 + br * 1.1 + 0.6,
      count: b.leaves.length,
    });

    const elbows: string[] = [];
    const sub: PathStep[] = [];
    b.leaves.forEach((leaf, j) => {
      const lr = br + 1 + j;
      const lastL = j === b.leaves.length - 1;
      const lk = (k: number) => `ol:l:${leaf.id}:${k}`;
      if (!lastB) {
        put(`ol:v:${b.id}:${j}`, lr, 0, '│', 'trunk');
        spine[lr] = `ol:v:${b.id}:${j}`;
      }
      put(lk(0), lr, 4, lastL ? '└' : '├', 'twig');
      put(lk(1), lr, 5, '─', 'twig');
      put(lk(2), lr, 6, '─', 'twig');
      const own: PathStep[] = [
        { key: lk(2), d: 1 },
        { key: lk(1), d: 2 },
        { key: lk(0), d: 3 },
        ...[...elbows].reverse().map((key, i) => ({ key, d: 4 + i })),
      ];
      const off = own.length;
      paths[leaf.id] = [...own, ...down.map((x) => ({ key: x.key, d: x.d + off }))];
      elbows.push(lk(0));
      sub.push({ key: lk(0), d: 1 + j }, { key: lk(1), d: 1 + j }, { key: lk(2), d: 1 + j });
      nodes.push({
        key: `n:${leaf.id}`,
        id: leaf.id,
        kind: 'leaf',
        branchId: b.id,
        r: lr,
        c: X + 8,
        side: 1,
        score: leaf.score,
        label: fit(leaf.label, X + 8),
        fullLabel: leaf.label,
        t: t0 + lr * 1.1 + 0.8,
        messageId: leaf.messageId,
        count: leaf.count ?? 1,
      });
    });
    paths[`sub:${b.id}`] = sub;
    r = br + 1 + b.leaves.length;
  });

  const leaves = tree.branches.flatMap((b) => b.leaves.map((l) => l.score));
  const score = mean(leaves);
  const count = leaves.length;
  const metaText = `${count} concept${count === 1 ? '' : 's'} · ${pct(score)}% your thinking`;
  const maxT = Math.max(...wood.map((w) => w.t), ...nodes.map((n) => n.t + 1 + n.label.length * 0.35));
  return {
    view: 'outline',
    cols,
    rows: r + 2,
    trunk: X,
    ground: null,
    wood,
    nodes,
    title: { r: 0, c: X, text: title },
    meta: { r: r + 1, c: X, text: metaText, t: maxT + 1 },
    paths,
    maxT: maxT + 1,
    score,
    count,
  };
}
