import { useId, useRef, useState } from 'react';
import { LANGUAGE_NAMES, UI_LOCALES, setLanguagePreference, t, useLanguagePreference, useLocale } from '../i18n';

export function LanguagePicker() {
  const locale = useLocale();
  const preference = useLanguagePreference();
  const [open, setOpen] = useState(false);
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const choose = (code: string) => {
    setLanguagePreference(code);
    setOpen(false);
    button.current?.focus();
  };
  return (
    <div className="language-control" onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }} onKeyDown={event => {
      if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); button.current?.focus(); }
    }}>
      <button ref={button} type="button" className="settings-button language-toggle" title={t('language.interface')}
        aria-label={t('language.interface')} aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
        <span aria-hidden="true">◎</span> {locale.toUpperCase()}
      </button>
      {open && <div id={id} className="language-options" role="group" aria-label={t('language.interface')}>
        {['auto', ...UI_LOCALES].map(code => <button key={code} type="button" aria-pressed={preference === code}
          onClick={() => choose(code)}>{code === 'auto' ? t('language.browser') : LANGUAGE_NAMES[code] ?? code}</button>)}
      </div>}
    </div>
  );
}
