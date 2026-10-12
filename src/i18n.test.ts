import { expect, it } from 'vitest';
import en from './locales/en.json';
import gl from './locales/gl.json';

it('keeps every shipped locale complete and interpolation placeholders aligned', () => {
  expect(Object.keys(gl).sort()).toEqual(Object.keys(en).sort());
  for (const key of Object.keys(en)) {
    const placeholders = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
    expect(placeholders(gl[key as keyof typeof gl])).toEqual(placeholders(en[key as keyof typeof en]));
  }
});
