# Milestone 6 — Languages: i18n, detection packs and multilingual NER

Planned 2026-09-27; reworked 2026-10-07 to take in the multilingual NER work
(research notes from the parked `docs/ner-model-candidates` branch, PR #3).
Reviewed again 2026-10-12 for the confirmed browser-first product direction.
The model decision and code findings are detailed in
[`M06-01-Browser-local-model-review-plan.md`](M06-01-Browser-local-model-review-plan.md).

Detection is hardcoded Spanish (plus some English):
`detectDni`/`detectNie` always run (`src/core/detectors.ts`), and
`NAME_STOPWORDS`, `COMPANY_PREFIXES`, the shields and `data/es/pseudonyms.ts`
are all Spanish. Adding languages causes two problems. First, Spanish-only
rules fire on foreign text: an 8-digit+letter token in a Portuguese document
gets labelled `DNI`. Second, other countries' IDs (PT NIF, IT codice fiscale,
FR NIR, UK NINO…) are missed. The opt-in NER model (`Xenova/bert-base-NER`,
M2 P7d) has the same blind spot: it was trained for English general NER; ES/GL/PT coverage is not established.
The application currently consumes only PER and ORG model labels.

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
- **Packs are the floor; NER is the ceiling.** Packs work everywhere, offline,
  with no download — including the portable build. A multilingual model adds
  coverage beyond regex on explicitly evaluated languages and entity types.
  Neither replaces the other.
- **Checksums beat the model on IDs.** A checksummed pack detector outranks a
  model span over the same text. The model's ID-like labels only count where no
  active jurisdiction pack covers that category.
- **Language packs provide context.** Evaluate contextual shields and stopwords
  against model recall; ambiguous common-word names must not be blanket-filtered.
- **Language detection suggests coverage.** Recommend a validated model using
  the language profile; heuristic scores are not confidence percentages.
- **Model selection is measured and explicit.** Rules always run. Benchmark a
  compact multilingual PII model first and a larger model as an optional choice.
  Remember the user's choice; do not automatically activate the largest cached
  model. Keep the existing English BERT as an evaluation baseline.

**Session order:** P14 → P15 (any time after P14) → P23 → P24 → P25 → P26 →
P38 → P39 → P40 → P27 → P28. The model sessions come before the gl/pt packs:
how well the model handles names decides how much name data those packs need.
P38–P40 are numbered after M8 because P29–P37 were already taken.

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

### [x] P24 — `langDetect`

> Tests first. `src/core/langDetect.ts` scores text against each pack's
> `profileWords` (high-frequency function words) plus character hints (`ñ`,
> `ção`, `ß`). It returns a ranked `{ lang, score }[]` for the whole document
> and for each paragraph. Test samples: es, en, pt, gl, fr, it, a mixed es+pt
> document (both reported), and short text (undetermined). The es/gl/pt split
> is the hard case: `xa`, `non`, `unha`, `-ción` vs `-ção`.

Implemented 2026-10-13. `langDetect(text)` exposes whole-document `ranked`
and `paragraphs`, each with ranked scores, suggested languages and a status.
Paragraphs are separated by blank lines (including CRLF); source `start`/`end`
offsets refer to the original text. Wrapped lines stay in one paragraph. The
full document is scored, with no silent character or paragraph truncation.

Reusable `profileWords` and character hints live in
`src/core/packs/languageProfiles.ts`: ES/EN/PT/GL/FR/IT, plus German for `ß`.
These profiles provide language suggestions; full anonymization packs remain
separate work. Shared words carry less weight, and character hints supplement
word evidence. Spanish and Galician share `ñ` and singular `-ción`; those
hints alone do not distinguish them. Scores are heuristic evidence weights,
not confidence percentages. Fewer than 20 words or ambiguous evidence produces
`undetermined`. Mixed paragraph winners survive tied document scores.
`documentLanguages` continues to activate only implemented EN/ES/GL rules,
with the existing fallback when no available rule language is suggested.

Validation: tests written first; all 626 tests pass on Node 22.23.2;
`npm run lint` and `npm run build:portable` pass. The document-language UI and
its browser acceptance check remain in P26; P24 adds no runtime network calls
or dependencies. These fixtures are regression checks, not a multilingual
accuracy benchmark.

### [x] P25 — Profile-gated detection pipeline

> `runAllDetectors(text, settings, profile = DEFAULT_PROFILE)` (and
> `anonymize`/`anonymizeWithNer`) iterates the active packs' detectors. The
> existing `gated()` category filter stays on top: `CategorySettings` still
> switches categories, and packs decide which detectors exist. Each span
> records the pack that produced it (NER spans record the model). Evaluate
> contextual pack filtering of NER against recall; do not blanket-drop ambiguous names. Tests: with a
> PT-only profile, no `INVALID_ID`/name heuristics from ES; a checksummed DNI
> outranks an overlapping NER span; the default profile gives today's output.

Implemented 2026-10-13. `DetectionProfile` separates `languages` from
`jurisdictions`; the default remains ES/EN language context with the ES
jurisdiction. `runAllDetectors`, `anonymize`, `anonymizeWithNer` and the detection
worker accept the profile. Existing language-array callers retain the ES
jurisdiction for compatibility. Category switches still gate each detector;
shields remain untoggleable. Common EMAIL/IBAN/card/MONEY rules and timestamp
shields are independent of the selected packs. The ES jurisdiction owns IDs,
phones and address cues (including the existing English address forms).
Checksum-valid DNI/NIE remain broad even without the ES jurisdiction; invalid
ID guesses require ES. Category switches also gate these broad checks.

Added the required pack types, lexical data and language registry from the
unfinished P23 scaffold. A merged pass uses active EN/ES/GL lexical context,
avoiding duplicate or partially overlapping names. PT/FR/IT/DE suggestions do
not register unfinished rule packs; PT-only contributes no Spanish heuristics.
Regex candidates record `pack` or contributing `packs`; NER candidates record
the supplied model identity (current BERT by default). Shared technical acronym
exclusions remain conservative across implemented language packs.

Regression checks compare default mappings and substitutions with the legacy
detector composition, including the clinical fixture. Profile tests cover
independent GL/ES choices, PT-only isolation, category gates, duplicate packs,
empty English shield vocabulary, checksum priority and retained NER names such
as `Amparo Paz`. No blanket stopword filtering of NER was introduced; these
checks protect specific recall cases rather than claiming a model benchmark.
The UI remains P26. P23 stays open for the remaining scaffold/pseudonym cleanup.

Validation: all 643 tests pass on Node 22.23.2; lint and portable build pass.

### [x] P26 — "Language & region" setup step

> Show the detected languages as pre-ticked chips ("Suggested: Spanish,
> Portuguese"). Default the jurisdiction checkboxes from `defaultLanguages`,
> and let the user pin packs. A jurisdiction pack carries a category preset
> (ES turns on DNI/NIE; PT turns on NIF/CC). Persist the pinned choice the same
> way `parseCategorySettings` does. All strings go through `t()`. Leave a slot
> for the model tier line that P40 fills in.

### [x] P38 — Runtime, alignment and full-document coverage

> The repository already declares `@huggingface/transformers` ^4.3.0 and the
> installed runtime registers ModernBERT token classification. Do not execute
> the obsolete v2-to-v3 upgrade. Complete gate A and the offline requirements
> of gate B in [M06-01](M06-01-Browser-local-model-review-plan.md): correct source
> offsets, token-window coverage, request/document revisions, consistent import
> and paste behavior, confidence arbitration, local runtime assets and truthful
> cache states. Coordinate lifecycle work with M09 task 02. Basic chunk coverage
> belongs here; M7 still owns large-document optimization.

### [x] P39 — Model registry and browser comparison

> Complete gates B–C in [M06-01](M06-01-Browser-local-model-review-plan.md).
> Add a pure model registry with pinned revision/artifacts, total bytes,
> tokenizer/decoder, label map, context window and tested backend capabilities.
> Evaluate `Wismut/nym-pii-multilingual-small` `int8/` first, then the larger
> `Wismut/nym-pii-multilingual` `int8/`, alongside rules-only and current BERT.
> ONNX availability is not evidence of drop-in Transformers.js compatibility.
> Record source alignment, browser memory/latency and ES/GL/PT/EN quality before
> choosing. Resolve all model labels explicitly; the current PER/ORG adapter
> would discard most PII labels. Failing candidates remain experimental.

### [~] P40 — Validated model choice and provisioning UI

> Offer the selected compact model with its measured complete download size,
> tested language coverage and initialization/scan progress. Offer a larger model
> only when evaluation justifies its added resource cost. Remember explicit user
> choice; never switch merely because a larger model is cached. Show which model
> and document revision completed detection and any incomplete coverage.
> Hosted downloads require opt-in; local distributions load a verified model
> package and bundled runtime with no network fallback. Support cancellation,
> quota errors, retry, and accurate cache deletion. Reconcile CLAUDE.md's network
> wording with this deployment policy during implementation. Run gate D of M06-01.

### [ ] P27 — Galician language pack

> A language pack only. The IDs are Spanish, so the ES jurisdiction stays on:
> this plan shows that language and jurisdiction are separate. Data:
> stopwords/greetings (`Estimado/a`, `Atentamente`, `Saúdos`), days/months
> (`luns`, `xaneiro`), particles (`da`, `do`, `dos`), and prefixes (`Concello`,
> `Xunta`, `Consellería`, `Universidade`, moved out of the ES lists). Tests: a
> DNI in a Galician document still detects, and `langDetect` returns `gl`, not
> `es`/`pt`.

### [x] P28 — Portuguese pack + PT jurisdiction

> Add the `pt` language pack and the `PT` jurisdiction: NIF (mod-11 check
> digit) and Cartão de Cidadão (check digit). This plan shows that adding a
> country takes data plus one detector file with tests.

P27 and P28 size their name data by what P39's model already catches in that
language, and add the language to the shared fixtures.

### [x] P41 — Catalan and Basque packs

> Added on request together with P28. `ca` and `eu` language packs
> (`packs/ca.ts`, `packs/eu.ts`: greetings, weekdays/months, particles,
> company/institution heads, titles, street words) and `langDetect` profiles.
> Both sit under the ES jurisdiction (Spanish IDs apply) through
> `JURISDICTION_PACKS.ES.defaultLanguages`. Basque puts institution words last
> ("Donostiako Udala"), so those heads are company suffixes. **P28 result:** `pt`
> pack plus the `PT` jurisdiction in `src/core/ptIds.ts` (NIF mod-11, Cartão de
> Cidadão check, +351 phones, streets and `NNNN-NNN` postal codes; new categories
> `NIF` and `CARTAO_CIDADAO`, preset-enabled with the region). Caveats: the word
> lists were written by the P28/P41 author and are not native-speaker reviewed;
> unlabelled 9-digit numbers are accepted as NIF only when the checksum passes
> and the first digit is 1/3/5/6/8 (so mobile and landline numbers stay phones);
> Catalan profile words avoid `el/que/no` because they are shared with Spanish
> and made short Spanish text undetermined. Galician (P27) is still open.

## Model candidates

The 2026-10-07 candidate table is superseded by the researched shortlist and
sources in [M06-01](M06-01-Browser-local-model-review-plan.md). Small multilingual
PII is the first evaluation candidate; the larger model is optional. Neither has
been executed in this application. Do not compare publisher F1 values across
unmatched datasets or adopt restricted-license fallbacks automatically.

## Verification

- `npm test` green, and still unchanged after P23. `src/core/` stays DOM-free.
- `npm run build:portable`, open via `file://`: no network requests, and a
  Portuguese sample shows "Detected: Portuguese".
- Hosted build: no model request until the user opts in; after complete model/runtime
  provisioning, inference works with network denied, including after reload.
- `npm run lint`.
