import { describe, expect, it } from 'vitest';
import { CLINICAL_REPORT_FIXTURE } from './__fixtures__/clinicalReport';
import { runAllDetectors } from './detectors';
import { runDetectionPipeline } from './pipeline';

// Regression bench for the 12-item field report on a real structured
// document. P7a fixes R1/R2/R5, P7b fixes R3 (masked IDs, label-anchored
// codes), P7c fixes R4 (name clustering) below.
describe('field report regression — P7a + P7b + P7c', () => {
  const { mappings, anonymizedText } = runDetectionPipeline(
    CLINICAL_REPORT_FIXTURE,
    runAllDetectors(CLINICAL_REPORT_FIXTURE),
  );

  it('does not let a NAME span start mid-token off the masked DNI, and now redacts it too (R1 + R3)', () => {
    expect(anonymizedText).not.toMatch(/\*\*\*\*78Q\[NAME/);
    expect(anonymizedText).not.toContain('45****78Q');
    expect(mappings.some((m) => m.category === 'MASKED_ID' && m.originalText === '45****78Q')).toBe(true);
  });

  it('does not tag legal citations as NAME (R2)', () => {
    for (const citation of [
      'Prevención de Riesgos Laborales',
      'Real Decreto Legislativo',
      'Texto Refundido',
      'Directiva 2000/78/CE',
      'Convención Internacional',
    ]) {
      expect(anonymizedText).toContain(citation);
    }
  });

  it('does not tag a professional title as NAME (R2)', () => {
    expect(anonymizedText).toContain('Psicóloga General Sanitaria');
  });

  it('clusters the psychologist\'s three name spellings behind one placeholder (R4)', () => {
    const psychologist = mappings.find((m) => m.variants.includes('Laura Ferreiro'));
    expect(psychologist?.category).toBe('NAME');
    expect(psychologist?.variants).toEqual(
      expect.arrayContaining(['Laura Ferreiro', 'FERREIRO IGLESIAS LAURA', 'Laura Ferreiro Iglesias']),
    );
    // One placeholder covers every mention.
    expect(anonymizedText.match(new RegExp(`\\[\\[${psychologist?.id.replace('_', '_00')}\\]\\]`, 'g'))).toHaveLength(3);
  });

  // Added 2026-09-21: the evaluated person opens his line ("D. Mario Prieto
  // Casal, con DNI …"), and until the sentence-initial NAME guard was relaxed
  // this report — the project's own field-report bench — left his name in
  // plain text while masking everyone else's. The honorific is peeled off, so
  // he clusters as one person rather than two.
  it('redacts the evaluated person, whose name opens its line (R6)', () => {
    const evaluated = mappings.find((m) => m.variants.includes('Mario Prieto Casal'));
    expect(evaluated?.category).toBe('NAME');
    expect(anonymizedText).not.toContain('Mario Prieto Casal');
    expect(anonymizedText).toContain('D. [[NAME_001]]');
  });

  // D1: the signature block's own DNI has a wrong check letter (H, not F),
  // so before D1 the checksum gate dropped it and this bench shipped an
  // unmasked ID. Deliberately left invalid — see the fixture's comment.
  it('redacts the signature block DNI even though its check letter is wrong (D1)', () => {
    expect(anonymizedText).not.toContain('33112244F');
    expect(mappings.some((m) => m.category === 'INVALID_ID' && m.originalText === '33112244F')).toBe(true);
  });

  it('still redacts a valid DNI as DNI, at full confidence (D1)', () => {
    const valid = mappings.find((m) => m.originalText === '12345678Z');
    expect(valid?.category).toBe('DNI');
    expect(valid?.confidence).toBe(1);
    expect(anonymizedText).not.toContain('12345678Z');
  });

  it('does not misread the signature timestamp as a phone number (R5)', () => {
    expect(mappings.some((m) => m.category === 'PHONE')).toBe(false);
    expect(anonymizedText).toContain('2026.09.18 13:42:10');
  });

  it('redacts the label-anchored codes but keeps their labels readable (R3)', () => {
    expect(anonymizedText).toContain('Expediente [[ID_CODE_001]]');
    expect(anonymizedText).toContain('Colegiada [[ID_CODE_002]]');
    expect(anonymizedText).not.toContain('T-09310');
    expect(anonymizedText).not.toContain('EV-014/2026');
  });
});
