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
import { getNerModel, type NerModelSpec } from '../core/nerModels';
import { aggregateBioTokens, computeTokenOffsets, type NerEntity, type RawNerToken } from '../core/ner';
import { nerCoverage, offsetNerEntities, planNerWindows, reconcileNerEntities, type NerCoverage } from '../core/nerWindows';
import { createIndexedDbModelCache } from './nerModelCache';

// Never look for a locally-bundled copy — the model is deliberately not part
// of the single-file build (P7d decision log, docs/plans/done/m2-detection-ner.md).
env.allowLocalModels = false;

// Reports a failed cache write to the page, so "cached for next time" is only
// ever claimed when the write really happened.
const cacheWriteFailures: unknown[] = [];

// IndexedDB-backed cache instead of the library's default Cache Storage API
// — Cache Storage is unavailable on the `file://` origin this single-file
// build is meant to be opened from, which silently disabled caching
// entirely and re-downloaded the ~104MB model on every run. See
// nerModelCache.ts for the full explanation.
env.useBrowserCache = false;
env.useCustomCache = true;
env.customCache = createIndexedDbModelCache({ onWriteError: (_key, error) => cacheWriteFailures.push(error) });

// P38: the onnxruntime runtime is served from this origin (vite.config.ts
// copies it to /ort/), never from a CDN. Runs single-threaded: the page is not
// cross-origin isolated, so worker threads would not be available anyway.
env.backends.onnx.wasm!.wasmPaths = {
  mjs: `${import.meta.env.BASE_URL}ort/ort-wasm-simd-threaded.asyncify.mjs`,
  wasm: `${import.meta.env.BASE_URL}ort/ort-wasm-simd-threaded.asyncify.wasm`,
};
env.backends.onnx.wasm!.numThreads = 1;

// Room for the special tokens ([CLS]/[SEP] or their equivalents) in every window.
const SPECIAL_TOKENS = 2;
const WINDOW_OVERLAP_CHARS = 200;

export type NerWorkerRequest = { type: 'run'; requestId: number; text: string; allowDownload: boolean; modelId: string };

export type NerWorkerResponse =
  | { type: 'scanning'; requestId: number; done: number; total: number }
  | { type: 'progress'; requestId: number; status: string; progress?: number }
  | { type: 'result'; requestId: number; entities: NerEntity[]; coverage: NerCoverage; cacheWriteFailed?: 'quota' | 'other'; modelId: string }
  | { type: 'error'; requestId: number; message: string };

// transformers.js refuses to run with local and remote models both disabled, so
// "no network" is enforced here instead: a cache miss on an origin that may not
// download fails without any request being made.
let downloadAllowed = false;
const realFetch = env.fetch;
const notStored: string[] = [];
env.fetch = (input, init) => {
  const url = new URL(String(input), self.location.href);
  // The runtime under /ort/ is part of the app itself; only other origins are the model host.
  if (downloadAllowed || url.origin === self.location.origin) return realFetch(input, init);
  // Answer as a missing file, so optional files (generation_config.json) are skipped
  // and required ones fail; either way no request is made.
  notStored.push(String(input));
  return Promise.resolve(new Response(null, { status: 404 }));
};

let currentRequestId = 0;
const extractors = new Map<string, Promise<TokenClassificationPipeline>>();

const getExtractor = (spec: NerModelSpec): Promise<TokenClassificationPipeline> => {
  let extractor = extractors.get(spec.id);
  if (!extractor) {
    const options = spec.subfolder
      ? { revision: spec.revision, subfolder: spec.subfolder, model_file_name: spec.modelFileName, dtype: spec.dtype }
      : { dtype: spec.dtype };
    extractor = (pipeline('token-classification', spec.repo, {
      ...options,
      progress_callback: (progress: { status: string; progress?: number }) => {
        const message: NerWorkerResponse = {
          type: 'progress',
          requestId: currentRequestId,
          status: progress.status,
          progress: progress.progress,
        };
        postMessage(message);
      },
    } as never) as Promise<TokenClassificationPipeline>).catch((error: unknown) => {
      // A rejected load must not stay cached, or an explicit retry would
      // re-throw the same failure forever.
      extractors.delete(spec.id);
      throw error;
    });
    extractors.set(spec.id, extractor);
  }
  return extractor;
};

const quotaFailure = (errors: readonly unknown[]): boolean =>
  errors.some((error) => error instanceof DOMException && error.name === 'QuotaExceededError');

self.onmessage = async (event: MessageEvent<NerWorkerRequest>) => {
  if (event.data.type !== 'run') return;
  const { requestId, text, allowDownload, modelId } = event.data;
  currentRequestId = requestId;
  try {
    // Hosted, opted-in builds may fetch the model; every other origin may only
    // use what is already cached locally.
    downloadAllowed = allowDownload;
    notStored.length = 0;
    cacheWriteFailures.length = 0;
    const spec = getNerModel(modelId);
    if (!spec) throw new Error(`Unknown model: ${modelId}`);
    const extractor = await getExtractor(spec);
    const countTokens = (chunk: string): number =>
      (extractor.tokenizer(chunk, { add_special_tokens: false }) as { input_ids: { size: number } }).input_ids.size;
    const windows = planNerWindows(text, countTokens, {
      maxTokens: spec.windowTokens - SPECIAL_TOKENS,
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
      cacheWriteFailed: cacheWriteFailures.length === 0 ? undefined : quotaFailure(cacheWriteFailures) ? 'quota' : 'other',
      modelId: spec.id,
    };
    postMessage(response);
  } catch (err) {
    const response: NerWorkerResponse = {
      type: 'error',
      requestId,
      message: (err instanceof Error ? err.message : String(err)) + (notStored.length ? ` [not stored: ${notStored.join(', ')}]` : ''),
    };
    postMessage(response);
  }
};
