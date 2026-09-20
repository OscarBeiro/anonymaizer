import { describe, expect, it } from 'vitest';
import { EMPHASIS_FIXTURE_HTML } from '../core/__fixtures__/emphasis';
import { detectMaskedIds, detectNames, runAllDetectors } from '../core/detectors';
import { runDetectionPipeline } from '../core/pipeline';
import { convertHtmlToMarkdown } from './htmlToMarkdown';

// P7f: turndown's defaults corrupt exactly the char classes the M2 detectors
// use to recognize masked IDs and NAME boundaries (`*`, `_`). These tests
// pin the fix at the ingest boundary, not in the detectors — see the "Trap"
// note on P7f in docs/plans/m2-detection-ner.md for why.
describe('convertHtmlToMarkdown', () => {
  it.each([
    ['<strong>Ester Cuni</strong>', 'Ester Cuni'],
    ['<b>Ester Cuni</b>', 'Ester Cuni'],
    ['<em>Ester Cuni</em>', 'Ester Cuni'],
    ['<i>Ester Cuni</i>', 'Ester Cuni'],
  ])('unwraps %s to plain text, no Markdown emphasis markers', (html, expected) => {
    expect(convertHtmlToMarkdown(`<p>${html}</p>`).trim()).toBe(expected);
  });

  it('does not backslash-escape a literal underscore in plain text', () => {
    expect(convertHtmlToMarkdown('<p>REF_2026_01</p>').trim()).toBe('REF_2026_01');
  });

  it('does not backslash-escape a literal asterisk in plain text', () => {
    expect(convertHtmlToMarkdown('<p>a*b</p>').trim()).toBe('a*b');
  });

  it('still escapes a leading "#" so plain text is not misread as a heading', () => {
    expect(convertHtmlToMarkdown('<p># Not a heading</p>').trim()).toBe('\\# Not a heading');
  });

  it('still escapes a leading "-" so plain text is not misread as a list item', () => {
    expect(convertHtmlToMarkdown('<p>- not a bullet</p>').trim()).toBe('\\- not a bullet');
  });

  it('still converts real block structure: headings and lists', () => {
    // Tables aren't in scope here — plain turndown has no table rule at all
    // (that needs the turndown-plugin-gfm plugin, not installed); M3's
    // parsers emit their own Markdown tables directly rather than going
    // through this HTML path for tabular data.
    const md = convertHtmlToMarkdown('<h1>Title</h1><ul><li>one</li><li>two</li></ul>');
    expect(md).toContain('# Title');
    expect(md).toMatch(/[*-]\s+one/);
    expect(md).toMatch(/[*-]\s+two/);
  });

  it('leaves plain, unformatted paste behaviour unchanged', () => {
    expect(convertHtmlToMarkdown('<p>Oscar Beiro</p>').trim()).toBe('Oscar Beiro');
  });
});

describe('detectNames — survives Markdown emphasis from the HTML paste path', () => {
  it.each([
    ['<strong>Ester Cuni</strong>', 'Ester Cuni'],
    ['<b>Ester Cuni</b>', 'Ester Cuni'],
    ['<em>Ester Cuni</em>', 'Ester Cuni'],
    ['<i>Ester Cuni</i>', 'Ester Cuni'],
  ])('still detects the name inside %s', (html) => {
    // Wrapped in a sentence, not left as the whole document: a capitalized
    // run at document start is deliberately rejected by detectNames'
    // sentence-initial guard (P7a), which is unrelated to this fix.
    const markdown = convertHtmlToMarkdown(`<p>Hoy hablé con ${html} sobre el proyecto.</p>`);
    const spans = detectNames(markdown);
    expect(spans.some((s) => s.text === 'Ester Cuni')).toBe(true);
  });

  it('does not misread a bolded name fragment as a masked ID', () => {
    // Before the fix: "<strong>Ester</strong> Cuni" turndown-defaults to
    // "**Ester** Cuni", and "**Ester**" itself matches MASKED_ID_TOKEN_REGEX
    // (a 2-char mask run + 5 alphanumerics) — claiming "Ester" at
    // RUNG.VALIDATED_REGEX and, via §4a whole-candidate-drop, losing the NAME.
    const markdown = convertHtmlToMarkdown('<p>Hoy hablé con <strong>Ester</strong> Cuni sobre el proyecto.</p>');
    expect(detectMaskedIds(markdown)).toHaveLength(0);
    expect(detectNames(markdown).some((s) => s.text === 'Ester Cuni')).toBe(true);
  });

  it('the masked-ID guard still works for its real target, unaffected by the fix', () => {
    // 76****12E has a genuine 4-char mask run — must still be caught, and
    // must still keep NAME from reading the trailing check letter.
    const markdown = convertHtmlToMarkdown('<p>DNI 76****12E vigente.</p>');
    expect(detectMaskedIds(markdown)).toHaveLength(1);
    expect(detectMaskedIds(markdown)[0].text).toBe('76****12E');
    expect(detectNames(markdown)).toHaveLength(0);
  });
});

describe('field report regression, through the real HTML ingest path (P7f)', () => {
  const markdown = convertHtmlToMarkdown(EMPHASIS_FIXTURE_HTML);
  // The full ladder, not detectNames alone — "Psicóloga General Sanitaria"
  // needs the P7a title shield to keep "General Sanitaria" from being read
  // as its own NAME candidate; that is a P7a concern, not this fixture's.
  const { mappings, anonymizedText } = runDetectionPipeline(markdown, runAllDetectors(markdown));

  it('clusters every emphasis-wrapped spelling of the name behind one placeholder', () => {
    const nameMappings = mappings.filter((m) => m.category === 'NAME');
    expect(nameMappings).toHaveLength(1);
    expect(nameMappings[0].variants).toEqual(
      expect.arrayContaining(['Laura Ferreiro', 'Laura Ferreiro Iglesias']),
    );
    expect(anonymizedText.match(/\[\[NAME_001\]\]/g)).toHaveLength(3);
  });

  it('leaves the surrounding prose free of stray escape backslashes or emphasis markers', () => {
    expect(anonymizedText).not.toContain('\\_');
    expect(anonymizedText).not.toContain('\\*');
    expect(anonymizedText).not.toMatch(/\*\*/);
    expect(anonymizedText).toContain('REF_2026_01');
  });
});
