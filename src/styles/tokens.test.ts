import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// S5: the TICGAL palette must stay WCAG AA. Reads the token blocks straight
// from tokens.css so a palette edit can't regress contrast unnoticed.
const css = readFileSync(join(__dirname, 'tokens.css'), 'utf8');

const block = (selector: string): Record<string, string> => {
  const start = css.indexOf(selector);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  return Object.fromEntries([...body.matchAll(/(--color-[\w-]+):\s*(#[0-9a-f]{3,6})\b/gi)].map((m) => [m[1], m[2]]));
};

const luminance = (hex: string): number => {
  const full = hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex;
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: string, b: string): number => {
  const [lo, hi] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (hi + 0.05) / (lo + 0.05);
};

const themes = { light: block(':root {'), dark: block(":root[data-theme='dark']") };

describe.each(Object.entries(themes))('%s theme tokens', (_, t) => {
  it.each(['--color-text', '--color-text-muted', '--color-accent'])('%s is AA on every surface', (token) => {
    for (const surface of ['--color-surface', '--color-surface-raised', '--color-surface-sunken']) {
      expect(contrast(t[token], t[surface])).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('button labels are AA on the accent', () => {
    expect(contrast(t['--color-on-accent'], t['--color-accent'])).toBeGreaterThanOrEqual(4.5);
  });
});

it('the light theme carries TICGAL Azul as the brand colour', () => {
  expect(themes.light['--color-brand']).toBe('#658bc5');
});
