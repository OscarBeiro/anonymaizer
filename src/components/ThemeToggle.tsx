import type { ThemePreference } from '../lib/session';
import { resolveTheme } from '../lib/theme';

interface ThemeToggleProps {
  theme: ThemePreference;
  onChange: (theme: ThemePreference) => void;
}

// One-click light/dark switch for the headers. It flips whatever is showing
// now (resolving `system`); Settings keeps the three-state control to go back
// to following the OS.
export function ThemeToggle({ theme, onChange }: ThemeToggleProps) {
  const current = resolveTheme(theme, window.matchMedia('(prefers-color-scheme: dark)').matches);
  const next = current === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      className="settings-button theme-toggle"
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      onClick={() => onChange(next)}
    >
      <span aria-hidden="true">{current === 'dark' ? '☀' : '☾'}</span>
    </button>
  );
}
