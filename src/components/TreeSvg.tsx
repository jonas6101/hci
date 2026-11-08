import { memo, type MouseEvent } from 'react';
import { G, type PlacedBranch, type PlacedLeaf, type TreeLayout } from '../lib/layout';
import { BRANCH_FONT, LEAF_FONT, fitText } from '../lib/text';

/** Pie-filled node. Filled share = how much of the thinking was yours. */
export function Node({ r, score }: { r: number; score: number }) {
  const c = 2 * Math.PI * (r / 2);
  return (
    <>
      <circle className={`node-ring ${score > 0 ? 'is-you' : 'is-ai'}`} r={r} />
      <circle
        className="node-fill"
        r={r / 2}
        strokeWidth={r}
        strokeDasharray={`${Math.min(1, score) * c} ${c}`}
        transform="rotate(-90)"
      />
    </>
  );
}

export interface LeafEvent {
  leaf: PlacedLeaf;
  branch: PlacedBranch;
  event: MouseEvent<SVGGElement>;
}

interface Props {
  layout: TreeLayout;
  showLabels: boolean;
  /** Horizontal room (px from the trunk) available for labels on each side. */
  labelRoom?: number;
  highlight?: Set<string>;
  animate?: boolean;
  onLeafEnter?: (e: LeafEvent) => void;
  onLeafLeave?: () => void;
  onLeafClick?: (e: LeafEvent) => void;
}

function TreeSvgImpl({ layout, showLabels, labelRoom = G.LABEL_HALF_WIDTH, highlight, animate = true, onLeafEnter, onLeafLeave, onLeafClick }: Props) {
  const interactive = Boolean(onLeafClick || onLeafEnter);
  return (
    <g className={`tree ${animate ? 'animate' : ''}`}>
      <polygon className="trunk" points="-3.4,0 -1.1,-1 1.1,-1 3.4,0" style={{ transform: `scaleY(${-layout.trunkTop})` }} />
      {layout.branches.map((b) => {
        const s = b.side;
        const nx = s * G.REACH;
        const ny = -G.RISE;
        const last = b.leaves[b.leaves.length - 1];
        const anchor = s > 0 ? 'start' : 'end';
        return (
          <g key={b.id} className="branch" style={{ transform: `translate(0px, ${b.base}px)` }}>
            <path
              className="limb grow"
              pathLength={1}
              d={`M0,0 C${nx * 0.45},-2 ${nx * 0.8},${ny + 6} ${nx},${ny}`}
            />
            {last && <path className="twig" d={`M${nx},${ny} L${last.x},${last.y}`} />}
            {b.leaves.map((l) => {
              const ev = (event: MouseEvent<SVGGElement>) => ({ leaf: l, branch: b, event });
              return (
                <g
                  key={l.id}
                  className={`leaf ${highlight?.has(l.id) ? 'hl' : ''} ${interactive ? 'interactive' : ''}`}
                  style={{ transform: `translate(${l.x}px, ${l.y}px)` }}
                  onMouseEnter={onLeafEnter ? (e) => onLeafEnter(ev(e)) : undefined}
                  onMouseLeave={onLeafLeave}
                  onClick={onLeafClick ? (e) => onLeafClick(ev(e)) : undefined}
                >
                  <circle className="halo" r={10} />
                  <g className="sprout">
                    <Node r={5.5} score={l.score} />
                  </g>
                  {showLabels && (
                    <text className="leaf-label" x={s * 11} y={4} textAnchor={anchor}>
                      {fitText(l.label, labelRoom - Math.abs(l.x) - 15, LEAF_FONT)}
                    </text>
                  )}
                  {interactive && <rect className="hit" x={s > 0 ? -10 : -130} y={-11} width={140} height={22} />}
                </g>
              );
            })}
            <g className="branch-node" style={{ transform: `translate(${nx}px, ${ny}px)` }}>
              <g className="sprout">
                <Node r={7} score={b.score} />
              </g>
              {showLabels && (
                <text className="branch-label" x={s * 13} y={4} textAnchor={anchor}>
                  {fitText(b.label, labelRoom - G.REACH - 17, BRANCH_FONT)}
                </text>
              )}
            </g>
          </g>
        );
      })}
    </g>
  );
}

export const TreeSvg = memo(TreeSvgImpl);
