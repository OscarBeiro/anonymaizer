import { Marked, type Token, type Tokens } from 'marked';
import { restoreText, type RestoreOptions } from './reverse';
import type { MappingItem } from './types';

const parser = new Marked({ gfm: true, breaks: false });
const escape = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
// Entity encoding prevents inserted values from becoming Markdown constructs,
// table delimiters, links or code fences on a subsequent parse.
const literalMarkdown = (s: string): string => Array.from(s).map(c => /[\w \p{L}\p{N}]/u.test(c) ? c : `&#${c.codePointAt(0)};`).join('');
interface Fragment { html: string; markdown: string; plain: string }
const join = (f: Fragment[], separator = ''): Fragment => ({ html: f.map(x => x.html).join(separator), markdown: f.map(x => x.markdown).join(separator), plain: f.map(x => x.plain).join(separator) });

/** GFM headings, paragraphs, nested lists, rectangular tables and code.
 * Links/images become inert labels; raw HTML is literal text. No renderer can
 * create a resource URL. Originals are inserted only into parsed text nodes. */
export const structuredDocument = (source: string, mappings: readonly MappingItem[] = [], options: RestoreOptions = {}): Fragment & { warnings: string[] } => {
  const warnings = new Set<string>();
  const literal = (encoded: string): Fragment => {
    const text = encoded.replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n: string) => { const cp = n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n); return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : '\ufffd'; }).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
    const exact = restoreText(text, mappings, options);
    // Keep original Markdown delimiters out of serialization by processing each
    // matched token at this leaf, rather than escaping the whole restored result.
    const markdown = encoded.replace(/\[{1,2}[^\][\r\n]{1,200}\]{1,2}/gu, candidate => {
      const restored = restoreText(candidate, mappings, options);
      return restored.report.restoredOccurrences ? literalMarkdown(restored.text) : candidate;
    });
    return { html: escape(exact.text).replace(/\n/g, '<br>'), markdown, plain: exact.text };
  };
  const inlines = (tokens: Token[] = []): Fragment => join(tokens.map(inline));
  const inline = (t: Token): Fragment => {
    if (t.type === 'link' || t.type === 'image') {
      warnings.add('Links and images were converted to inert text; destinations were omitted.');
      return t.type === 'link' ? inlines((t as Tokens.Link).tokens) : literal((t as Tokens.Image).text);
    }
    if (t.type === 'html') {
      warnings.add('Raw HTML was converted to literal text.');
      const text = (t as Tokens.HTML).text;
      return { html: escape(text), markdown: literalMarkdown(text), plain: text };
    }
    if (t.type === 'br') return { html: '<br>', markdown: '  \n', plain: '\n' };
    if (t.type === 'strong' || t.type === 'em' || t.type === 'del') {
      const f = inlines((t as Tokens.Strong).tokens);
      const tag = t.type === 'strong' ? 'strong' : t.type === 'em' ? 'em' : 'del';
      const marker = t.type === 'strong' ? '**' : t.type === 'em' ? '*' : '~~';
      return { html: `<${tag}>${f.html}</${tag}>`, markdown: `${marker}${f.markdown}${marker}`, plain: f.plain };
    }
    if (t.type === 'codespan') {
      const text = restoreText((t as Tokens.Codespan).text, mappings, options).text;
      // Encode as plain literal Markdown if a code node cannot represent the
      // original without normalizing spaces/newlines.
      return { html: `<code>${escape(text)}</code>`, markdown: literalMarkdown(text), plain: text };
    }
    if ('tokens' in t && t.tokens) return inlines(t.tokens);
    return literal('text' in t ? String(t.text) : t.raw);
  };
  const blocks = (tokens: Token[]): Fragment => join(tokens.map(block), '\n\n');
  const block = (t: Token): Fragment => {
    switch (t.type) {
      case 'space': return { html: '', markdown: '', plain: '' };
      case 'hr': return { html: '<hr>', markdown: '---', plain: '' };
      case 'heading': {
        const h = t as Tokens.Heading; const f = inlines(h.tokens);
        return { html: `<h${h.depth}>${f.html}</h${h.depth}>`, markdown: `${'#'.repeat(h.depth)} ${f.markdown}`, plain: f.plain };
      }
      case 'paragraph': { const f = inlines((t as Tokens.Paragraph).tokens); return { ...f, html: `<p>${f.html}</p>` }; }
      case 'text': return inline(t);
      case 'html': return inline(t);
      case 'code': {
        const text = restoreText((t as Tokens.Code).text, mappings, options).text;
        const fence = '`'.repeat(Math.max(3, ...[...text.matchAll(/`+/g)].map(m => m[0].length + 1)));
        return { html: `<pre><code>${escape(text)}</code></pre>`, markdown: `${fence}\n${text}\n${fence}`, plain: text };
      }
      case 'blockquote': {
        const f = blocks((t as Tokens.Blockquote).tokens);
        return { html: `<blockquote>${f.html}</blockquote>`, markdown: f.markdown.split('\n').map(l => '> ' + l).join('\n'), plain: f.plain };
      }
      case 'list': {
        const list = t as Tokens.List; const children = list.items.map(i => blocks(i.tokens));
        const start = typeof list.start === 'number' ? list.start : 1;
        const tag = list.ordered ? 'ol' : 'ul';
        const items = children.map((f, i) => {
          const marker = list.ordered ? `${start + i}. ` : '- ';
          return f.markdown.split('\n').map((l, j) => (j ? ' '.repeat(marker.length) : marker) + l).join('\n');
        });
        return { html: `<${tag}${list.ordered ? ` start="${start}"` : ''}>${children.map(f => `<li>${f.html}</li>`).join('')}</${tag}>`, markdown: items.join('\n'), plain: children.map(f => '• ' + f.plain).join('\n') };
      }
      case 'table': {
        const table = t as Tokens.Table;
        const header = table.header.map(c => inlines(c.tokens));
        const rows = table.rows.map(row => row.map(c => inlines(c.tokens)));
        const rowMd = (row: Fragment[]) => '| ' + row.map(c => c.markdown.replace(/\|/g, '&#124;').replace(/\n/g, '&#10;')).join(' | ') + ' |';
        return {
          html: `<table><thead><tr>${header.map(c => `<th>${c.html}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(c => `<td>${c.html}</td>`).join('')}</tr>`).join('')}</tbody></table>`,
          markdown: [rowMd(header), '| ' + header.map(() => '---').join(' | ') + ' |', ...rows.map(rowMd)].join('\n'),
          plain: [header, ...rows].map(row => row.map(c => c.plain).join('\t')).join('\n'),
        };
      }
      default: warnings.add(`Unsupported Markdown construct: ${t.type}. Converted to text.`); return literal(t.raw);
    }
  };
  const result = blocks(parser.lexer(source));
  return { ...result, warnings: [...warnings] };
};
