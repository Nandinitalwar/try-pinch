import { Fragment, type ReactNode } from 'react';

/**
 * Just enough markdown for canned answers: ### headings, "- "/"1. " lists,
 * **bold**, *italic*, blank-line paragraphs. Rendering mid-stream means we get
 * handed partial syntax constantly, so every branch has to tolerate a half-
 * written line rather than throwing or flashing raw asterisks.
 */
function inline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      m[1] ? (
        <strong key={`${keyPrefix}-b${i}`}>{m[1]}</strong>
      ) : (
        <em key={`${keyPrefix}-i${i}`}>{m[2]}</em>
      ),
    );
    last = m.index + m[0].length;
    i++;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.split('\n');
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];
  let key = 0;

  const flushPara = () => {
    if (!para.length) return;
    blocks.push(<p key={`p${key++}`}>{inline(para.join(' '), `p${key}`)}</p>);
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const items = list.items.map((it, i) => <li key={i}>{inline(it, `l${key}-${i}`)}</li>);
    blocks.push(
      list.ordered ? <ol key={`l${key++}`}>{items}</ol> : <ul key={`l${key++}`}>{items}</ul>,
    );
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushPara();
      flushList();
      continue;
    }
    if (line.startsWith('### ')) {
      flushPara();
      flushList();
      blocks.push(<h3 key={`h${key++}`}>{inline(line.slice(4), `h${key}`)}</h3>);
      continue;
    }
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    const numbered = /^(\d+)\.\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      flushPara();
      const ordered = Boolean(numbered);
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push((bullet ? bullet[1] : numbered![2]) ?? '');
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara();
  flushList();

  return <Fragment>{blocks}</Fragment>;
}
