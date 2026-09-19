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
export interface MappingItem {
  id: string;
  originalText: string;
  placeholder: string; // e.g., "[NAME_1]", "[ADDRESS_1]"
  category: 'NAME' | 'EMAIL' | 'PHONE' | 'ADDRESS' | 'COMPANY' | 'CUSTOM' | 'REGEX';
  confidence: number;  // 1.0 for Manual/Regex, < 1.0 for NER
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
  - Addresses: street keywords (Rúa, Calle, Avenida, Street, Avenue, Rd) +
    house numbers + postal codes → `[ADDRESS_1]`
  - IDs / financial: Spanish DNI/NIE, IBAN, credit card patterns.
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
