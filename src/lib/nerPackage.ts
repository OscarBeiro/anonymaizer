import { modelCacheKeys, modelFileUrl, type NerModelSpec } from '../core/nerModels';
import { isCached, storeInCache } from '../workers/nerModelCache';

// A local distribution never downloads. The user supplies the model files they
// obtained elsewhere; each is checked against the size and SHA-256 recorded in
// the registry before it is trusted, then stored where the worker looks first.

export type PackageImportResult =
  | { ok: true; stored: number }
  | { ok: false; reason: 'missing' | 'mismatch' | 'storage'; detail: string };

const hex = (bytes: ArrayBuffer): string => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');

export const sha256Hex = async (data: ArrayBuffer): Promise<string> => hex(await crypto.subtle.digest('SHA-256', data));

/** Which registry file a dropped file stands for, by the end of its path. */
export const matchPackageFile = (spec: NerModelSpec, name: string): string | undefined => {
  const tail = name.replace(/\\/g, '/');
  return spec.files.find((file) => tail === file.path || tail.endsWith(`/${file.path}`) || file.path.split('/').pop() === tail.split('/').pop())?.path;
};

export const importModelPackage = async (spec: NerModelSpec, files: readonly File[]): Promise<PackageImportResult> => {
  const byPath = new Map<string, File>();
  for (const file of files) {
    const path = matchPackageFile(spec, (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name);
    if (!path) continue;
    const have = byPath.get(path);
    // Several files can share a basename (tokenizer.json): keep the one whose size fits.
    const wanted = spec.files.find((f) => f.path === path)!.bytes;
    if (!have || file.size === wanted) byPath.set(path, file);
  }
  const missing = spec.files.filter((file) => !byPath.has(file.path)).map((file) => file.path);
  if (missing.length) return { ok: false, reason: 'missing', detail: missing.join(', ') };

  // Verify everything before storing anything, so a bad package leaves no partial model behind.
  const verified: { path: string; body: ArrayBuffer }[] = [];
  for (const expected of spec.files) {
    const body = await byPath.get(expected.path)!.arrayBuffer();
    if (body.byteLength !== expected.bytes || (await sha256Hex(body)) !== expected.sha256) {
      return { ok: false, reason: 'mismatch', detail: expected.path };
    }
    verified.push({ path: expected.path, body });
  }
  try {
    for (const { path, body } of verified) for (const key of modelCacheKeys(spec, path)) await storeInCache(key, body);
  } catch (error) {
    return { ok: false, reason: 'storage', detail: error instanceof Error ? error.name : String(error) };
  }
  return { ok: true, stored: verified.length };
};

/** True when every file of the model is already stored locally. */
export const isModelProvisioned = async (spec: NerModelSpec): Promise<boolean> => {
  for (const file of spec.files) if (!(await isCached(modelFileUrl(spec, file.path)))) return false;
  return true;
};
