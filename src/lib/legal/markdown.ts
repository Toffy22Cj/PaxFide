// Ref: plan-fase7-fidelidad.md D-F17: los textos de Documentos/legal/ se publican "tal cual" en /terminos,
// /privacidad y /terminos-organizacion. D8 prohíbe una librería de Markdown: este es el subconjunto que esos tres
// archivos usan (títulos, párrafos, listas, tablas, citas, separadores, negrita y código), sin HTML crudo (nada se
// interpreta como HTML: el texto se pinta como texto). Lógica pura, probada sin DOM.

export type Inline = { kind: 'text' | 'strong' | 'code'; text: string };
export type Block =
  | { kind: 'heading'; level: 1 | 2 | 3; content: Inline[] }
  | { kind: 'paragraph'; content: Inline[] }
  | { kind: 'list'; ordered: boolean; items: Inline[][] }
  | { kind: 'table'; head: Inline[][]; rows: Inline[][][] }
  | { kind: 'quote'; content: Inline[] }
  | { kind: 'rule' };

/** `**negrita**` y `` `código` ``; lo demás, texto. Un marcador sin cerrar se queda como texto. */
export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let rest = src;
  const push = (kind: Inline['kind'], text: string) => {
    if (!text) return;
    const last = out[out.length - 1];
    if (kind === 'text' && last?.kind === 'text') last.text += text; else out.push({ kind, text });
  };
  while (rest.length > 0) {
    const m = /(\*\*([^*]+)\*\*|`([^`]+)`)/.exec(rest);
    if (!m) { push('text', rest); break; }
    push('text', rest.slice(0, m.index));
    if (m[2] !== undefined) push('strong', m[2]); else push('code', m[3]);
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

const cells = (line: string) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => parseInline(c.trim()));

export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) { blocks.push({ kind: 'heading', level: h[1].length as 1 | 2 | 3, content: parseInline(h[2].trim()) }); i++; continue; }
    if (/^-{3,}\s*$/.test(line)) { blocks.push({ kind: 'rule' }); i++; continue; }
    if (line.startsWith('>')) {
      const parts: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) { parts.push(lines[i].replace(/^>\s?/, '')); i++; }
      blocks.push({ kind: 'quote', content: parseInline(parts.join(' ').trim()) });
      continue;
    }
    if (line.trim().startsWith('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1])) {
      const head = cells(line);
      i += 2;
      const rows: Inline[][][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(cells(lines[i])); i++; }
      blocks.push({ kind: 'table', head, rows });
      continue;
    }
    const li = /^\s*(?:([-*])|(\d+)\.)\s+(.*)$/.exec(line);
    if (li) {
      const ordered = li[2] !== undefined;
      const items: Inline[][] = [];
      while (i < lines.length) {
        const m = /^\s*(?:([-*])|(\d+)\.)\s+(.*)$/.exec(lines[i]);
        if (!m || (m[2] !== undefined) !== ordered) break;
        items.push(parseInline(m[3].trim()));
        i++;
      }
      blocks.push({ kind: 'list', ordered, items });
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|>|-{3,}\s*$|\s*\||\s*(?:[-*]|\d+\.)\s)/.test(lines[i])) {
      para.push(lines[i].trim());
      i++;
    }
    blocks.push({ kind: 'paragraph', content: parseInline(para.join(' ')) });
  }
  return blocks;
}

/** La versión del texto, tal como la escribe la cabecera ("**Versión:** `v1-2026-10`"). */
export function legalVersion(src: string): string | null {
  const m = /\*\*Versión:\*\*\s*`([^`]+)`/.exec(src);
  return m ? m[1] : null;
}
