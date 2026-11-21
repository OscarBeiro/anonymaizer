// P39 quality comparison: rules only, rules + BERT, rules + each candidate, same
// policy, same fixtures. Runs on Node (onnxruntime-node) — it measures detection
// quality, not browser memory or latency.
//   NER_EVAL_CACHE=<dir> [NER_EVAL_LOCAL_PACKAGE=<dir>] [NER_EVAL_OUT=<file>] npx vite-node scripts/ner-eval.mts
import { writeFileSync } from 'node:fs';
import { env, pipeline } from '@huggingface/transformers';
import { NER_EVAL_DOCS } from '../src/core/__fixtures__/nerEvalDocs';
import { DEFAULT_CATEGORY_SETTINGS } from '../src/core/categories';
import { runAllDetectors } from '../src/core/detectors';
import { aggregateScores, scoreDocument } from '../src/core/nerEval';
import { aggregateBioTokens, computeTokenOffsets, mapNerEntitiesToSpans, type NerEntity, type RawNerToken } from '../src/core/ner';
import { getNerModel, type NerModelSpec } from '../src/core/nerModels';
import { offsetNerEntities, planNerWindows, reconcileNerEntities } from '../src/core/nerWindows';
import { langDetect } from '../src/core/langDetect';
import { suggestProfile } from '../src/core/profileSelection';
import { arbitrateSpans } from '../src/core/span';

const cacheDir = process.env.NER_EVAL_CACHE ?? '.ner-eval-cache';
const localPackage = process.env.NER_EVAL_LOCAL_PACKAGE;
env.cacheDir = cacheDir;

const loadModel = async (spec: NerModelSpec, local?: string) => {
  if (local) {
    env.allowLocalModels = true; env.allowRemoteModels = false; env.localModelPath = local;
    return (await pipeline('token-classification', 'nym-large', { subfolder: 'int8', model_file_name: 'model_int8', dtype: 'fp32' } as never)) as any;
  }
  env.allowLocalModels = false; env.allowRemoteModels = true;
  const options = spec.id === 'bert-base-ner' ? { dtype: spec.dtype } : { revision: spec.revision, subfolder: spec.subfolder, model_file_name: spec.modelFileName, dtype: spec.dtype };
  return (await pipeline('token-classification', spec.repo, options as never)) as any;
};

const detect = async (extractor: any, spec: NerModelSpec, text: string): Promise<NerEntity[]> => {
  const count = (chunk: string) => extractor.tokenizer(chunk, { add_special_tokens: false }).input_ids.size;
  const windows = planNerWindows(text, count, { maxTokens: spec.windowTokens - 2, overlapChars: 200 });
  const found: NerEntity[] = [];
  for (const window of windows) {
    const chunk = text.slice(window.start, window.end);
    const raw = (await extractor(chunk, { ignore_labels: [] })) as RawNerToken[];
    found.push(...offsetNerEntities(aggregateBioTokens(computeTokenOffsets(raw, chunk), chunk), window.start));
  }
  return reconcileNerEntities(text, found);
};

const SWEEP = process.env.NER_EVAL_SWEEP === '1';
const spansFor = (text: string, entities: NerEntity[] | null, spec: NerModelSpec | null, cut?: number) => {
  const profile = suggestProfile(langDetect(text), null, 'en');
  const candidates = [
    ...runAllDetectors(text, DEFAULT_CATEGORY_SETTINGS, profile),
    ...(entities && spec ? mapNerEntitiesToSpans(entities, spec.id, spec.labelMap, cut === undefined ? spec.thresholds : Object.fromEntries(['NAME','COMPANY','LOCATION','ADDRESS','EMAIL','PHONE','IBAN','CREDIT_CARD','ID_CODE','SECRET','DATE_OF_BIRTH'].map((c) => [c, cut])), text) : []),
  ];
  return arbitrateSpans(candidates).filter((span) => !span.shield && span.enabled !== false);
};

const pct = (x: number) => (100 * x).toFixed(1);
type Row = { config: string; split: string; language: string; score: ReturnType<typeof aggregateScores> };
const rows: Row[] = [];
const timing: Record<string, number[]> = {};
const configs: { name: string; spec: NerModelSpec | null; local?: string }[] = [
  { name: 'rules-only', spec: null },
  { name: 'rules+bert', spec: getNerModel('bert-base-ner')! },
  { name: 'rules+nym-small', spec: getNerModel('nym-pii-small')! },
  ...(localPackage ? [{ name: 'rules+nym-large', spec: getNerModel('nym-pii-large')!, local: localPackage }] : []),
];

for (const config of configs) {
  const extractor = config.spec ? await loadModel(config.spec, config.local) : null;
  const perDoc = new Map<string, ReturnType<typeof scoreDocument>>();
  for (const doc of NER_EVAL_DOCS) {
    const started = performance.now();
    const entities = extractor && config.spec ? await detect(extractor, config.spec, doc.text) : null;
    (timing[config.name] ??= []).push(performance.now() - started);
    perDoc.set(doc.id, scoreDocument(doc, spansFor(doc.text, entities, config.spec)));
  }
  if (SWEEP && config.spec) {
    const cache = new Map<string, NerEntity[]>();
    for (const doc of NER_EVAL_DOCS) cache.set(doc.id, await detect(extractor, config.spec, doc.text));
    for (const cut of [0.3, 0.5, 0.65, 0.8, 0.9]) {
      for (const split of ['tuning', 'acceptance'] as const) {
        const scores = NER_EVAL_DOCS.filter((d) => d.split === split).map((d) => scoreDocument(d, spansFor(d.text, cache.get(d.id)!, config.spec, cut)));
        const a = aggregateScores(scores);
        console.log(`${config.name} cut=${cut} ${split}: recall ${pct(a.sensitiveCharRecall)} exactP ${pct(a.exactSpanPrecision)} extra ${pct(a.extraCharShare)} unmasked ${a.unmaskedSpans} items ${a.reviewItems}`);
      }
    }
  }
  for (const split of ['tuning', 'acceptance'] as const) {
    for (const language of ['all', 'es', 'gl', 'pt', 'en', 'ca', 'eu'] as const) {
      const scores = NER_EVAL_DOCS.filter((d) => d.split === split && (language === 'all' || d.language === language)).map((d) => perDoc.get(d.id)!);
      if (scores.length) rows.push({ config: config.name, split, language, score: aggregateScores(scores) });
    }
  }
}

const lines = ['config | split | lang | docs | sens-char recall | exact recall | exact precision | false merges | unmasked spans | extra-char % | review items'];
for (const row of rows) {
  const s = row.score;
  lines.push(`${row.config} | ${row.split} | ${row.language} | ${s.documents} | ${pct(s.sensitiveCharRecall)} | ${pct(s.exactSpanRecall)} | ${pct(s.exactSpanPrecision)} | ${s.falseMerges} | ${s.unmaskedSpans} | ${pct(s.extraCharShare)} | ${s.reviewItems}`);
}
lines.push('', 'per-category sensitive-char recall, acceptance, all languages:');
for (const row of rows.filter((r) => r.split === 'acceptance' && r.language === 'all')) {
  lines.push(`${row.config}: ` + Object.entries(row.score.perCategoryRecall).map(([c, r]) => `${c} ${pct(r)}`).join(', '));
}
lines.push('', 'unmasked sensitive spans (acceptance):');
for (const row of rows.filter((r) => r.split === 'acceptance' && r.language === 'all')) {
  lines.push(`${row.config}: ` + row.score.unmasked.map((u) => `${u.category}:${JSON.stringify(u.text)}`).join('; '));
}
lines.push('', 'node latency per document (ms): ' + Object.entries(timing).map(([c, t]) => `${c} p50=${[...t].sort((a, b) => a - b)[Math.floor(t.length / 2)].toFixed(0)} max=${Math.max(...t).toFixed(0)}`).join('; '));
const out = lines.join('\n');
console.log(out);
writeFileSync(process.env.NER_EVAL_OUT ?? 'ner-eval-results.txt', out + '\n');
