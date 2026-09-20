import { describe, expect, it } from 'vitest';
import { runDeterministicDetectors } from './detectors';
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
});
