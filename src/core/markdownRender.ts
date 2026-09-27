import { Marked, type Token, type Tokens } from 'marked';

// Restore views: the AI's reply is almost always Markdown, so the restored
// text can be shown as-is (Markdown), rendered (HTML) or flattened (plain
// text). Pure — the HTML is NOT sanitized here; the UI must run it through
// DOMPurify before it touches the DOM.

export type RestoreFormat = 'plain' | 'markdown' | 'html';

// A private instance, so no other code's marked.use() can change the output.
const md = new Marked({ gfm: true, breaks: false });

/** Markdown -> HTML string. Unsanitized. */
export const markdownToHtml = (markdown: string): string => md.parse(markdown, { async: false });

const inline = (tokens: Token[] | undefined): string => (tokens ?? []).map(inlineText).join('');

const inlineText = (t: Token): string => {
  switch (t.type) {
    case 'link': {
      const text = inline((t as Tokens.Link).tokens);
      const { href } = t as Tokens.Link;
      return text && text !== href ? `${text} (${href})` : href;
    }
    case 'image':
      return (t as Tokens.Image).text;
    case 'br':
      return '\n';
    case 'codespan':
      return (t as Tokens.Codespan).text;
    case 'html':
      return '';
    default:
      return 'tokens' in t && t.tokens ? inline(t.tokens) : 'text' in t ? String(t.text) : t.raw;
  }
};

const block = (t: Token, indent = ''): string | null => {
  switch (t.type) {
    case 'space':
    case 'hr':
      return null;
    case 'heading':
    case 'paragraph':
      return indent + inline((t as Tokens.Paragraph).tokens);
    case 'text':
      return indent + ('tokens' in t && t.tokens ? inline(t.tokens) : (t as Tokens.Text).text);
    case 'code':
      return (t as Tokens.Code).text;
    case 'blockquote':
      return blocks((t as Tokens.Blockquote).tokens, indent);
    case 'list': {
      const list = t as Tokens.List;
      const start = typeof list.start === 'number' ? list.start : 1;
      return list.items
        .map((item, i) => {
          const marker = list.ordered ? `${start + i}. ` : '• ';
          const body = item.tokens.map((c) => block(c, '')).filter((s) => s !== null).join('\n');
          const [first, ...rest] = body.split('\n');
          const pad = ' '.repeat(marker.length);
          return [indent + marker + first, ...rest.map((l) => indent + pad + l)].join('\n');
        })
        .join('\n');
    }
    case 'table': {
      const table = t as Tokens.Table;
      const row = (cells: Tokens.TableCell[]) => indent + cells.map((c) => inline(c.tokens)).join('\t');
      return [row(table.header), ...table.rows.map(row)].join('\n');
    }
    case 'html':
      return null;
    default:
      return indent + inlineText(t);
  }
};

const blocks = (tokens: Token[], indent = ''): string =>
  tokens
    .map((t) => block(t, indent))
    .filter((s): s is string => s !== null && s !== '')
    .join('\n\n');

/** Markdown -> readable plain text: no #, **, backticks or link syntax; lists keep bullets, tables become tab-separated rows. */
export const markdownToPlainText = (markdown: string): string => blocks(md.lexer(markdown));
