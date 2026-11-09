import { Fragment, type ReactNode } from 'react';

/** Tiny markdown subset: paragraphs, "- " lists, **bold**, *italic* / _italic_. */
function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if ((p.startsWith('*') && p.endsWith('*')) || (p.startsWith('_') && p.endsWith('_')))
      return <em key={i}>{p.slice(1, -1)}</em>;
    return <Fragment key={i}>{p}</Fragment>;
  });
}

export function Markdown({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <>
      {blocks.map((b, i) => {
        const lines = b.split('\n');
        const items = lines.filter((l) => l.startsWith('- '));
        if (items.length && items.length === lines.length - (lines[0].startsWith('- ') ? 0 : 1)) {
          const head = lines[0].startsWith('- ') ? null : lines[0];
          return (
            <Fragment key={i}>
              {head && <p>{inline(head)}</p>}
              <ul>
                {items.map((l, j) => (
                  <li key={j}>{inline(l.slice(2))}</li>
                ))}
              </ul>
            </Fragment>
          );
        }
        return <p key={i}>{inline(b)}</p>;
      })}
    </>
  );
}
