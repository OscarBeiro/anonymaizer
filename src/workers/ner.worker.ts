/// <reference lib="webworker" />
// P7d — opt-in NER worker. This is the one file in the app allowed to make a
// network request (CLAUDE.md's stated exception): the quantized ONNX model
// (~104MB) is fetched from Hugging Face on first opt-in and cached by the
// browser afterward. Everything else in the app stays offline-only.
//
// Worker-only and DOM-adjacent on purpose — this is NOT src/core/. The pure
// merge logic that decides what a NER hit means for the §4a ladder lives in
// src/core/ner.ts and is unit-tested there without ever touching this file
// or the model.
import { env, pipeline, type TokenClassificationPipeline } from '@xenova/transformers';
import { aggregateBioTokens, type NerEntity, type RawNerToken } from '../core/ner';

// Never look for a locally-bundled copy — the model is deliberately not part
// of the single-file build (P7d decision log, docs/plans/anonymaizer-plan.md).
env.allowLocalModels = false;

export type NerWorkerRequest = { type: 'run'; text: string };

export type NerWorkerResponse =
  | { type: 'progress'; status: string; progress?: number }
  | { type: 'result'; entities: NerEntity[] }
  | { type: 'error'; message: string };

let extractorPromise: Promise<TokenClassificationPipeline> | null = null;

const getExtractor = (): Promise<TokenClassificationPipeline> => {
  extractorPromise ??= pipeline('token-classification', 'Xenova/bert-base-NER', {
    quantized: true,
    progress_callback: (progress: { status: string; progress?: number }) => {
      const message: NerWorkerResponse = {
        type: 'progress',
        status: progress.status,
        progress: progress.progress,
      };
      postMessage(message);
    },
  }) as Promise<TokenClassificationPipeline>;
  return extractorPromise;
};

self.onmessage = async (event: MessageEvent<NerWorkerRequest>) => {
  if (event.data.type !== 'run') return;
  try {
    const extractor = await getExtractor();
    // This installed version of @xenova/transformers has no
    // aggregation_strategy option — it returns one BIO-tagged prediction
    // per token, so aggregateBioTokens (src/core/ner.ts, pure and
    // unit-tested) does the B-/I- merging into whole entities ourselves.
    const raw = (await extractor(event.data.text)) as unknown as RawNerToken[];
    const entities: NerEntity[] = aggregateBioTokens(raw, event.data.text);

    const response: NerWorkerResponse = { type: 'result', entities };
    postMessage(response);
  } catch (err) {
    const response: NerWorkerResponse = {
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
    postMessage(response);
  }
};
