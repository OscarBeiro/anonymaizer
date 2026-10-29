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
import { env, pipeline, type TokenClassificationPipeline } from '@huggingface/transformers';
import { aggregateBioTokens, computeTokenOffsets, type NerEntity, type RawNerToken } from '../core/ner';
import { nerCoverage, offsetNerEntities, planNerWindows, reconcileNerEntities, type NerCoverage } from '../core/nerWindows';
import { createIndexedDbModelCache } from './nerModelCache';

// Never look for a locally-bundled copy — the model is deliberately not part
// of the single-file build (P7d decision log, docs/plans/done/m2-detection-ner.md).
env.allowLocalModels = false;

// Reports a failed cache write to the page, so "cached for next time" is only
// ever claimed when the write really happened.
const cacheWriteFailures: string[] = [];

// IndexedDB-backed cache instead of the library's default Cache Storage API
// — Cache Storage is unavailable on the `file://` origin this single-file
// build is meant to be opened from, which silently disabled caching
// entirely and re-downloaded the ~104MB model on every run. See
// nerModelCache.ts for the full explanation.
env.useBrowserCache = false;
env.useCustomCache = true;
env.customCache = createIndexedDbModelCache({ onWriteError: (key) => cacheWriteFailures.push(key) });

// P38: the onnxruntime runtime is served from this origin (vite.config.ts
// copies it to /ort/), never from a CDN. Runs single-threaded: the page is not
// cross-origin isolated, so worker threads would not be available anyway.
env.backends.onnx.wasm!.wasmPaths = {
  mjs: `${import.meta.env.BASE_URL}ort/ort-wasm-simd-threaded.asyncify.mjs`,
  wasm: `${import.meta.env.BASE_URL}ort/ort-wasm-simd-threaded.asyncify.wasm`,
};
env.backends.onnx.wasm!.numThreads = 1;

// The BERT tokenizer reads 512 tokens, two of them [CLS] and [SEP].
const MODEL_CONTEXT_TOKENS = 512;
const SPECIAL_TOKENS = 2;
const WINDOW_OVERLAP_CHARS = 200;

export type NerWorkerRequest = { type: 'run'; requestId: number; text: string; allowDownload: boolean };

export type NerWorkerResponse =
  | { type: 'scanning'; requestId: number; done: number; total: number }
  | { type: 'progress'; requestId: number; status: string; progress?: number }
  | { type: 'result'; requestId: number; entities: NerEntity[]; coverage: NerCoverage; cacheWriteFailed: boolean }
  | { type: 'error'; requestId: number; message: string };

let currentRequestId = 0;
let extractorPromise: Promise<TokenClassificationPipeline> | null = null;

const getExtractor = (): Promise<TokenClassificationPipeline> => {
  extractorPromise ??= (pipeline('token-classification', 'Xenova/bert-base-NER', {
    // v2's `quantized: true` became `dtype` in transformers.js v3; 'q8' is
    // the same int8-quantized ONNX weights that v2's flag selected, so the
    // cached ~104MB file and its cache keys are unchanged.
    dtype: 'q8',
    progress_callback: (progress: { status: string; progress?: number }) => {
      const message: NerWorkerResponse = {
        type: 'progress',
        requestId: currentRequestId,
        status: progress.status,
        progress: progress.progress,
      };
      postMessage(message);
    },
  }) as Promise<TokenClassificationPipeline>).catch((error: unknown) => {
    // A rejected load must not stay cached, or an explicit retry would
    // re-throw the same failure forever.
    extractorPromise = null;
    throw error;
  });
  return extractorPromise;
};

self.onmessage = async (event: MessageEvent<NerWorkerRequest>) => {
  if (event.data.type !== 'run') return;
  const { requestId, text, allowDownload } = event.data;
  currentRequestId = requestId;
  try {
    // Hosted, opted-in builds may fetch the model; every other origin may only
    // use what is already cached locally.
    env.allowRemoteModels = allowDownload;
    cacheWriteFailures.length = 0;
    const extractor = await getExtractor();
    const countTokens = (chunk: string): number =>
      (extractor.tokenizer(chunk, { add_special_tokens: false }) as { input_ids: { size: number } }).input_ids.size;
    const windows = planNerWindows(text, countTokens, {
      maxTokens: MODEL_CONTEXT_TOKENS - SPECIAL_TOKENS,
      overlapChars: WINDOW_OVERLAP_CHARS,
    });
    const found: NerEntity[] = [];
    for (const [done, window] of windows.entries()) {
      postMessage({ type: 'scanning', requestId, done, total: windows.length } satisfies NerWorkerResponse);
      const chunk = text.slice(window.start, window.end);
      // ignore_labels: [] keeps the non-entity tokens, so every token has a
      // neighbour to anchor its offset on (see computeTokenOffsets).
      const raw = (await extractor(chunk, { ignore_labels: [] })) as unknown as RawNerToken[];
      const withOffsets = computeTokenOffsets(raw, chunk);
      found.push(...offsetNerEntities(aggregateBioTokens(withOffsets, chunk), window.start));
    }
    const entities = reconcileNerEntities(text, found);

    const response: NerWorkerResponse = {
      type: 'result', requestId, entities,
      coverage: nerCoverage(text.length, windows),
      cacheWriteFailed: cacheWriteFailures.length > 0,
    };
    postMessage(response);
  } catch (err) {
    const response: NerWorkerResponse = {
      type: 'error',
      requestId,
      message: err instanceof Error ? err.message : String(err),
    };
    postMessage(response);
  }
};
