import { describe, expect, it } from 'vitest';
import { runAllDetectors, runDeterministicDetectors } from './detectors';
import { runDetectionPipeline } from './pipeline';

describe('runDetectionPipeline', () => {
  it('handles the §6 Spanish bench case minus the name (NAME is P1b)', () => {
    const text = 'Hola, soy Oscar Beiro. Mi correo es oscar@example.com y vivo en Rúa Fernando Olmedo 12, Pontevedra.';
    const candidates = runDeterministicDetectors(text);
    const { mappings, anonymizedText } = runDetectionPipeline(text, candidates);

    expect(mappings.map((m) => m.placeholder)).toEqual(['[[EMAIL_001]]', '[[ADDRESS_001]]']);
    expect(anonymizedText).toBe(
      'Hola, soy Oscar Beiro. Mi correo es [[EMAIL_001]] y vivo en [[ADDRESS_001]].',
    );
  });

  it('dedups the same email occurring three times into one [[EMAIL_001]]', () => {
    const text = 'a@b.com y otra vez a@b.com y de nuevo a@b.com.';
    const candidates = runDeterministicDetectors(text);
    const { mappings, anonymizedText } = runDetectionPipeline(text, candidates);

    expect(mappings).toHaveLength(1);
    expect(mappings[0].placeholder).toBe('[[EMAIL_001]]');
    expect(anonymizedText).toBe('[[EMAIL_001]] y otra vez [[EMAIL_001]] y de nuevo [[EMAIL_001]].');
  });

  it('the full §6 Spanish bench case now includes the name', () => {
    const text = 'Hola, soy Oscar Beiro. Mi correo es oscar@example.com y vivo en Rúa Fernando Olmedo 12, Pontevedra.';
    const candidates = runAllDetectors(text);
    const { mappings, anonymizedText } = runDetectionPipeline(text, candidates);

    expect(anonymizedText).toBe(
      'Hola, soy [[NAME_001]]. Mi correo es [[EMAIL_001]] y vivo en [[ADDRESS_001]].',
    );
    expect(mappings.filter((m) => m.enabled).map((m) => m.placeholder).sort()).toEqual(
      ['[[ADDRESS_001]]', '[[EMAIL_001]]', '[[NAME_001]]'].sort(),
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
      ['[[COMPANY_001]]', '[[COMPANY_002]]', '[[ADDRESS_001]]'].sort(),
    );
    expect(mappings.some((m) => m.category === 'NAME')).toBe(false);
    expect(anonymizedText).toBe('[[COMPANY_001]] facturó a [[COMPANY_002]] en [[ADDRESS_001]].');
  });

  it('dedups a greeting-prefixed name mention with a bare one into a single placeholder', () => {
    const text = 'Dear Clara Vance, thank you. Regards, Clara Vance.';
    const candidates = runAllDetectors(text);
    const { mappings, anonymizedText } = runDetectionPipeline(text, candidates);

    expect(mappings.filter((m) => m.category === 'NAME')).toHaveLength(1);
    expect(anonymizedText).toBe('Dear [[NAME_001]], thank you. Regards, [[NAME_001]].');
  });

  it('arbitrates a dotted DNI over the overlapping PHONE_REGEX match by longest span', () => {
    const text = 'mi dni es 76.123.312-M gracias';
    const candidates = runAllDetectors(text);
    const { mappings } = runDetectionPipeline(text, candidates);

    expect(mappings.map((m) => m.category)).toEqual(['DNI']);
  });

  // D2: "Ferreiro Iglesias, Laura" and "Laura Ferreiro" name the same
  // person. Before D2 the comma ended the NAME candidate, so the mapping saw
  // two entities and only half-masked the comma form — the given name stayed
  // in plain text as a bare "Laura".
  it('clusters the surname-first comma form with a plain given-first mention into one placeholder', () => {
    const text = 'Ferreiro Iglesias, Laura firmó el acta. Más tarde, Laura Ferreiro lo confirmó.';
    const candidates = runAllDetectors(text);
    const { mappings, anonymizedText } = runDetectionPipeline(text, candidates);

    const nameMappings = mappings.filter((m) => m.category === 'NAME');
    expect(nameMappings).toHaveLength(1);
    expect(nameMappings[0].originalText).toBe('Laura Ferreiro Iglesias'); // given-name-first
    expect(nameMappings[0].variants).toEqual(
      expect.arrayContaining(['Laura Ferreiro Iglesias', 'Laura Ferreiro']),
    );
    expect(anonymizedText).toBe(
      '[[NAME_001]] firmó el acta. Más tarde, [[NAME_001]] lo confirmó.',
    );
  });
});
