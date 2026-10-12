import { t } from '../i18n';
import type { ThemePreference } from '../lib/session';

const OPTIONS: () => { value: ThemePreference; label: string }[] = () => ([
  { value: 'light', label: t('ThemeControl.light') },
  { value: 'dark', label: t('ThemeControl.dark') },
  { value: 'system', label: t('ThemeControl.system') },
]);

interface ThemeControlProps {
  theme: ThemePreference;
  onChange: (theme: ThemePreference) => void;
}

// P17: the three-state theme switch, a radio group styled as a segmented control.
export function ThemeControl({ theme, onChange }: ThemeControlProps) {
  return (
    <div className="segmented" role="radiogroup" aria-label={t('ThemeControl.theme')}>
      {OPTIONS().map((o) => (
        <label key={o.value} className={theme === o.value ? 'segmented-option is-active' : 'segmented-option'}>
          <input
            type="radio"
            name="theme"
            value={o.value}
            checked={theme === o.value}
            onChange={() => onChange(o.value)}
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}
