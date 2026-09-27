import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LEGAL_PLACEHOLDERS } from './meta';

// The list is what the drafter works through before launch; a placeholder
// missing from it would ship unfilled.
describe('LEGAL_PLACEHOLDERS', () => {
  it('lists every {{PLACEHOLDER}} used in the legal texts and site.ts', () => {
    const dir = join(__dirname);
    const files = [
      ...readdirSync(dir)
        .filter((f) => f.endsWith('.tsx'))
        .map((f) => join(dir, f)),
      join(dir, '..', 'site.ts'),
    ];
    const used = new Set(files.flatMap((f) => readFileSync(f, 'utf8').match(/\{\{[A-Z0-9_]+\}\}/g) ?? []));
    expect([...used].sort()).toEqual([...LEGAL_PLACEHOLDERS].sort());
  });
});
