import { describe, expect, it } from 'vitest';
import { CLINICAL_REPORT_FIXTURE } from './__fixtures__/clinicalReport';
import { runAllDetectors } from './detectors';
import { runDetectionPipeline } from './pipeline';

// Regression bench for the 12-item field report on a real structured
// document. P7a fixes the deterministic half (R1/R2/R5 below); R3 (masked
// IDs, label-anchored codes) and R4 (name clustering) are P7b/P7c.
describe('field report regression — P7a', () => {
  const { mappings, anonymizedText } = runDetectionPipeline(
    CLINICAL_REPORT_FIXTURE,
    runAllDetectors(CLINICAL_REPORT_FIXTURE),
  );

  it('does not let a NAME span start mid-token off the masked DNI (R1)', () => {
    expect(anonymizedText).not.toMatch(/\*\*\*\*78Q\[NAME/);
    expect(anonymizedText).toContain('45****78Q');
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

  it('leaves the ID_CODE/MASKED_ID gaps for P7b — not asserted as fixed here', () => {
    // Documented, not tested: "Colegiada T-09310" and "Expediente EV-014/2026"
    // are still exposed until P7b ships the label-anchored detectors.
    expect(anonymizedText).toContain('Colegiada T-09310');
    expect(anonymizedText).toContain('Expediente EV-014/2026');
  });
});
