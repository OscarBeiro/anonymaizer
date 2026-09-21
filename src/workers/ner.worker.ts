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
import { createIndexedDbModelCache } from './nerModelCache';

// Never look for a locally-bundled copy — the model is deliberately not part
// of the single-file build (P7d decision log, docs/plans/m2-detection-ner.md).
env.allowLocalModels = false;

// IndexedDB-backed cache instead of the library's default Cache Storage API
// — Cache Storage is unavailable on the `file://` origin this single-file
// build is meant to be opened from, which silently disabled caching
// entirely and re-downloaded the ~104MB model on every run. See
// nerModelCache.ts for the full explanation.
env.useBrowserCache = false;
env.useCustomCache = true;
env.customCache = createIndexedDbModelCache();

// P8sec: left env.backends.onnx.wasm.wasmPaths unset (library default is
// https://cdn.jsdelivr.net/npm/onnxruntime-web@<installed version>/dist/).
// Verified by hand that this resolves for the installed -dev version
// (1.31.0-dev.20260914-8d85527a0 as of 2026-09-21) — curl returned 200 for
// both the .wasm and .mjs files. Revisit if that dep version ever moves to
// one jsdelivr hasn't mirrored yet.

export type NerWorkerRequest = { type: 'run'; text: string };

export type NerWorkerResponse =
  | { type: 'progress'; status: string; progress?: number }
  | { type: 'result'; entities: NerEntity[] }
  | { type: 'error'; message: string };

let extractorPromise: Promise<TokenClassificationPipeline> | null = null;

const getExtractor = (): Promise<TokenClassificationPipeline> => {
  extractorPromise ??= pipeline('token-classification', 'Xenova/bert-base-NER', {
    // v2's `quantized: true` became `dtype` in transformers.js v3; 'q8' is
    // the same int8-quantized ONNX weights that v2's flag selected, so the
    // cached ~104MB file and its cache keys are unchanged.
    dtype: 'q8',
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
    // The pipeline returns one BIO-tagged prediction per token, so
    // aggregateBioTokens (src/core/ner.ts, pure and unit-tested) does the
    // B-/I- merging into whole entities ourselves rather than relying on
    // the library — that keeps the merge rules testable without a model.
    const raw = (await extractor(event.data.text)) as unknown as RawNerToken[];
    // P8sec: v4 no longer returns start/end itself (see core/ner.ts).
    const withOffsets = computeTokenOffsets(raw, event.data.text);
    const entities: NerEntity[] = aggregateBioTokens(withOffsets, event.data.text);

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
