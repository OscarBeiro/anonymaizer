import { expect, it } from 'vitest';
import { documentLanguages, langDetect } from './langDetect';
const samples = {
  en: 'The report is for our team and the document has the information that you need. Please review this with your colleagues and send your response.',
  es: 'El informe es para nuestro equipo y el documento tiene la información que necesita. Por favor revise este documento con sus compañeros cuando tenga tiempo.',
  gl: 'O informe é para o noso equipo e o documento ten a información que precisa. Hoxe hai unha revisión coa súa compañeira e tamén non se debe esquecer o prazo.',
};
it.each(Object.entries(samples))('detects %s from document text independently of browser locale', (lang, text) => {
  expect(langDetect(text).languages).toEqual([lang]);
});
it('reports mixed paragraphs and refuses to guess from short or unsupported text', () => {
  expect(langDetect(samples.es + '\n\n' + samples.gl).status).toBe('mixed');
  expect(langDetect(samples.es + '\n\n' + samples.gl).languages).toEqual(expect.arrayContaining(['es', 'gl']));
  expect(langDetect('Ola Xoán').status).toBe('undetermined');
  expect(langDetect('日本語'.repeat(100)).status).toBe('undetermined');
});
it('lets an explicit document choice override suggestions; undetermined auto keeps all supported packs', () => {
  expect(documentLanguages(samples.es, 'gl')).toEqual(['gl']);
  expect(documentLanguages('short', 'auto')).toEqual(['en', 'es', 'gl']);
});
