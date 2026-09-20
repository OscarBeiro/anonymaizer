import { describe, expect, it } from 'vitest';
import { runAllDetectors, runDeterministicDetectors } from './detectors';
import { runDetectionPipeline } from './pipeline';

describe('runDetectionPipeline', () => {
  it('handles the §6 Spanish bench case minus the name (NAME is P1b)', () => {
    const text = 'Hola, soy Oscar Beiro. Mi correo es oscar@example.com y vivo en Rúa Fernando Olmedo 12, Pontevedra.';
    const candidates = runDeterministicDetectors(text);
    const { mappings, anonymizedText } = runDetectionPipeline(text, candidates);

    expect(mappings.map((m) => m.placeholder)).toEqual(['[EMAIL_1]', '[ADDRESS_1]']);
    expect(anonymizedText).toBe(
      'Hola, soy Oscar Beiro. Mi correo es [EMAIL_1] y vivo en [ADDRESS_1].',
    );
  });

  it('dedups the same email occurring three times into one [EMAIL_1]', () => {
    const text = 'a@b.com y otra vez a@b.com y de nuevo a@b.com.';
    const candidates = runDeterministicDetectors(text);
    const { mappings, anonymizedText } = runDetectionPipeline(text, candidates);

    expect(mappings).toHaveLength(1);
    expect(mappings[0].placeholder).toBe('[EMAIL_1]');
    expect(anonymizedText).toBe('[EMAIL_1] y otra vez [EMAIL_1] y de nuevo [EMAIL_1].');
  });

  it('the full §6 Spanish bench case now includes the name', () => {
    const text = 'Hola, soy Oscar Beiro. Mi correo es oscar@example.com y vivo en Rúa Fernando Olmedo 12, Pontevedra.';
    const candidates = runAllDetectors(text);
    const { mappings, anonymizedText } = runDetectionPipeline(text, candidates);

    expect(anonymizedText).toBe(
      'Hola, soy [NAME_1]. Mi correo es [EMAIL_1] y vivo en [ADDRESS_1].',
    );
    expect(mappings.filter((m) => m.enabled).map((m) => m.placeholder).sort()).toEqual(
      ['[ADDRESS_1]', '[EMAIL_1]', '[NAME_1]'].sort(),
    );
  });

  it('§6 negative corpus (precision guard) yields zero detections', () => {
    const text =
      'Lunes por la mañana revisamos el informe. Buenos días a todos los presentes. ' +
      'El resultado incluye IVA e IRPF calculados correctamente. ' +
      'Enero fue un mes tranquilo para el departamento.';
    const candidates = runAllDetectors(text);
    const { mappings } = runDetectionPipeline(text, candidates);

    expect(mappings).toHaveLength(0);
  });

  it('§6 span arbitration case yields exactly two COMPANY and one ADDRESS, no NAME', () => {
    const text = 'Banco Santander SA facturó a TICGAL, SL en Rúa Fernando Olmedo 12, Pontevedra.';
    const candidates = runAllDetectors(text);
    const { mappings, anonymizedText } = runDetectionPipeline(text, candidates);

    expect(mappings.map((m) => m.placeholder).sort()).toEqual(
      ['[COMPANY_1]', '[COMPANY_2]', '[ADDRESS_1]'].sort(),
    );
    expect(mappings.some((m) => m.category === 'NAME')).toBe(false);
    expect(anonymizedText).toBe('[COMPANY_1] facturó a [COMPANY_2] en [ADDRESS_1].');
  });
});
