import { Fragment, type ReactNode } from 'react';

/**
 * A tiny markdown subset (paragraphs, "- " lists, **bold**, *italic* / _italic_) where every run
 * of visible text goes through `seg(text, offset)`. The offset counts visible characters only,
 * so a veil, a decode sweep or word highlights can treat the answer as one continuous string.
 */
type Inline = { kind: 'text' | 'b' | 'i'; text: string; at: number };
type Block = { kind: 'p'; inl: Inline[] } | { kind: 'ul'; head: Inline[] | null; items: Inline[][] };

export function parseMd(text: string): { blocks: Block[]; total: number } {
  let at = 0;
  const inline = (s: string): Inline[] =>
    s
      .split(/(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/g)
      .filter(Boolean)
      .map((p) => {
        let kind: Inline['kind'] = 'text';
        let t = p;
        if (p.startsWith('**') && p.endsWith('**') && p.length > 4) {
          kind = 'b';
          t = p.slice(2, -2);
        } else if (p.length > 2 && ((p.startsWith('*') && p.endsWith('*')) || (p.startsWith('_') && p.endsWith('_')))) {
          kind = 'i';
          t = p.slice(1, -1);
        }
        const out = { kind, text: t, at };
        at += t.length;
        return out;
      });

  const blocks: Block[] = text.split(/\n{2,}/).map((b) => {
    const lines = b.split('\n');
    const items = lines.filter((l) => l.startsWith('- '));
    if (items.length && items.length === lines.length - (lines[0].startsWith('- ') ? 0 : 1)) {
      const head = lines[0].startsWith('- ') ? null : inline(lines[0]);
      return { kind: 'ul', head, items: items.map((l) => inline(l.slice(2))) };
    }
    return { kind: 'p', inl: inline(b.replace(/\n/g, ' ')) };
  });
  return { blocks, total: at };
}

export function Md({ text, seg, tail }: { text: string; seg?: (text: string, at: number) => ReactNode; tail?: ReactNode }) {
  const { blocks } = parseMd(text);
  const run = (inl: Inline[]) =>
    inl.map((x, i) => {
      const content = seg ? seg(x.text, x.at) : x.text;
      return x.kind === 'b' ? <b key={i}>{content}</b> : x.kind === 'i' ? <i key={i}>{content}</i> : <Fragment key={i}>{content}</Fragment>;
    });
  return (
    <>
      {blocks.map((b, i) => {
        const last = i === blocks.length - 1;
        if (b.kind === 'p')
          return (
            <p key={i}>
              {run(b.inl)}
              {last && tail}
            </p>
          );
        return (
          <Fragment key={i}>
            {b.head && <p>{run(b.head)}</p>}
            <ul>
              {b.items.map((it, j) => (
                <li key={j}>
                  {run(it)}
                  {last && j === b.items.length - 1 && tail}
                </li>
              ))}
            </ul>
          </Fragment>
        );
      })}
    </>
  );
}
