import { expect, it } from 'vitest';
import { resolveLocale, resolvePreferredLocale } from './locale';
it('resolves exact, base and English fallback with either region separator', () => {
  expect(resolveLocale('gl-ES', ['en', 'gl', 'es'])).toBe('gl');
  expect(resolveLocale('es_AR', ['en', 'gl', 'es'])).toBe('es');
  expect(resolveLocale('unknown', ['en', 'gl', 'es'])).toBe('en');
  expect(resolveLocale('pt-BR', ['en', 'pt', 'pt_BR'])).toBe('pt_BR');
  expect(resolveLocale('PT_br', ['en', 'pt', 'pt_BR'])).toBe('pt_BR');
});

it('tries browser preferences in order, including language-region fallbacks', () => {
  expect(resolvePreferredLocale(['fr-CA', 'gl-ES', 'en-GB'], ['en', 'gl'])).toBe('gl');
  expect(resolvePreferredLocale(['pt-BR', 'pt-PT'], ['en', 'pt_BR'])).toBe('pt_BR');
  expect(resolvePreferredLocale(['fr-FR', 'de-DE'], ['en', 'gl'])).toBe('en');
  expect(resolvePreferredLocale([], ['en', 'gl'], 'gl')).toBe('gl');
});
