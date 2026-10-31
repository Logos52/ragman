/**
 * "Patch notes" in the top bar: opens CHANGELOG.md (bundled as text at build time) in a modal. The changelog is
 * plain Markdown with only headings, bullets and paragraphs, rendered here without a Markdown library.
 */
import { useState } from 'react';
import { Modal } from '../primitives/Modal';
import notes from '../../../CHANGELOG.md?raw';
import './PatchNotes.css';

type Block = { kind: 'h1' | 'h2' | 'p'; text: string } | { kind: 'ul'; items: string[] };

/** Headings (#, ##), bullets (- ), paragraphs; blank lines separate blocks. */
export function parseNotes(md: string): Block[] {
  const out: Block[] = [];
  let para: string[] = [];
  const flush = () => { if (para.length) { out.push({ kind: 'p', text: para.join(' ') }); para = []; } };
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line.trim()) { flush(); continue; }
    if (line.startsWith('## ')) { flush(); out.push({ kind: 'h2', text: line.slice(3).trim() }); continue; }
    if (line.startsWith('# ')) { flush(); out.push({ kind: 'h1', text: line.slice(2).trim() }); continue; }
    if (line.startsWith('- ')) {
      flush();
      const last = out[out.length - 1];
      if (last?.kind === 'ul') last.items.push(line.slice(2).trim());
      else out.push({ kind: 'ul', items: [line.slice(2).trim()] });
      continue;
    }
    para.push(line.trim());
  }
  flush();
  return out;
}

export function PatchNotesButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="rg-notes__btn" onClick={() => setOpen(true)}>Patch notes</button>
      {open ? (
        <Modal onClose={() => setOpen(false)} width={640} label="Patch notes">
          <article className="rg-notes">
            {parseNotes(notes).map((b, i) => {
              if (b.kind === 'h1') return <h1 key={i}>{b.text}</h1>;
              if (b.kind === 'h2') return <h2 key={i}>{b.text}</h2>;
              if (b.kind === 'ul') return <ul key={i}>{b.items.map((t, j) => <li key={j}>{t}</li>)}</ul>;
              return <p key={i}>{b.text}</p>;
            })}
          </article>
        </Modal>
      ) : null}
    </>
  );
}
