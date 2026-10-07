import { describe, expect, it } from 'vitest';
import { matchRoute } from './router';

describe('matchRoute', () => {
  it('maps the five paths', () => {
    expect(matchRoute('/')).toBe('landing');
    expect(matchRoute('/app')).toBe('app');
    expect(matchRoute('/privacy')).toBe('privacy');
    expect(matchRoute('/cookies')).toBe('cookies');
    expect(matchRoute('/terms')).toBe('terms');
  });

  it('tolerates a trailing slash and index.html', () => {
    expect(matchRoute('/app/')).toBe('app');
    expect(matchRoute('/index.html')).toBe('landing');
  });

  it('sends unknown paths to the landing', () => {
    expect(matchRoute('/nope')).toBe('landing');
    expect(matchRoute('/app/extra')).toBe('landing');
  });
});
