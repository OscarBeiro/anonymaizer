import { describe, expect, it } from 'vitest';
import {
  detectDateTimes,
  detectLegalCitations,
  detectNames,
  detectProfessionalTitles,
  detectPublicInstitutions,
  runAllDetectors,
} from './detectors';
import { runDetectionPipeline } from './pipeline';

describe('detectLegalCitations', () => {
  it.each([
    'Ley de Prevención de Riesgos Laborales',
    'Real Decreto Legislativo 1/2013',
    'Texto Refundido',
    'Directiva 2000/78/CE',
    'Convención Internacional',
  ])('shields %s', (citation) => {
    const spans = detectLegalCitations(`Se aplica la ${citation} en este caso.`);
    expect(spans.some((s) => s.text === citation && s.shield)).toBe(true);
  });

  it('does not shield an unrelated capitalized phrase', () => {
    const spans = detectLegalCitations('Hoy hablé con Oscar Beiro sobre el proyecto.');
    expect(spans).toHaveLength(0);
  });
});

describe('detectProfessionalTitles', () => {
  it('shields a title followed by closed-list qualifiers', () => {
    const spans = detectProfessionalTitles('Fue evaluado por Laura, Psicóloga General Sanitaria, hoy.');
    expect(spans.some((s) => s.text === 'Psicóloga General Sanitaria' && s.shield)).toBe(true);
  });

  it('does not extend the shield into a name that follows the bare title', () => {
    const shields = detectProfessionalTitles('La Psicóloga Ester Cuni firmó el informe.');
    expect(shields.map((s) => s.text)).toEqual(['Psicóloga']);

    const names = detectNames('La Psicóloga Ester Cuni firmó el informe.');
    expect(names.some((s) => s.text === 'Ester Cuni')).toBe(true);
  });
});

describe('detectPublicInstitutions', () => {
  it.each([
    'Seguridad Social',
    'Tesorería General de la Seguridad Social',
    'Agencia Tributaria',
    'Hacienda',
    'INSS',
    'SEPE',
    'INEM',
    'Ministerio de Trabajo',
    'Consellería de Sanidade',
    'Consejería de Educación',
    'Ayuntamiento de Vigo',
    'Diputación de Pontevedra',
    'Junta de Andalucía',
    'Xunta de Galicia',
  ])('shields %s', (institution) => {
    const spans = detectPublicInstitutions(`Se presentó ante la ${institution} el lunes.`);
    expect(spans.some((s) => s.text === institution && s.shield)).toBe(true);
  });

  it('does not let two institutions joined by "y" survive arbitration as a NAME', () => {
    const text = 'Seguridad Social y Agencia Tributaria remitieron el requerimiento.';
    const { anonymizedText } = runDetectionPipeline(text, runAllDetectors(text));
    expect(anonymizedText).toBe(text);
  });

  it('still detects a person named in the same sentence as an institution', () => {
    const names = detectNames('Mario Prieto Casal presentó el escrito ante la Agencia Tributaria.');
    expect(names.some((s) => s.text === 'Mario Prieto Casal')).toBe(true);
  });

  it('does not let the shield swallow a name that follows it', () => {
    const shields = detectPublicInstitutions('El Ministerio de Trabajo convocó a Laura Ferreiro.');
    expect(shields.map((s) => s.text)).toEqual(['Ministerio de Trabajo']);

    const names = detectNames('El Ministerio de Trabajo convocó a Laura Ferreiro.');
    expect(names.some((s) => s.text === 'Laura Ferreiro')).toBe(true);
  });
});

describe('detectDateTimes', () => {
  it('shields a dotted date + time signature timestamp', () => {
    const spans = detectDateTimes("Fecha: 2026.09.18 13:42:10 +02'00'");
    expect(spans.some((s) => s.text === '2026.09.18 13:42:10' && s.shield)).toBe(true);
  });

  it('shields a slash-form date', () => {
    const spans = detectDateTimes('Firmado el 18/09/2026.');
    expect(spans.some((s) => s.text === '18/09/2026' && s.shield)).toBe(true);
  });
});
