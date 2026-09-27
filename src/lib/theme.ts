import type { ThemePreference } from './session';

// P17: the UI half of the theme. The pre-paint half is the inline script in
// index.html, which must stay in step with this function.
// Matches --color-surface in src/styles/tokens.css.
const THEME_COLOR = { light: '#f5f8fc', dark: '#16171d' } as const;

const DARK_QUERY = '(prefers-color-scheme: dark)';

export const resolveTheme = (pref: ThemePreference, systemDark: boolean): 'light' | 'dark' =>
  pref === 'system' ? (systemDark ? 'dark' : 'light') : pref;

export const applyTheme = (pref: ThemePreference): void => {
  const root = document.documentElement;
  if (pref === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', pref);
  const resolved = resolveTheme(pref, window.matchMedia(DARK_QUERY).matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[resolved]);
};

// Re-applies on OS theme changes, so `system` keeps the meta tag in step.
export const watchSystemTheme = (onChange: () => void): (() => void) => {
  const mq = window.matchMedia(DARK_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
};
