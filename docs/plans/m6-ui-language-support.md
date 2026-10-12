# M6 — UI language support foundation

This first M6 slice adds automatic browser-language selection and a user-facing
language control. The bundled interface languages are English (`en`) and
Galician (`gl`). Browser preferences are checked in order, region subtags fall
back to their base language (`gl-ES` → `gl`), and unsupported languages fall
back to English. A saved choice takes priority; choosing “Follow browser” clears
that choice and resumes automatic selection.

The language control is the globe/code button beside the dark-mode button. The
preference is stored as `anonymaizer.uiLanguage`; the selected locale also sets
`<html lang>`. Catalogs live in `src/locales/<language>.json`, use the English
catalog as their source of truth, and are bundled locally at build time. Adding
a locale requires a complete matching key set and a display name in `src/i18n.ts`.
This keeps runtime switching offline and introduces no dependency.

UI language is independent of document language, jurisdiction, realistic-name
language, and model coverage. Those remain separate choices. The local detector
is a browser NLP model, not a generative LLM; language support for document
analysis must be measured per model and entity type before the interface claims
coverage. New document-language packs can therefore ship without translating
the interface, and interface translations do not imply detection support.

The existing Spanish and English legal-page links remain explicit legal-content
choices. The rest of the website and the app follow the interface preference.
