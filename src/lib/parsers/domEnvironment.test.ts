import { describe, expect, it } from 'vitest';

// Guards the vitest.config.ts project split, not any parser: everything
// under src/lib/parsers/ runs in a DOM environment because .odt/.pptx/.eml
// parse with the native DOMParser, while src/core/** stays on `node` so a
// DOM global creeping into pure code still fails the suite (CLAUDE.md rule
// 4). If this test ever fails, the split has been lost and the format
// sessions from P8d on will fail for a reason that looks like a parser bug.
describe('src/lib/parsers test environment', () => {
  it('has a DOM', () => {
    expect(typeof DOMParser).toBe('function');
    const doc = new DOMParser().parseFromString('<p>hi</p>', 'text/html');
    expect(doc.querySelector('p')?.textContent).toBe('hi');
  });
});
