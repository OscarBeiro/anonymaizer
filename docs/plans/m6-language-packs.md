# Milestone 6 — Languages: i18n and detection packs

Planned 2026-09-27. Detection is hardcoded Spanish (plus some English):
`detectDni`/`detectNie` always run (`src/core/detectors.ts`), and
`NAME_STOPWORDS`, `COMPANY_PREFIXES`, the shields and `data/es/pseudonyms.ts`
are all Spanish. Adding languages causes two problems. First, Spanish-only
rules fire on foreign text: an 8-digit+letter token in a Portuguese document
gets labelled `DNI`. Second, other countries' IDs (PT NIF, IT codice fiscale,
FR NIR, UK NINO…) are missed.

This milestone replaces the backlog item "Per-language/country NAME_STOPWORDS
packs" in [`anonymaizer-plan.md`](anonymaizer-plan.md). It also takes `P14`
and `P15` from M4b: the setup step needs `t()`, and the UI locale and the packs
share one language-code resolver. `P15` (Localazy) runs any time after `P14`.

## Design decisions

- **Detection suggests, never decides.** The detected language pre-ticks
  packs. The user confirms or pins them. Short texts (fewer than ~20 words) are
  "undetermined" and fall back to the user's pinned packs, then the UI locale.
- **Language ≠ jurisdiction.** *Language packs* follow the text: stopwords,
  greetings, days/months, name particles, company/institution prefixes, shield
  lexicon, pseudonyms. *Jurisdiction packs* follow where the people are: ID
  formats + checksums, phone formats, address cues. Spanish text may be from
  Mexico (CURP, not DNI), and a Galician document uses Spanish IDs.
- **Several packs at once.** Multilingual documents are common, and a missed
  ID is worse than a false positive. Active set = detected languages ∪ pinned
  packs, never one exclusive pack.
- **Checksummed IDs stay broad.** DNI mod-23, IBAN mod-97 and Luhn rarely
  collide across countries. Gating matters most for unvalidated heuristics
  (`INVALID_ID`, names, stopwords, addresses).
- **One language-code set** for UI locales, packs and `langDetect`: plain
  codes (`es`, `gl`, `pt`, `en`), resolved exact → base → `en` (the P14
  decision).
- **No dependency for language detection.** It scores the text against the
  packs' own data. `franc-min` is the fallback only if es/gl/pt accuracy is
  poor, and it must be vetted against hard rule 3 first.

---

### [ ] P14 — Extract strings + i18n layer

Moved here from M4b (2026-09-27; the full text moved with it on 2026-10-07).
Extra constraint: export the locale resolver from a pure module so `P24`–`P26`
reuse it rather than duplicating it.

**Decided — plain language codes, not region-qualified.** Locale files are `en`,
`es`, `gl`, `pt`, not `en_GB`/`gl_ES`. Region variants double the translation
work for near-identical text, and `gl` has no second region to disambiguate
against. Add a region code only where the content genuinely diverges — `pt_BR`
vs `pt_PT` is the one likely split, and it can be added later as a new file with
no restructuring. This costs nothing to defer.

That makes the resolver the load-bearing part: browsers report `gl-ES`,
`en-GB`, `es-AR`, so lookup falls back exact locale → base language → `en`. It
must handle both filename shapes from day one, because the day `pt_BR` lands the
directory holds a mix.

Layout:

```
src/locales/en.json     # source of truth, hand-edited
src/locales/<lang>.json # written by Localazy, committed via PR
src/i18n.ts             # t(), language detection, persisted to localStorage
```

Keys grouped by component (`review.title`, `rules.addRule`) — maps straight onto
Localazy's JSON format and keeps the file navigable.

> Add `src/i18n.ts` exposing `t(key, params?)` over `src/locales/en.json`, loading
> locale files with `import.meta.glob('./locales/*.json', { eager: true })` — no
> new dependency, no network. Language comes from a persisted user choice falling
> back to `navigator.language`, resolved exact locale → base language → `en`
> (`gl-ES` → `gl.json`), with a picker in the UI. Locale files are named by plain
> language code; the resolver must also accept region-qualified filenames such as
> `pt_BR.json`. Move every hardcoded user-facing string in `src/App.tsx` and
> `src/components/` into `en.json` — including everything M4a and P12/P13 added.
> Audit `src/core/` for user-facing text and convert it to codes the UI
> translates; core stays pure (hard rule 4) and gets no i18n import. Add tests
> for the fallback chain (`gl-ES` → `gl`, unknown language → `en`,
> region-qualified file preferred over its base when both exist) and that
> `en.json` has no duplicate or unused keys.

### [ ] P15 — Localazy sync through GitHub Actions

Moved here from M4b (2026-10-07). Runs any time after `P14`.

**Decided:** the official Localazy GitHub Actions with repository secrets — not
the CLI in a hand-rolled step, not a local developer sync.

> Add `localazy.json` at the repo root: upload `src/locales/en.json` as source
> (`type: json`, `lang: en`), download to `src/locales/${lang}.json` —
> `${lang}` deliberately, not `${locale}`, per the P14 decision. Add
> `.github/workflows/localazy-upload.yml` — on push to `main` touching
> `src/locales/en.json`, run `localazy/upload@v1` with `LOCALAZY_WRITE_KEY`. Add
> `.github/workflows/localazy-download.yml` — `workflow_dispatch` + schedule, run
> `localazy/download@v1` with `LOCALAZY_READ_KEY`, then open a PR with
> `peter-evans/create-pull-request` so translations pass `npm run build` and
> `npm test` before landing. Add a test asserting every `src/locales/*.json` has
> the same key set as `en.json`, so a half-translated language cannot ship blank
> UI.

Both keys are GitHub Actions secrets (`LOCALAZY_WRITE_KEY`, `LOCALAZY_READ_KEY`),
taken from the Localazy project's Integrations page after `localazy init`.
P15 depends on P14 — there is nothing to upload until `en.json` exists.

### [ ] P23 — Pack scaffold, no behaviour change

> Add `src/core/packs/` with `LanguagePack` (`id`, `stopwords`, `greetings`,
> `nameParticles`, `companyPrefixes`, `shieldLexicon`, `profileWords`) and
> `JurisdictionPack` (`id`, `defaultLanguages`, `detectors: { category,
> detect(text) }[]`). Move the current hardcoded lists out of `detectors.ts`
> into `es`, `en` and `ES` packs. Move `src/core/data/es/pseudonyms.ts` under
> the ES pack, keeping the `data/<lang>/<purpose>.ts` convention. Define
> `DEFAULT_PROFILE = { languages: ['es', 'en'], jurisdictions: ['ES'] }`. The
> gate for this session: every existing test passes untouched.

### [ ] P24 — `langDetect`

> Tests first. `src/core/langDetect.ts` scores text against each pack's
> `profileWords` (high-frequency function words) plus character hints (`ñ`,
> `ção`, `ß`). It returns a ranked `{ lang, score }[]` for the whole document
> and for each paragraph. Test samples: es, en, pt, gl, fr, it, a mixed es+pt
> document (both reported), and short text (undetermined). The es/gl/pt split
> is the hard case: `xa`, `non`, `unha`, `-ción` vs `-ção`.

### [ ] P25 — Profile-gated detection pipeline

> `runAllDetectors(text, settings, profile = DEFAULT_PROFILE)` (and
> `anonymize`/`anonymizeWithNer`) iterates the active packs' detectors. The
> existing `gated()` category filter stays on top: `CategorySettings` still
> switches categories, and packs decide which detectors exist. Each span
> records the pack that produced it. Tests: with a PT-only profile, no
> `INVALID_ID`/name heuristics from ES; the default profile gives today's
> output.

### [ ] P26 — "Language & region" setup step

> Show the detected languages as pre-ticked chips ("Detected: Spanish 92%,
> Portuguese 8%"). Default the jurisdiction checkboxes from `defaultLanguages`,
> and let the user pin packs. A jurisdiction pack carries a category preset
> (ES turns on DNI/NIE; PT turns on NIF/CC). Persist the pinned choice the same
> way `parseCategorySettings` does. All strings go through `t()`.

### [ ] P27 — Galician language pack

> A language pack only. The IDs are Spanish, so the ES jurisdiction stays on:
> this plan shows that language and jurisdiction are separate. Data:
> stopwords/greetings (`Estimado/a`, `Atentamente`, `Saúdos`), days/months
> (`luns`, `xaneiro`), particles (`da`, `do`, `dos`), and prefixes (`Concello`,
> `Xunta`, `Consellería`, `Universidade`, moved out of the ES lists). Tests: a
> DNI in a Galician document still detects, and `langDetect` returns `gl`, not
> `es`/`pt`.

### [ ] P28 — Portuguese pack + PT jurisdiction

> Add the `pt` language pack and the `PT` jurisdiction: NIF (mod-11 check
> digit) and Cartão de Cidadão (check digit). This plan shows that adding a
> country takes data plus one detector file with tests.

## Verification

- `npm test` green, and still unchanged after P23. `src/core/` stays DOM-free.
- `npm run build:portable`, open via `file://`: no network requests, and a
  Portuguese sample shows "Detected: Portuguese".
- `npm run lint`.
