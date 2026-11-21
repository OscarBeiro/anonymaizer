// P39 browser feasibility harness. Served by `vite dev` only; never bundled.
// ?model=<registry id>&device=wasm|webgpu  → window.__bench = result | { error }
import { env, pipeline } from '@huggingface/transformers';
import { aggregateBioTokens, computeTokenOffsets, type RawNerToken } from '../src/core/ner';
import { getNerModel } from '../src/core/nerModels';

const params = new URLSearchParams(location.search);
const spec = getNerModel(params.get('model') ?? 'nym-pii-small')!;
const device = params.get('device') ?? 'wasm';
env.allowLocalModels = false;
env.backends.onnx.wasm!.wasmPaths = { mjs: '/ort/ort-wasm-simd-threaded.asyncify.mjs', wasm: '/ort/ort-wasm-simd-threaded.asyncify.wasm' };
env.backends.onnx.wasm!.numThreads = 1;

const sample = 'Hola, soy María Fernández López, vivo en Calle Mayor 12, Madrid. Mi DNI es 12345678Z y mi email maria@example.com. ';
const heap = () => (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0;

const run = async () => {
  const longTasks: number[] = [];
  new PerformanceObserver((list) => list.getEntries().forEach((entry) => longTasks.push(entry.duration))).observe({ entryTypes: ['longtask'] });
  const started = performance.now();
  let downloaded = 0;
  const localPackage = params.get('local');
  if (localPackage) { env.allowLocalModels = true; env.allowRemoteModels = false; env.localModelPath = '/scripts/.pkg/'; }
  const options = spec.id === 'bert-base-ner'
    ? { dtype: spec.dtype, device }
    : localPackage ? { subfolder: 'int8', model_file_name: 'model_int8', dtype: 'fp32', device }
    : { revision: spec.revision, subfolder: spec.subfolder, model_file_name: spec.modelFileName, dtype: spec.dtype, device };
  const extractor = (await pipeline('token-classification', localPackage ?? spec.repo, {
    ...options,
    progress_callback: (p: { status: string; loaded?: number }) => { if (p.status === 'progress' && p.loaded) downloaded = Math.max(downloaded, p.loaded); },
  } as never)) as unknown as (text: string, o: object) => Promise<RawNerToken[]>;
  const initMs = performance.now() - started;
  const doc = sample.repeat(9).slice(0, 1000);
  const timings: number[] = [];
  let entities: { entityGroup: string; text: string }[] = [];
  for (let i = 0; i < 5; i++) {
    const t = performance.now();
    const raw = await extractor(doc, { ignore_labels: [] });
    timings.push(performance.now() - t);
    if (i === 0) entities = aggregateBioTokens(computeTokenOffsets(raw, doc), doc).map(({ entityGroup, text }) => ({ entityGroup, text }));
  }
  const sorted = [...timings].sort((a, b) => a - b);
  return { model: spec.id, device, initMs: Math.round(initMs), firstRunMs: Math.round(timings[0]),
    warmP50Ms: Math.round(sorted[Math.floor(sorted.length / 2)]), warmMaxMs: Math.round(sorted[sorted.length - 1]),
    heapMB: Math.round(heap() / 1e6), longestTaskMs: Math.round(Math.max(0, ...longTasks)), entityCount: entities.length,
    firstEntities: entities.slice(0, 6) };
};

run().then((result) => { (window as unknown as { __bench: unknown }).__bench = result; })
  .catch((error: unknown) => { (window as unknown as { __bench: unknown }).__bench = { error: String(error) }; });
