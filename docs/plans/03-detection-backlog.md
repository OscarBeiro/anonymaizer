# 03 — Detection backlog after M3

Four bugs left open when M3 closed (2026-09-21). Three were found by *using*
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
in the restore path that only user-defined rules can trigger.

---

### [ ] D1 — Tag ID-shaped numbers whose check letter is wrong

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

### [ ] D2 — Read `Surname Surname, Given` as one person

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

### [ ] D3 — Shield lexicon for public institutions

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

### [ ] D4 — Canonicalize custom category casing so restore cannot collide

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

### Verification

Development runs in Podman (`~/containers/anonymaizer/README.md`) and
`node_modules` is not installed on the host, so every command runs **inside the
container**: `podman exec anonymaizer-5173-dev npm test`, likewise
`npm run lint`.

Per session: `npm test` and `npm run lint`.

**And verify in a real browser.** Every one of these four was found by using the
app or reading its output, not by the suite — and M3 turned up three bugs the
same way (a silently-dropped CJK PDF, `**From:**` being masked as an ID,
turndown returning an empty string under happy-dom). `npm run dev`, paste or
drop a document that exercises the case, and look at step 2. For D1 and D2 in
particular, use a `.csv` and a `.docx`, since that is where they were found.

Re-check the entry chunk size (`npm run build`, `dist/assets/index-*.js`,
**483.28 kB** as of the end of M3) if a session touches anything outside
`src/core/` — these are all detection changes, so it should not move.
