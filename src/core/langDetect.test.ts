import { expect, it } from 'vitest';
import { documentLanguages, langDetect } from './langDetect';
const samples = {
  en: 'The report is for our team and the document has the information that you need. Please review this with your colleagues and send your response.',
  es: 'El informe es para nuestro equipo y el documento tiene la información que necesita. Por favor revise este documento con sus compañeros cuando tenga tiempo.',
  pt: 'O relatório é para a nossa equipa e o documento tem a informação necessária. Por favor confira os dados com os seus colegas e envie uma resposta quando não houver dúvidas.',
  fr: 'Le rapport est pour notre équipe et le document contient les informations dont vous avez besoin. Veuillez vérifier les données avec vos collègues et envoyer une réponse quand vous avez terminé.',
  it: 'Il rapporto è per il nostro gruppo e il documento contiene le informazioni che sono necessarie. Si prega di controllare questi dati con i vostri colleghi e inviare una risposta quando avete finito.',
  de: 'Der Bericht ist für unser Team und das Dokument enthält die Informationen, die Sie benötigen. Bitte prüfen Sie diese Daten mit Ihren Kollegen und senden Sie anschließend eine Antwort.',
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

it('returns whole-document and paragraph rankings with source offsets', () => {
  const text = samples.es + '\r\n \r\n' + samples.pt;
  const result = langDetect(text);
  expect(result.status).toBe('mixed');
  expect(result.languages).toEqual(expect.arrayContaining(['es', 'pt']));
  expect(result.paragraphs).toHaveLength(2);
  for (const [index, lang] of ['es', 'pt'].entries()) {
    const paragraph = result.paragraphs[index];
    expect(paragraph.languages).toEqual([lang]);
    expect(paragraph.ranked[0].lang).toBe(lang);
    expect(text.slice(paragraph.start, paragraph.end)).toBe(samples[lang as keyof typeof samples]);
  }
  expect(result.ranked.map(({ score }) => score)).toEqual(result.ranked.map(({ score }) => score).sort((a, b) => b - a));
});
it('retains mixed suggestions when whole-document scores tie', () => {
  const es = 'este nuestro cuando también tiene '.repeat(4);
  const en = 'this their which please document '.repeat(4);
  expect(langDetect(es + '\n\n' + en).languages).toEqual(expect.arrayContaining(['es', 'en']));
});
it('reads paragraphs beyond the old character and paragraph limits', () => {
  const text = (samples.es + '\n\n').repeat(220) + samples.pt;
  const result = langDetect(text);
  expect(result.languages).toContain('pt');
  expect(result.paragraphs).toHaveLength(221);
  expect(result.paragraphs.at(-1)?.languages).toEqual(['pt']);
});
it('normalizes decomposed accents and case before scoring', () => {
  for (const lang of ['es', 'gl', 'pt'] as const) {
    expect(langDetect(samples[lang].toUpperCase().normalize('NFD')).languages).toEqual([lang]);
  }
});
it('uses word suffixes and character hints without guessing from hints alone', () => {
  const hints = {
    es: 'el para que con '.repeat(5) + 'organización comunicación administración',
    pt: 'a para que por '.repeat(5) + 'organização comunicação administração',
    gl: 'a para que por '.repeat(5) + 'unha non xa',
    de: 'der und mit die '.repeat(5) + 'Straße groß heißen',
  };
  for (const [lang, text] of Object.entries(hints)) expect(langDetect(text).languages).toEqual([lang]);
  expect(langDetect('ñ '.repeat(25)).status).toBe('undetermined');
});
it('keeps empty, short, and unsupported paragraphs undetermined', () => {
  expect(langDetect('').paragraphs).toEqual([]);
  for (const text of ['', 'la que para con una', 'zqx '.repeat(30)]) {
    expect(langDetect(text).status).toBe('undetermined');
    expect(langDetect(text).languages).toEqual([]);
  }
  const result = langDetect(samples.pt + '\n\nOla Xoán');
  expect(result.paragraphs[1].status).toBe('undetermined');
});
it('suggests new languages without activating unavailable anonymization packs', () => {
  expect(langDetect(samples.pt).languages).toEqual(['pt']);
  expect(documentLanguages(samples.pt, 'auto')).toEqual(['en', 'es', 'gl']);
  expect(documentLanguages(samples.pt + '\n\n' + samples.gl, 'auto')).toEqual(['gl']);
});

it('does not treat shared Spanish/Galician suffixes as exclusive evidence', () => {
  expect(langDetect('la para que con '.repeat(5) + 'organización comunicación administración').status).toBe('undetermined');
});
it('enforces the twenty-word boundary and keeps wrapped lines together', () => {
  expect(langDetect('the '.repeat(19)).status).toBe('undetermined');
  expect(langDetect('the '.repeat(20)).languages).toEqual(['en']);
  const text = samples.es.replace(' y ', '\n');
  expect(langDetect(text).paragraphs).toHaveLength(1);
  expect(langDetect(text).languages).toEqual(['es']);
});
