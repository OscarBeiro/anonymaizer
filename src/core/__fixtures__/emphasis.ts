/**
 * P7f regression fixture. Reproduces the shapes a real HTML paste or an M3
 * document parser (mammoth, the ODT/PPTX DOMParser walkers) routinely
 * produces around PII: a bolded name in a signature block, an italicized
 * name, a bold-label form line, and a plain code value wrapped in bold that
 * contains a literal underscore — turndown's default escaping would mangle
 * that last one into `REF\_2026\_01` even though no name is involved, which
 * is the "corrupts plain prose, not just names" half of the bug.
 *
 * This is HTML, not Markdown — it exercises the ingest boundary
 * (`src/lib/htmlToMarkdown.ts`) end to end, the same path a real paste or
 * parser goes through, rather than hand-written Markdown that skips it.
 *
 * The italicized mention sits mid-sentence ("firma: *…*"), not as its own
 * paragraph right after a full stop — a standalone capitalized run straight
 * after sentence-ending punctuation is deliberately rejected by
 * `isSentenceInitial` in `detectNames` (a P7a precision-first call, see
 * `src/core/detectors.ts`), which is a different, intentional design
 * decision this fixture is not testing.
 */
export const EMPHASIS_FIXTURE_HTML = `
<p>Evaluado por <strong>Laura Ferreiro</strong>, Psicóloga General Sanitaria; firma: <em>Laura Ferreiro Iglesias</em>.</p>
<p><strong>Nombre:</strong> Laura Ferreiro</p>
<p>Código interno: <strong>REF_2026_01</strong></p>
`;
