import { expect, it } from 'vitest';
import { resolveLocale } from './locale';
it('resolves exact, base and English fallback with either region separator', () => {
  expect(resolveLocale('gl-ES', ['en', 'gl', 'es'])).toBe('gl');
  expect(resolveLocale('es_AR', ['en', 'gl', 'es'])).toBe('es');
  expect(resolveLocale('unknown', ['en', 'gl', 'es'])).toBe('en');
  expect(resolveLocale('pt-BR', ['en', 'pt', 'pt_BR'])).toBe('pt_BR');
  expect(resolveLocale('PT_br', ['en', 'pt', 'pt_BR'])).toBe('pt_BR');
});
