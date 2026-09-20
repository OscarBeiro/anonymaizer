import { describe, expect, it } from 'vitest';
import { CLINICAL_REPORT_FIXTURE } from './__fixtures__/clinicalReport';
import { runAllDetectors } from './detectors';
import { runDetectionPipeline } from './pipeline';

// Regression bench for the 12-item field report on a real structured
// document. P7a fixes R1/R2/R5; P7b fixes R3 (masked IDs, label-anchored
// codes) below. R4 (name clustering) is P7c.
describe('field report regression — P7a + P7b', () => {
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

  it('still anonymizes the psychologist\'s bare-form name mention', () => {
    expect(mappings.some((m) => m.category === 'NAME' && m.originalText === 'Laura Ferreiro')).toBe(true);
  });

  it('does not misread the signature timestamp as a phone number (R5)', () => {
    expect(mappings.some((m) => m.category === 'PHONE')).toBe(false);
    expect(anonymizedText).toContain('2026.09.18 13:42:10');
  });

  it('redacts the label-anchored codes but keeps their labels readable (R3)', () => {
    expect(anonymizedText).toContain('Expediente [ID_CODE_1]');
    expect(anonymizedText).toContain('Colegiada [ID_CODE_2]');
    expect(anonymizedText).not.toContain('T-09310');
    expect(anonymizedText).not.toContain('EV-014/2026');
  });
});
