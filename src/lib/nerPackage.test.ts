import { describe, expect, it, vi } from 'vitest';
import type { NerModelSpec } from '../core/nerModels';

const store = vi.hoisted(() => new Map<string, ArrayBuffer>());
vi.mock('../workers/nerModelCache', () => ({
  isCached: async (key: string) => store.has(key),
  storeInCache: async (key: string, body: ArrayBuffer) => { store.set(key, body); },
}));
import { importModelPackage, isModelProvisioned, matchPackageFile, sha256Hex } from './nerPackage';

const bytes = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;

const spec = async (): Promise<NerModelSpec> => ({
  id: 'test', name: 'Test', repo: 'Org/test', revision: 'abc', license: 'MIT', status: 'experimental', dtype: 'fp32',
  files: [
    { path: 'config.json', bytes: 6, sha256: await sha256Hex(bytes('config')) },
    { path: 'int8/model_int8.onnx', bytes: 5, sha256: await sha256Hex(bytes('model')) },
  ],
  tokenizer: 'wordpiece', contextTokens: 512, windowTokens: 510, labels: [], labelMap: {}, thresholds: {},
  languages: { claimed: [], tested: [] }, backends: { nodeOnnx: 'untested', wasm: 'untested', webgpu: 'untested' },
});

describe('importModelPackage', () => {
  it('stores verified files under the keys the loader requests', async () => {
    store.clear();
    const model = await spec();
    const result = await importModelPackage(model, [new File(['config'], 'config.json'), new File(['model'], 'model_int8.onnx')]);
    expect(result).toEqual({ ok: true, stored: 2 });
    expect([...store.keys()].sort()).toEqual([
      'https://huggingface.co/Org/test/resolve/abc/config.json',
      'https://huggingface.co/Org/test/resolve/abc/int8/model_int8.onnx',
      'https://huggingface.co/Org/test/resolve/main/config.json',
    ]);
    expect(await isModelProvisioned(model)).toBe(true);
  });

  it('refuses a file whose content differs and stores nothing', async () => {
    store.clear();
    const result = await importModelPackage(await spec(), [new File(['config'], 'config.json'), new File(['modeX'], 'model_int8.onnx')]);
    expect(result).toEqual({ ok: false, reason: 'mismatch', detail: 'int8/model_int8.onnx' });
    expect(store.size).toBe(0);
  });

  it('names the files that are missing', async () => {
    store.clear();
    const result = await importModelPackage(await spec(), [new File(['config'], 'config.json')]);
    expect(result).toEqual({ ok: false, reason: 'missing', detail: 'int8/model_int8.onnx' });
  });
});

describe('matchPackageFile', () => {
  it('matches by path tail or basename', async () => {
    const model = await spec();
    expect(matchPackageFile(model, 'pkg/int8/model_int8.onnx')).toBe('int8/model_int8.onnx');
    expect(matchPackageFile(model, 'C:\\dl\\config.json')).toBe('config.json');
    expect(matchPackageFile(model, 'readme.md')).toBeUndefined();
  });
});
