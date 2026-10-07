# Milestone 6 — Languages: i18n, detection packs and multilingual NER

Planned 2026-09-27; reworked 2026-10-07 to take in the multilingual NER work
(research notes from the parked `docs/ner-model-candidates` branch, PR #3).
Detection is hardcoded Spanish (plus some English):
`detectDni`/`detectNie` always run (`src/core/detectors.ts`), and
`NAME_STOPWORDS`, `COMPANY_PREFIXES`, the shields and `data/es/pseudonyms.ts`
are all Spanish. Adding languages causes two problems. First, Spanish-only
rules fire on foreign text: an 8-digit+letter token in a Portuguese document
gets labelled `DNI`. Second, other countries' IDs (PT NIF, IT codice fiscale,
FR NIR, UK NINO…) are missed. The opt-in NER model (`Xenova/bert-base-NER`,
M2 P7d) has the same blind spot: it reads English only, so names and
addresses in Spanish, Galician or Portuguese text go unseen by it.

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
  what regex cannot do: names, addresses and organisations in any language.
  Neither replaces the other.
- **Checksums beat the model on IDs.** A checksummed pack detector outranks a
  model span over the same text. The model's ID-like labels only count where no
  active jurisdiction pack covers that category.
- **Language packs also filter the model.** Stopwords and the shield lexicon
  drop model false positives (`Concello`, `Atentamente`) the same way they
  drop heuristic ones.
- **`langDetect` has two consumers:** pack activation and the model tier. A
  non-English document makes the base model nearly useless, so the stronger
  one is offered up front.
- **Model tiers, escalated on demand.** Regex packs (always) → base NER
  (~104 MB, opt-in, as today) → strong multilingual NER (~359 MB, one click).
  Once downloaded, a tier is cached and used without asking again.

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
> records the pack that produced it (NER spans record the model). Active
> language packs' stopwords and shields also filter NER spans. Tests: with a
> PT-only profile, no `INVALID_ID`/name heuristics from ES; a checksummed DNI
> outranks an overlapping NER span; the default profile gives today's output.

### [ ] P26 — "Language & region" setup step

> Show the detected languages as pre-ticked chips ("Detected: Spanish 92%,
> Portuguese 8%"). Default the jurisdiction checkboxes from `defaultLanguages`,
> and let the user pin packs. A jurisdiction pack carries a category preset
> (ES turns on DNI/NIE; PT turns on NIF/CC). Persist the pinned choice the same
> way `parseCategorySettings` does. All strings go through `t()`. Leave a slot
> for the model tier line that P40 fills in.

### [ ] P38 — transformers.js v3, no behaviour change

> The app pins `@xenova/transformers` 2.17.2, which predates ModernBERT. Move
> the worker to `@huggingface/transformers` v3, still loading
> `Xenova/bert-base-NER`. Before adding it, vet it against hard rule 3: set
> `env.allowRemoteModels`/`env.backends.onnx.wasm.wasmPaths` so the ONNX
> Runtime WASM is bundled, never fetched from a CDN. Re-check whether v3's
> `aggregation_strategy` makes `aggregateBioTokens` redundant; keep it if not.
> Gate: every NER test passes untouched, the portable build makes no request.

### [ ] P39 — Model registry + multilingual model spike

> Add a pure `ModelSpec` registry in `src/core/` (`id`, `bytes`, `languages`,
> `labelMap` from model labels to our categories, `tier`). Register
> `bert-base-NER` as tier 2. Spike `Wismut/nym-pii-multilingual` as tier 3
> (see *Model candidates* below): load the int8 ONNX in the worker (its files
> sit in `int8/`, not `onnx/model_quantized.onnx`, so a re-layout may be
> needed), map its 40 labels, and score it against bert-base-NER on shared
> es/gl/pt/en fixtures. **Decision gate:** if it fails on size, speed or
> quality, try the fallbacks in order and record the result here before P40.

### [ ] P40 — Tier escalation UI

> After a result, ask "Did we miss anything?" with a one-click "Try the
> stronger model (359 MB, one-time download)" that re-runs detection. When
> `langDetect` says the document isn't English, offer it up front in the P26
> line instead. Once cached, the strongest downloaded tier is the default with
> no further prompts. Settings switch tiers and delete cached models. Show the
> size before any download; handle storage-quota errors (mobile, private
> browsing) with a clear message. Local copies (portable, `file://`,
> localhost, self-hosted) never download (hard rule 2): add a "load model from
> file" option there — P7d has none. Amend hard rule 2's wording in `CLAUDE.md`
> from "the opt-in M2 NER model download" to "opt-in NER model downloads".

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

P27 and P28 size their name data by what P39's model already catches in that
language, and add the language to the shared fixtures.

## Model candidates

Researched 2026-10-07 from Hugging Face model cards and file trees. Nothing
was downloaded or tested; scores are the authors' own claims. None lists
Galician explicitly.

| Model | Licence | Languages | Labels | Browser files | Size | Reported score |
|---|---|---|---|---|---|---|
| **Wismut/nym-pii-multilingual** | MIT | ~23 incl. ES | 40 PII types | ONNX + `tokenizer.json` | int8 359 MB | real-text F1 79.1 |
| lBroth/nullpii (GLiNER multi-PII) | Apache-2.0 | 6 incl. ES | ~14 PII | ONNX, GLiNER layout | int8 349 MB | macro F1 0.778 (OOD) |
| riidact/ner-multilingual | **CC-BY-NC-4.0** | 103 | PER/LOC/ORG | ONNX, transformers.js-ready | q 178 MB | PER F1 ≥ 0.80 in 84 langs |
| gpancardo/beto-pii | MIT | ES only | 24 PII | **no ONNX** | 110M params | span F1 0.952 (synthetic) |
| desert-ant-labs/redact | source-available | 27 EU | 20 PII | **TFLite/Core ML only** | 24 MB | — |

Fallbacks, in order: **nullpii** via the `gliner` npm package (a second
runtime; its `onnxruntime-web` WASM must be bundled, not fetched);
**riidact/ner-multilingual** (drop-in, but non-commercial licence). beto-pii
and redact are out: no ONNX build.

Sources: [nym-pii-multilingual](https://huggingface.co/Wismut/nym-pii-multilingual),
[nullpii](https://huggingface.co/lBroth/nullpii),
[ner-multilingual](https://huggingface.co/riidact/ner-multilingual),
[beto-pii](https://huggingface.co/gpancardo/beto-pii),
[redact](https://huggingface.co/desert-ant-labs/redact),
[gliner (npm)](https://npmjs.com/package/gliner).

## Verification

- `npm test` green, and still unchanged after P23. `src/core/` stays DOM-free.
- `npm run build:portable`, open via `file://`: no network requests, and a
  Portuguese sample shows "Detected: Portuguese".
- Hosted build: no model request until the user opts in; after a tier-3
  download, a reload runs it with no network request.
- `npm run lint`.
