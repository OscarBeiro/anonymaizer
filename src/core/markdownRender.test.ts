import { describe, expect, it } from 'vitest';
import { markdownToHtml, markdownToPlainText } from './markdownRender';

describe('markdownToPlainText', () => {
  it('drops heading and emphasis markers', () => {
    expect(markdownToPlainText('# Summary\n\nDear **María García**, _thanks_ for `2024-118`.')).toBe(
      'Summary\n\nDear María García, thanks for 2024-118.',
    );
  });

  it('keeps list structure with bullets and numbers', () => {
    expect(markdownToPlainText('- one\n- two')).toBe('• one\n• two');
    expect(markdownToPlainText('3. a\n4. b')).toBe('3. a\n4. b');
  });

  it('indents nested list items', () => {
    expect(markdownToPlainText('- a\n  - b')).toBe('• a\n  • b');
  });

  it('writes links as text (url)', () => {
    expect(markdownToPlainText('See [the site](https://example.com).')).toBe('See the site (https://example.com).');
    expect(markdownToPlainText('<https://example.com>')).toBe('https://example.com');
  });

  it('turns tables into tab-separated rows', () => {
    expect(markdownToPlainText('| Name | Amount |\n|---|---|\n| Ana | 10 € |')).toBe('Name\tAmount\nAna\t10 €');
  });

  it('keeps code blocks verbatim and drops raw HTML', () => {
    expect(markdownToPlainText('```\nx = **1**\n```')).toBe('x = **1**');
    expect(markdownToPlainText('<div>hi</div>\n\ntext')).toBe('text');
  });

  it('leaves plain text alone', () => {
    expect(markdownToPlainText('Just a line.\n\nAnother.')).toBe('Just a line.\n\nAnother.');
  });

  it('keeps entities decoded', () => {
    expect(markdownToPlainText('Smith & Sons <x>')).not.toContain('&amp;');
  });
});

describe('markdownToHtml', () => {
  it('renders GFM', () => {
    const html = markdownToHtml('# T\n\n**b**\n\n| a |\n|---|\n| 1 |');
    expect(html).toContain('<h1>T</h1>');
    expect(html).toContain('<strong>b</strong>');
    expect(html).toContain('<table>');
  });
});
