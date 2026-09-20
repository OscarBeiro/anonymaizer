# AnonymAIzer — Technical Specification & Execution Blueprint

Client-Side Text Anonymization & Reversal Tool.

> Source of truth for the `P` prompts in `docs/plans/anonymaizer-plan.md`.
> Where the plan says "[paste §3 of the spec]" or "the §6 Spanish test bench
> case", it means the sections below.
>
> **Two known bugs in this spec are deliberately NOT fixed here** — the code
> must diverge from §5. See `docs/plans/anonymaizer-plan.md`, "Two spec bugs".

## 1. Executive Summary & Core Concept

AnonymAIzer is a 100% client-side, zero-backend web application (SPA / PWA)
designed to sanitize sensitive data before sending prompts to Large Language
Models (ChatGPT, Claude, Gemini), and seamlessly restore original values in AI
responses.

### Key workflow

```
[ Input Text / File ] ──> [ Browser Memory Parsing ] ──> [ 3-Tier Anonymizer Engine ]
                                                                   │
[ LLM Chat ] <── ( Copy Paste ) ── [ Key Mapping JSON ] <─── [ Interactive Review Table ]
     │                                                             │
     └── [ AI Response ] ────────> [ Browser Reversal Engine ] ──> [ Original Text Restored ]
```

1. **Ingest** — user pastes text (plain or rich HTML) or uploads documents
   (`.docx`, `.pdf`, `.eml`, `.pptx`, `.xlsx`, `.odt`, `.csv`, `.md`, `.txt`).
2. **Anonymize** — sensitive entities (names, emails, addresses, custom terms)
   are replaced with standardized placeholders (`[NAME_1]`, `[ADDRESS_1]`).
3. **Map** — a key mapping table is held in local browser memory
   (`[NAME_1]` ↔ `Oscar Beiro`).
4. **Process with AI** — user copies the sanitized text into any LLM chat.
5. **Revert** — user pastes the AI response back; the tool restores the
   original terms using the mapping key.

## 2. Architecture & Design Principles

- **Zero trust & zero egress.** All extraction, regex parsing, ML inference and
  key mapping run entirely inside the user's browser memory (Web Workers /
  WebAssembly). No data ever leaves the local device.
- **Zero install / portable.** Runs in any modern browser as an offline-capable
  PWA or a static single-file HTML bundle.
- **Context preservation.** Standard token category headers let the target LLM
  understand sentence structure without exposing private facts.
- **Paste-first usability.** Direct copy-paste with automatic HTML→Markdown
  conversion for immediate turnarounds.

## 3. Data Schemas

```ts
export type KnownCategory =
  | 'NAME' | 'EMAIL' | 'PHONE' | 'ADDRESS' | 'COMPANY'
  | 'DNI' | 'NIE' | 'IBAN' | 'CREDIT_CARD'
  | 'CUSTOM' | 'REGEX';

// CATEGORY dictionary rules mint their own (e.g. 'PROJECT_NAME'), so the type
// stays open while keeping autocompletion for the known ones.
export type Category = KnownCategory | (string & {});

export interface MappingItem {
  id: string;
  originalText: string;
  placeholder: string; // e.g., "[NAME_1]", "[ADDRESS_1]"
  category: Category;
  confidence: number;  // 1.0 dictionary/manual & checksum-validated regex;
                       // < 1.0 heuristic regex (NAME 0.6, ALL-CAPS COMPANY 0.4) and NER
  source: 'dictionary' | 'regex' | 'ner' | 'manual';
  enabled: boolean;
}

export interface MappingSession {
  sessionId: string;
  createdAt: string;
  inputType: 'PASTE' | 'FILE';
  fileName?: string;
  originalFormat: string; // e.g., 'raw_text', 'docx', 'pdf', 'eml'
  mappings: MappingItem[];
  rawMarkdown: string;
  anonymizedMarkdown: string;
}

export interface CustomDictionaryRule {
  id: string;
  termOrPattern: string;
  replacementType: 'FIXED' | 'CATEGORY';
  targetCategory?: string; // e.g., "PROJECT_NAME" -> [PROJECT_NAME_1]
  isRegex: boolean;
}
```

`MappingItem` deliberately carries **no offsets**. Spans are an internal
detection concern (see §4a) and one `MappingItem` may cover many occurrences of
the same `originalText`.

## 4. Phased Engineering Roadmap

### Milestone 1 — "Paste & Revert" Proof of Concept (immediate focus)

Validate the core anonymization logic, placeholder substitution, dynamic key
mapping and AI response reversal using direct copy/paste input, before writing
complex document parsers.

Scope:

- **Input interface** — smart paste panel supporting plain text and rich HTML
  text (converted on the fly to Markdown via `turndown`).
- **Tier 1 (custom dictionary)** — user-defined match list for custom terms,
  project codes, niche words.
- **Tier 2 (deterministic regex)**
  - Emails: standard RFC 5322 pattern → `[EMAIL_1]`
  - Phone numbers: international & national formats → `[PHONE_1]`
  - Addresses: street keyword (`Rúa`, `Rua`, `Calle`, `C/`, `Avenida`, `Avda`,
    `Plaza`, `Praza`, `Camiño`, `Street`, `Avenue`, `Road`, `Rd`) + street name
    + house number, **optionally** followed by a postal code and/or a trailing
    capitalized locality → `[ADDRESS_1]`. The postal code is *not* required —
    the §6 bench case (`Rúa Fernando Olmedo 12, Pontevedra`) is the reference
    shape.
  - IDs / financial: Spanish DNI/NIE, IBAN, credit card. Each must be
    **validated, not merely shape-matched** — Luhn for cards, mod-97 for IBAN,
    the checksum letter for DNI/NIE. A match that fails its checksum is
    discarded outright, not downgraded in confidence. Without this an order
    number becomes `[CREDIT_CARD_1]`.
  - Company names → `[COMPANY_1]`, by three separate routes:
    - **Suffix form.** Capitalized word(s) + legal-form suffix, comma- or
      space-separated (`TICGAL, SL`, `TICGAL SLU`, `Acme Corp.`). Suffixes:
      `SL`, `SLU`, `SA`, `SAU`, `S.L.`, `S.A.`, `S.L.U.`, `S.A.U.`, `S.Coop.`,
      `SCP`, `Inc`, `Inc.`, `Ltd`, `Ltd.`, `LLC`, `LLP`, `Corp`, `Corp.`,
      `PLC`, `GmbH`, `AG`, `mbH`, `BV`, `NV`, `SAS`, `SARL`, `Lda`, `Ltda`,
      `Oy`, `AB`, `A/S`, `Pty`.
    - **Prefix form.** Leading organisation keyword + capitalized tail:
      `Grupo`, `Banco`, `Fundación`, `Asociación`, `Universidade`,
      `Universidad`, `Instituto`, `Consellería`, `Ayuntamiento`, `Concello`.
    - **ALL-CAPS acronym heuristic.** A standalone run of 2+ capitals, at
      confidence `0.4` and `enabled: false` by default, so it is offered for
      review rather than applied silently. Excludes common fiscal and technical
      acronyms: `IVA`, `IRPF`, `NIF`, `CIF`, `DNI`, `NIE`, `IBAN`, `SEPA`,
      `PDF`, `URL`, `API`, `OK`.

    A bare brand name with no suffix or prefix (`TICGAL` on its own) is
    deliberately **not** a regex concern — it belongs to the Tier 1 dictionary,
    which is why the UI must offer *select text → create rule* (M1 scope).
  - Person names (heuristic): a sequence of 2+ name tokens using a general
    Unicode-letter match for "capitalized" (`\p{Lu}\p{L}*`, covering
    Á/É/Í/Ó/Ú/Ñ, Ç/Ò, Ö/Ü/ß-adjacent forms, Ã/Õ, etc. — not a hardcoded accent
    list), where each token is a capitalized word or a hyphenated compound of
    two capitalized words (`Fernández-Smith`), optionally joined by lowercase
    name/nobiliary particles from ES/FR/DE/PT (`de`, `la`, `del`, `de la`,
    `y`, `du`, `des`, `le`, `van`, `von`, `van der`, `von der`, `da`, `do`,
    `dos`, `das`), capped at ~6 tokens total, not at the start of a sentence,
    excluding a short stopword list (days, months, common sentence-starters)
    → `[NAME_1]`, confidence `0.6`, source `'regex'`. Matches e.g. "Oscar
    Beiro", "Miguel Ángel García de la Vega", "Laura Fernández-Smith",
    "François Müller", "Amélie de la Tour", "João da Silva", "Ana Söder" and
    "Ludwig von Trapp". A trailing particle can't end the match (the name
    must end on a capitalized or hyphenated-compound token). This is a
    stopgap ahead of M2's NER model — it catches structural capitalization
    patterns but is not a real name recognizer; known false positives (e.g.
    "Buenos Aires", "Estimado Señor") are an accepted M1 limitation.

    The heuristic is deliberately **precision-first**: sentence-initial and
    stopword-led sequences are rejected even though that loses a name opening a
    paragraph, because a bogus row in the mapping table costs the user more than
    a missed one. M2's NER recovers the recall. Note that a name sitting inside
    a longer address or company match (`Fernando Olmedo` in `Rúa Fernando
    Olmedo 12`) is **not** suppressed by this regex — it is swallowed by §4a
    arbitration, which is where that class of conflict is resolved.
- **Interactive mapping UI** — table of active placeholders with ON/OFF toggles
  and the ability to highlight unflagged text.
- **Reversal engine** — flexible regex matcher substituting original terms back
  into pasted AI responses despite minor LLM formatting changes (matching
  `[NAME_1]`, `[NAME 1]` or `[Name_1]`).

### Milestone 2 — Contextual local NLP (NER)

Lightweight on-device ML for non-standard names, company names and locations
that bypass regex rules.

- **Technology:** `@xenova/transformers` running an ONNX-quantized
  `bert-base-NER` model locally inside a Web Worker.
- **Execution:** background thread prevents UI freeze during model loading and
  token scanning.
- **Fallback:** highlight low-confidence detections for user review before
  copying to the LLM.
- **Supersedes the M1 name heuristic.** When opted in, NER `NAME`/location
  hits (`source: 'ner'`) take precedence over the M1 capitalized-sequence
  heuristic (`source: 'regex'`) on overlapping spans. The heuristic remains
  as a fast fallback for users who don't opt into the NER model.

### Milestone 3 — In-browser document parsing engine

| Priority | Formats               | In-browser engine / library                      |
| -------- | --------------------- | ------------------------------------------------ |
| High     | Direct paste / HTML   | Native `clipboardData` + `turndown`               |
| High     | `.docx` (Word)        | `mammoth.js`                                      |
| High     | `.pdf`                | `pdfjs-dist` (positional X/Y text reflow into MD) |
| High     | `.eml` (emails)       | `letterparser` / `eml-parse-js`                   |
| Medium   | `.pptx` (PowerPoint)  | `jszip` + native `DOMParser` XML processing       |
| Medium   | `.xlsx` / `.csv`      | `xlsx` (SheetJS)                                  |
| Medium   | `.odt`                | `jszip` + native `DOMParser` XML processing       |

## 4a. Detection Pipeline & Span Arbitration

The single structural rule the whole Tier 1/Tier 2 engine hangs off. Detectors
that mutate strings independently cannot resolve the overlaps the M1 detection
range creates (`NAME` fires inside `ADDRESS` and inside `COMPANY`), so:

1. **Detectors return spans, never text.** Every detector yields
   `{ start, end, category, text, confidence, source }` offsets over the input
   and mutates nothing.

2. **Spans are arbitrated by a priority ladder**, highest first:

   ```
   dictionary
     → EMAIL / IBAN / CREDIT_CARD / DNI / NIE / PHONE   (checksum-validated)
     → ADDRESS
     → COMPANY            (suffix and prefix forms)
     → NAME
     → COMPANY            (ALL-CAPS acronym heuristic, off by default)
   ```

   The ordering principle is **specificity**: a detector that had to satisfy a
   checksum or a structural keyword outranks one that matched a capitalization
   shape.

   **Within a single rung, the longest span wins**, ties broken by start
   offset. This matters for COMPANY, where the suffix and prefix forms overlap
   on the same text: `Banco Santander SA` (suffix) and `Banco Santander`
   (prefix) both match, and the longer must be the one that survives.

3. **Overlap drops the whole candidate.** A candidate span overlapping any
   already-accepted span is discarded entirely — never truncated, never
   partially applied. This is what makes `Rúa Fernando Olmedo 12` absorb
   `Fernando Olmedo`, and `Banco Santander SA` absorb `Banco Santander`,
   instead of leaving a phantom `NAME` mapping pointing at text that no longer
   appears in the output.

4. **Dedup by original text.** Accepted spans are grouped by exact
   `originalText`; each distinct original yields exactly one `MappingItem` and
   one placeholder, however many times it occurs. Per-category counters start
   at 1 and are assigned in order of first occurrence.

5. **Substitution walks accepted spans right-to-left by offset**, in a single
   pass, so earlier offsets stay valid as later ones are rewritten. There is no
   length-sorted string replace in the anonymization path — that technique
   belongs to §5 (reversal) only.

> A reasonable alternative to the ladder is *longest span wins, priority as
> tiebreak*; on every case known today the two agree, because the container is
> always the longer match. The explicit ladder is preferred for being
> predictable and testable one detector at a time. Because detectors already
> speak in spans, swapping the policy later is a one-line change to the
> arbitration function.

## 5. Reversal Engine Mechanics (Deanonymization)

Two core rules:

1. **Length-descending order.** Active mappings are sorted strictly by the
   length of `originalText` descending before substituting, preventing partial
   string collisions (e.g. replacing "Ana" inside "Análisis").
2. **Fuzzy placeholder regular expressions.** LLMs frequently alter token
   casing or punctuation, so a flexible regex is generated per placeholder.

```ts
export const reverseText = (aiResponse: string, mappings: MappingItem[]): string => {
  let restored = aiResponse;

  // Sort longest original text first
  const activeMappings = [...mappings]
    .filter(m => m.enabled)
    .sort((a, b) => b.originalText.length - a.originalText.length);

  for (const item of activeMappings) {
    const tokenRaw = item.placeholder.replace(/[\[\]]/g, '');
    // Matches variations: [NAME_1], [NAME 1], [Name_1], or NAME_1
    const flexibleRegex = new RegExp(`\\[?\\b${tokenRaw.replace('_', '[\\s_]?')}\\b\\]?`, 'gi');

    restored = restored.replace(flexibleRegex, item.originalText);
  }

  return restored;
};
```

> ⚠️ **Do not implement §5 verbatim.** `.replace('_', …)` only rewrites the
> first underscore (breaking `PROJECT_NAME_1`), the token is not escaped for
> regex metacharacters, and reversal must sort by **placeholder** length
> descending (so `[NAME_1]` never eats `[NAME_11]`), not by `originalText`
> length. See the plan's "Two spec bugs" section.

## 6. Test Bench Criteria (PoC success benchmark)

**Spanish / European context test**

- Input: `Hola, soy Oscar Beiro. Mi correo es oscar@example.com y vivo en Rúa Fernando Olmedo 12, Pontevedra.`
- Expected: `Hola, soy [NAME_1]. Mi correo es [EMAIL_1] y vivo en [ADDRESS_1].`

**Custom dictionary rule**

- The custom term `Project Alpha` overrides all auto-matching rules and
  converts to `[CUSTOM_1]`.

**Round-trip restoration**

- Pasting an AI response containing modified placeholders back into the
  reversal panel cleanly restores the original text with 100% accuracy.

**Negative corpus (precision guard)**

- A paragraph of ordinary Spanish prose containing no PII — including month and
  weekday names, `Buenos días`, a sentence-initial capitalized word, and an
  `IVA`/`IRPF` mention — must produce **zero** detections. Without this case the
  name and company heuristics have no measurable precision and will rot
  silently.

**Span arbitration**

- Input: `Banco Santander SA facturó a TICGAL, SL en Rúa Fernando Olmedo 12, Pontevedra.`
- Expected: exactly three mappings — `[COMPANY_1]`, `[COMPANY_2]`,
  `[ADDRESS_1]` — and **no** `NAME` mapping.
