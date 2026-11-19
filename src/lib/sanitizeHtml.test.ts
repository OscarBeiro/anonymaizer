import { describe, expect, it } from 'vitest';
import { markdownToHtml } from '../core/markdownRender';
import { sanitizeRenderedHtml } from './sanitizeHtml';

const render = (markdown: string): string => sanitizeRenderedHtml(markdownToHtml(markdown));

describe('sanitizeRenderedHtml', () => {
  it('drops a Markdown image and keeps its alt text', () => {
    const html = render('Hola ![logo de Marta](https://evil.example/p.png?q=Marta%20Souto) fin');
    expect(html).not.toMatch(/<img|evil\.example|src=/i);
    expect(html).toContain('logo de Marta');
  });

  it.each([
    '<img src="https://evil.example/a.png">',
    '<img srcset="https://evil.example/a.png 2x">',
    '<picture><source srcset="https://evil.example/a.png"><img src="x"></picture>',
    '<video poster="https://evil.example/a.png" src="https://evil.example/v.mp4"></video>',
    '<audio src="https://evil.example/a.mp3"></audio>',
    '<iframe src="https://evil.example/"></iframe>',
    '<object data="https://evil.example/"></object>',
    '<style>p{background:url(https://evil.example/a.png)}</style>',
    '<p style="background:url(https://evil.example/a.png)">x</p>',
    '<table background="https://evil.example/a.png"><tr><td>x</td></tr></table>',
    '<svg><image href="https://evil.example/a.png"/></svg>',
    '<link rel="stylesheet" href="https://evil.example/a.css">',
    '<form action="https://evil.example/"><input type="image" src="https://evil.example/a.png"></form>',
    '<a href="https://ok.example/" ping="https://evil.example/">x</a>',
    '<script src="https://evil.example/a.js"></script>',
  ])('leaves nothing that loads a resource in %s', (raw) => {
    expect(sanitizeRenderedHtml(raw)).not.toMatch(/evil\.example/);
  });

  it('keeps ordinary formatting and links', () => {
    const html = render('# Título\n\nUn **texto** con [enlace](https://example.org/a) y `código`.\n\n| a | b |\n| - | - |\n| 1 | 2 |');
    expect(html).toContain('<h1>Título</h1>');
    expect(html).toContain('<strong>texto</strong>');
    expect(html).toContain('<a href="https://example.org/a">enlace</a>');
    expect(html).toContain('<code>código</code>');
    expect(html).toContain('<td>1</td>');
  });
});
