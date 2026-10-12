import { describe, expect, it } from 'vitest';
import type { MappingSession } from '../types';
import { buildExport, exportFileStem } from './textExport';

const session = (over: Partial<MappingSession> = {}): MappingSession => ({
  sessionId: 'abcdef12-3456-7890',
  createdAt: '2026-09-26T00:00:00Z',
  inputType: 'PASTE',
  originalFormat: 'raw_text',
  mappings: [],
  rawMarkdown: '',
  anonymizedMarkdown: '',
  ...over,
});

describe('exportFileStem', () => {
  it('uses a neutral stem for identifying source filenames', () => {
    expect(exportFileStem(session({ inputType: 'FILE', fileName: 'Contrato final.v2.docx' }))).toBe('anonymaizer');
  });

  it('falls back to a session-id prefix for pasted text', () => {
    expect(exportFileStem(session())).toBe('anonymaizer');
  });
});

describe('buildExport', () => {
  const text = 'Hola [[NAME_001]] <b> & "quoted" \'single\'\n\n| a | b |';

  it('returns txt with the input bytes unchanged', () => {
    const out = buildExport('txt', text, session({ inputType: 'FILE', fileName: 'x.docx' }), 'sanitized');
    expect(out).toEqual({ fileName: 'anonymaizer-sanitized.txt', mimeType: 'text/plain;charset=utf-8', content: text });
  });

  it('returns md with the input bytes unchanged', () => {
    const out = buildExport('md', text, session(), 'restored');
    expect(out.fileName).toBe('anonymaizer-restored.md');
    expect(out.content).toContain('&#60;b&#62;');
    expect(out.content).not.toContain('<b>');
  });

  it('escapes <, &, and quotes in html', () => {
    const out = buildExport('html', '<b> & "q" \'s\'', session(), 'restored');
    expect(out.fileName).toBe('anonymaizer-restored.html');
    expect(out.mimeType).toBe('text/html;charset=utf-8');
    expect(out.content).toContain('&lt;b&gt; &amp; &quot;q&quot; &#39;s&#39;');
    expect(out.content).not.toContain('<b>');
  });

  it('emits a standalone document with no external references', () => {
    const { content } = buildExport('html', 'x', session(), 'sanitized');
    expect(content.startsWith('<!doctype html>')).toBe(true);
    expect(content).toContain('<style>');
    expect(content).not.toMatch(/https?:|<link|<script|src=/);
  });

  it('marks every placeholder and nothing else when highlighting', () => {
    const { content } = buildExport('html', 'A [[NAME_001]] b [[EMAIL_002]] [[not]] [x]', session(), 'sanitized', {
      highlight: true,
    });
    const marks = [...content.matchAll(/<mark>(.*?)<\/mark>/g)].map((m) => m[1]);
    expect(marks).toEqual(['[[NAME_001]]', '[[EMAIL_002]]']);
  });

  it('does not mark placeholders without the highlight flag', () => {
    const { content } = buildExport('html', 'A [[NAME_001]]', session(), 'restored');
    expect(content).not.toContain('<mark>');
  });
});
