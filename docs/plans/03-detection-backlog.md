# 03 — Detection backlog after M3

Four bugs left open when M3 closed (2026-09-21), plus two more (D5, D6)
found by using v0.4.1 on 2026-09-26. Three of the first four were found by *using*
the parsers rather than by testing them, which is why they are grouped here
instead of being spread across the milestone files where they were noticed.

Same rules as the milestone files: **one `D` block per session, in order**,
tests first, tick the box when it is done and the suite passes. Read
[`anonymaizer-plan.md`](anonymaizer-plan.md) first — §4a arbitration and the
precision-first stance decide most of the judgement calls below, and
[`02-name-line-start.md`](02-name-line-start.md) is the worked precedent for
changing a NAME heuristic without flooding the output with false positives.

**The standing trade-off, settled, do not re-litigate per session:** an
over-mask is visible in step 2 and the user can untick it; a missed name is
silent and already out the door. When a change trades one for the other, take
the over-mask — but say so in a comment, and add the false positive it
introduces to the tests so the cost is measured rather than assumed.

Ordered by severity: D1 and D2 are leaks, D3 is noise, D4 is a correctness bug
in the restore path that only user-defined rules can trigger. D5 and D6 are
noise (false positives).

---

### [x] D1 — Tag ID-shaped numbers whose check letter is wrong

> **Done 2026-09-21 (v0.3.1).** `inspectDniNie` in `validators.ts` replaces the
> boolean gate with shape + checksum + expected letter; `dniNieCheck` stays as a
> wrapper. A valid number is still `DNI`/`NIE` at confidence 1 on
> `RUNG.VALIDATED_REGEX`; an ID-shaped one with a wrong check letter is tagged
> **`INVALID_ID`** — a separate category, not a lower-confidence `DNI`, because
> the step-2 reviewer must be able to tell a verified ID from a guess and the
> confidence column alone is not visible enough. New `RUNG.INVALID_ID = 3.5`,
> below `ID_CODE`: an explicit label (`Expediente 45678912Q`) is better evidence
> of what a number is than its failed checksum, and both end up masked anyway.
>
> A label anchor is **not** required — the fixture that motivated the session
> (`… LAURA - 33112244F`, a signature block) has none, so requiring one would
> have left the bench case unfixed. It raises confidence instead: 0.9 anchored
> (`DNI`/`NIE`/`NIF`/`documento`/`identidad`, with `nº`/`es` filler), 0.5 bare.
> The one hard exclusion is a URL/query context (`…/76543210X`). The accepted
> over-mask (an 8-digit-plus-letter invoice code) is asserted in
> `detectors.test.ts` so the cost is measured, per the standing trade-off.
> `CLINICAL_REPORT_FIXTURE` keeps its invalid `33112244F` as a regression
> witness, with a comment saying so, and gains a valid `12345678Z` on a new
> last line for the valid-case assertion.

> **The leak.** `validators.ts` (`dniNieCheck`) only *confirms* a candidate:
> `DNI_LETTERS[digits % 23] === letter`. A number that is plainly a DNI/NIE but
> whose check letter does not match — a typo, an OCR error, a digit changed to
> pseudonymise it by hand — is not tagged as anything at all and passes through
> the anonymizer in plain text. Precision-first was the right instinct
> everywhere else; here it fails open on exactly the documents most likely to
> have been mangled.
>
> **It has demonstrated itself twice already, in this repo.** At P8b a
> hand-written `45678912Q` in a test fixture went unmasked and cost a debugging
> detour before anyone suspected the check letter (`S` is correct). At P8e the
> same thing surfaced in the project's *own* reference corpus:
> `CLINICAL_REPORT_FIXTURE`'s `33112244F` is invalid (`H` is correct), so that
> DNI has never once been detected by the suite that uses it as a bench. Fix
> the fixture too, but **not by changing the number** — see the trap below.
>
> Compute the expected letter and tag the number either way, distinguishing a
> valid ID from an ID-shaped number with a bad check letter. Decide and record
> whether that is a separate category (`INVALID_ID`?) or the same `DNI`/`NIE`
> category at a lower confidence with a warning — the placeholder the user sees
> and the `MappingItem` they review are both affected, so this is a UI-visible
> decision, not just a detector one.
>
> Write tests first: a valid DNI still detects as today, at today's confidence;
> `45678912Q` and `33112244F` are tagged; a NIE with a bad letter is tagged;
> something merely digit-shaped (`12345678`, a phone, an invoice number, a
> postcode) is **not**; and the clinical report bench gains an assertion that
> its own DNI is redacted.

> **Trap — do not "fix" `CLINICAL_REPORT_FIXTURE` by correcting the number.**
> Its invalid check letter is now a deliberate regression test: it is the exact
> shape this session exists to catch. Correcting it would delete the evidence
> and leave D1 untested against the corpus that found it. Add a comment saying
> so, and add a *second*, valid DNI elsewhere in the fixture if a valid-case
> assertion is wanted.

> **Trap — the false-positive surface is real and asymmetric.** Any 8-digit +
> letter string becomes a candidate once the checksum stops being a gate:
> invoice numbers, product codes, `76543210X` in a URL. The digit-count and
> word-boundary rules in `DNI_REGEX` are doing more work than they look like
> they are. Consider requiring a label anchor (`DNI`, `NIE`, `documento`) for
> the *invalid* case while keeping the unanchored match for the valid one —
> that keeps today's precision exactly where it is and only widens where there
> is contextual evidence.

---

### [x] D2 — Read `Surname Surname, Given` as one person

> **Done 2026-09-21 (v0.3.2).** `detectNames` (`detectors.ts`) gets a
> comma-continuation step, tried only after the base match clears the
> existing 2-token floor: if `,${WS}*` is immediately followed by 1-2 more
> `NAME_TOKEN`s, the span widens to cover the whole `Surname Surname, Given`
> range, and `span.text` is *reordered* to given-name-first with the comma
> dropped (`"Laura Ferreiro Iglesias"`) rather than kept as the literal
> comma-bearing substring. `entities.ts` clusters by token set already
> (order-independent), so that reordered text just is the record D2 asked
> for; no change needed there. `buildMappings` then picks it as canonical on
> length as usual, which for a reordered three-token form beats a shorter
> `"Laura Ferreiro"` mention elsewhere — given-name-first, as required,
> without inventing a second canonicalization rule.
>
> The trailing capture is rejected — falling back to the un-extended, comma-
> less match — when the text right after the comma (checked on the raw
> tail, not the truncated capture group, so a dotted suffix like `S.L.` is
> caught regardless of where `NAME_TOKEN` would have stopped) starts with a
> company suffix, a stopword/title, or a structure head. The "list of
> people" trap (`Mario, Laura y Ana`) needs no separate exclusion: `Mario`
> alone never clears the pre-comma 2-token floor, so extension is never
> attempted. The table-row trap needs none either: `|` and a digit-shaped
> cell are not `NAME_TOKEN`-shaped, so the capture stops at the given name on
> its own.
>
> Tests: `company-name.test.ts` (`detectNames` in isolation — the comma
> form, the given-name-first text, and every trap from the plan: locality
> pair, company suffix, ID after the comma, sentence fragment, table cell),
> `pipeline.test.ts` (the comma form clustering with a plain mention into one
> placeholder end to end) and `csv.test.ts` (the P8e case round-tripped
> through the real `.csv` parser, not a hand-built string).

> **The leak, and it is the nastier kind.** A contact list holding
> `Ferreiro Iglesias, Laura` masks as `[[NAME_002]], Laura`. The comma ends the
> NAME candidate, so the given name is left in plain text *and* the person is
> only half-masked — which is worse than either outcome on its own: a reader can
> often still identify them from the fragment, and the mapping does not record
> them as one person, so reversal and the statistics panel both see two
> entities where there is one. Found at P8e in a `.csv`, but the form is
> everywhere: directory exports, citations, `Apellidos, Nombre` form fields,
> signature blocks, library catalogues.
>
> Let a NAME candidate continue across `,${WS}*` when what follows is one or two
> further name tokens on the same line, then canonicalize to given-name-first
> for clustering — `entities.ts` already owns canonicalization and already
> clusters `FERREIRO IGLESIAS LAURA` with `Laura Ferreiro`, so the surname-first
> case is a variant of a problem that is already solved there, not a new one.
>
> Write tests first: `Ferreiro Iglesias, Laura` is one NAME span covering the
> whole string; it clusters with a plain `Laura Ferreiro` elsewhere in the same
> document into **one** placeholder; the canonical form is recorded
> given-name-first; and a `.csv` fixture round-trips it through the parser so
> the P8e case itself is covered end to end.

> **Trap — the same comma joins things that are not one name.** `Madrid, Spain`;
> `Acme Consulting, S.L.`; `Prieto, 45678912S`; a list like
> `Mario, Laura y Ana`. The company case is the dangerous one, because
> `COMPANY_SUFFIXES` already matches `S.L.` and a greedy NAME would now reach
> across the comma and fight it in §4a arbitration. At minimum: stop at a token
> that is a company suffix, a stopword, a structure head or anything non-name
> shaped, and require the trailing part to be short (one or two tokens) —
> `Ferreiro Iglesias, Laura` is a name, `Ferreiro Iglesias, responsable del
> proyecto y firmante del acta` is not.

> **Trap — this interacts with D1's arbitration.** In a table row,
> `Prieto Casal, Mario | 45678912S` has the ID immediately after the comma-form
> name with only a cell boundary between them. Check that widening NAME does
> not start swallowing the next cell once the two land in the same line of a
> Markdown table.

---

### [x] D3 — Shield lexicon for public institutions

> **Done 2026-09-21 (v0.3.3).** `detectPublicInstitutions` in `detectors.ts`
> follows the existing shield shape exactly: a small `INSTITUTION_HEADS`
> array (`Seguridad Social`, `Tesorería General`, `Agencia Tributaria`,
> `Hacienda`, `INSS`, `SEPE`, `INEM`, `Ministerio`, `Consellería`,
> `Consejería`, `Ayuntamiento`, `Diputación`, `Junta`, `Xunta`) reuses the
> same `LEGAL_CONTINUATION` connector pattern `detectLegalCitations` already
> has, so `Ministerio de Trabajo` and `Xunta de Galicia` extend correctly and
> stop at the first lowercase, non-connector word. Wired into
> `runShieldDetectors` alongside the other two shields, so it wins §4a
> arbitration the same way and is dropped before minting.
>
> This is explicitly *not* the session that introduces a shared lexicon-pack
> shape for `NAME_STOPWORDS`/`COMPANY_SUFFIXES`/this list — said so in a
> comment above `INSTITUTION_HEADS`, kept small and obviously Spain-only, so
> that migration stays mechanical whenever it happens.
>
> Tests (`shields.test.ts`): each institution above shields on its own; a
> person named in the same sentence as an institution is still a NAME
> (`detectNames` is unaffected by the shield in isolation); a title/shield
> does not swallow a name that follows it; and — the actual bug — running
> `Seguridad Social y Agencia Tributaria remitieron el requerimiento.`
> through the real arbitration pipeline (`runAllDetectors` +
> `runDetectionPipeline`, not `detectNames` alone) now leaves the text
> untouched, where before this session it minted a false NAME spanning both
> institutions.

> **The noise this time, not a leak.** Relaxing the sentence-initial NAME guard
> (see [`02-name-line-start.md`](02-name-line-start.md)) closed a real leak and
> introduced one class of false positive:
> `Seguridad Social y Agencia Tributaria` now reads as a single NAME, because
> two capitalised institution names joined by `y` have exactly the shape of a
> person. Over-masking is the side of the trade we chose deliberately, so this
> is a polish session, not a correctness one — but it is the *main* remaining
> false positive and it fires on documents about benefits, tax and employment,
> which is a large share of what this tool is pointed at.
>
> Add a shield detector (`runShieldDetectors`, alongside `detectLegalCitations`
> and `detectProfessionalTitles` — a shield wins arbitration and is then dropped
> before minting, which is exactly the semantics wanted: "nothing should touch
> this"). Seed it with the Spanish public bodies: Seguridad Social, Tesorería
> General de la Seguridad Social, Agencia Tributaria, Hacienda, INSS, SEPE,
> INEM, Ministerio de …, Consellería/Consejería de …, Ayuntamiento de …,
> Diputación de …, Junta de …, Xunta de Galicia.
>
> Write tests first: the institutions above are not NAMEs; a person named in the
> same sentence as one still is (`Mario Prieto Casal presentó el escrito ante
> la Agencia Tributaria`); and `Ministerio de Trabajo` does not swallow a name
> that follows it, the way P7a's title shield had to be taught not to.

> **Trap — this list is the third one in the codebase that wants to grow
> forever**, after `NAME_STOPWORDS` and `COMPANY_SUFFIXES`, and the index's M1
> backlog already proposes per-language data-file packs as the answer for the
> first. Do not build a fourth ad-hoc array without at least deciding whether
> this is the session that introduces the shared "lexicon pack" shape. If it is
> not, say so in a comment and keep the array small and obviously Spain-only, so
> the eventual migration is mechanical.

---

### [x] D4 — Canonicalize custom category casing so restore cannot collide

> **Done 2026-09-21 (v0.3.4).** Picked the second candidate fix: reject a
> case-only `targetCategory` collision at rule-creation time in
> `ruleValidation.ts`, not silent canonicalization. `validateRuleInput` grows
> two optional parameters — `existingRules` and `excludeRuleId` (so editing a
> rule doesn't collide with itself) — and returns an error naming both
> categories when a new/edited CATEGORY rule's `targetCategory` differs only
> in case from one already in the session. `RulesEditor.tsx` passes `rules`
> and the in-progress `editingId` through. `parseImportedRules` gained the
> same check across the whole imported batch plus whatever's already in the
> session, so an import can't reintroduce the collision the form itself
> refuses to create — `RulesEditor`'s `importRules` now passes the current
> `rules` in.
>
> A pre-existing session that already has such a pair (created before this
> fix, or hand-edited JSON) is left alone: `reverseText` itself is unchanged.
> It was already deterministic — mappings are processed in array order, so
> the first one wins consistently — just not obviously *correct*, and fixing
> that would mean picking a winner among two categories the user chose on
> purpose, which isn't this session's call to make. Asserted in
> `reverse.test.ts` rather than "fixed": same input, same output, twice.
>
> Tests: `ruleValidation.test.ts` covers the rejection (message names both
> categories), acceptance of an exact-case match and of a genuinely distinct
> category, the `excludeRuleId` self-exclusion, FIXED rules being ignored,
> and both import-time cases (collides with itself, collides with the
> session). `reverse.test.ts` adds the two behavioural guarantees asked for:
> a single custom category still restores case-insensitively (unchanged,
> deliberate), and a legacy colliding pair restores the same way on repeated
> calls.

> `reverseText`'s restore regex runs case-insensitive (the `i` flag) on purpose,
> so an LLM that echoes `[name_1]` in lowercase still restores. The cost is that
> two custom dictionary categories differing only in case — `Custom` and
> `CUSTOM`, both reachable through `CustomDictionaryRule.targetCategory` — mint
> placeholders that are indistinguishable at restore time, and one entity's text
> comes back in the other's place. Silent, and the user has no way to see it
> coming.
>
> Not a risk for the built-in categories (`NAME`, `EMAIL`, …), which are fixed
> and distinct; only user-defined `CATEGORY`-type rules can produce it.
>
> Two candidate fixes, and this session should pick one and say why: canonicalize
> the category casing when a rule mints one (silent, no UI, but the user's
> chosen casing is not what they see in the output), or reject a case-only
> collision at rule-creation time in `ruleValidation.ts` (visible, teachable,
> consistent with the validation that already lives there). The second is
> probably right — `ruleValidation.ts` exists precisely so a bad rule is caught
> where the user can still fix it.
>
> Write tests first: two rules whose categories differ only in case are rejected
> at creation with a message naming both; an existing session that already
> contains such a pair still restores deterministically (or is migrated —
> decide); and a single category keeps restoring case-insensitively, since that
> behaviour is deliberate and must not regress.

---

### [x] D5 — Acronyms are not companies

Found 2026-09-26 by using the app on v0.4.1. `detectCompanyAcronyms`
(`src/core/detectors.ts`) flags every run of two or more capitals as COMPANY.
Only a fiscal list (`IVA`, `DNI`, `PDF`, …) is excluded, so `NDA`, `CNMV` and
`AEAT` all show up. They start unticked, but they clutter step 2 enough that
the real detections are hard to find.

Reproduced:

| Input | Detected |
|---|---|
| `Firmamos el NDA con Acme S.L. ayer.` | `NDA` → COMPANY (disabled) |
| `Enviar a la CNMV y la AEAT el PDF.` | `CNMV`, `AEAT` → COMPANY (disabled) |

> Write tests first:
> - `NDA`, `SLA`, `CEO`, `RGPD`, `LOPD`, `KPI`, `ONG`, `BOE`, `EUR`, `IT`
>   produce no COMPANY span.
> - `AEAT`, `CNMV`, `SEPE`, `DGT`, `INSS`, `TGSS` become SHIELD spans, the same
>   way D3 shields institutions by their full names.
> - Regression: `Acme S.L.` and an unknown acronym such as `ACME` are still
>   detected (the unknown one stays a disabled suggestion).
>
> Implementation: rename `FISCAL_ACRONYM_EXCLUSIONS` to `ACRONYM_EXCLUSIONS`
> and extend it with common legal, business and tech terms. Add the institution
> acronyms to D3's shield lexicon (`INSTITUTION_HEADS`, next to
> `detectPublicInstitutions`) so that arbitration suppresses them. Leave the
> rung of the remaining unknown acronyms unchanged: a disabled suggestion is an
> over-mask, not a leak.

**Done 2026-09-26 (v0.4.3).**
- `ACRONYM_EXCLUSIONS` replaces the fiscal-only list (legal, business, tech,
  currency terms).
- `INSTITUTION_HEADS` gains `AEAT`, `TGSS`, `CNMV`, `DGT`, `CNMC`, `AEPD`,
  closed on the right with `(?!\p{L})`.
- **A leak found along the way, older than D5:** `Escribió a Hacienda y Juan
  Pérez` did not mask Juan Pérez. There were two causes. (1) The institution
  shield reused `LEGAL_CONTINUATION`, which runs across `y` and any capitalised
  word, so it swallowed the person. It now has its own
  `INSTITUTION_CONTINUATION` without `y`. (2) NAME treats `y` as a particle,
  so it matched `Hacienda y Juan Pérez`, overlapped the shield, and arbitration
  dropped it whole. `stripLeadingLabels` now peels a leading institution plus
  its `y`/`e` (`INSTITUTION_LEAD_RE`). Both are tested in `shields.test.ts`.
- Possible cost: an institution name that continues after `y` is now shielded
  only up to the `y`. Checked with `Ministerio de Trabajo y Economía Social`,
  and nothing surfaces. If a case turns up where it does, it will show in step 2
  and can be unticked.

---

### [ ] D6 — A lone initial is not a name

Found the same day. `NAME_TOKEN` accepts `\p{Lu}\.` so that `J. Smith` and
`Juan G. Pérez` work. As a side effect, any capitalised noun followed by a
lettered item gets read as a person:

| Input | Detected |
|---|---|
| `Punto G. Anexo A del contrato.` | `Punto G. Anexo` → NAME |
| `Juan G. Pérez firmó el NDA.` | `Juan G. Pérez` → NAME (correct, must stay) |

The user also saw a bare single letter ("G") masked. That may be the path
above, or it may be NER returning a one-character entity. **Get the real text
from the user and add it as a fixture before choosing the fix.**

> Write tests first:
> - `Punto G. Anexo A`, `Anexo B. Cláusula`, `Opción C. Según lo` produce no
>   NAME.
> - Still detected: `Juan G. Pérez`, `J. Smith`, `María J. López García`.
> - `mapNerEntitiesToSpans` (`src/core/ner.ts`) drops entities that have fewer
>   than two letters or consist only of initials (`ner.test.ts`).
>
> Implementation: add a small `NON_NAME_HEADS` list (`Punto`, `Anexo`,
> `Apartado`, `Opción`, `Plan`, `Artículo`, `Cláusula`, `Sección`, …). A match
> whose first token is one of these and whose next token is an initial is
> rejected. As a final guard, drop any NAME span that has fewer than two
> tokens once initials are left out, reusing the existing token-floor helper.
> Per the standing trade-off, a real name that starts with one of these heads
> is an accepted cost: record it as a test.

---

### Verification

Development runs in Podman (`~/containers/anonymaizer/README.md`) and
`node_modules` is not installed on the host, so every command runs **inside the
container**: `podman exec anonymaizer-5173-dev npm test`, likewise
`npm run lint`.

Per session: `npm test` and `npm run lint`.

**And verify in a real browser.** Every one of these was found by using the
app or reading its output, not by the suite — and M3 turned up three bugs the
same way (a silently-dropped CJK PDF, `**From:**` being masked as an ID,
turndown returning an empty string under happy-dom). `npm run dev`, paste or
drop a document that exercises the case, and look at step 2. For D1 and D2 in
particular, use a `.csv` and a `.docx`, since that is where they were found.

Re-check the entry chunk size (`npm run build`, `dist/assets/index-*.js`,
**485.33 kB** as of D4 (D4 touches `RulesEditor.tsx`, outside `src/core/`);
484.14 kB after D2 and D3 (D3 stayed inside `src/core/`, so unchanged from
D2); 483.66 kB after D1; **483.28 kB** at the end of M3.
