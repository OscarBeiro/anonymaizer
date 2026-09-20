// @xenova/transformers' default caching backend is the browser Cache
// Storage API (`env.useBrowserCache`), which most browsers refuse to expose
// on a `file://` origin — exactly how this app's single-file build is meant
// to be opened (see vite.config.ts). With no cache available, the ~104MB
// NER model gets re-fetched from Hugging Face on every single run instead
// of once. IndexedDB, unlike Cache Storage, is available on `file://`, so
// this implements the same `match`/`put` contract as the Web Cache API
// (https://developer.mozilla.org/en-US/docs/Web/API/Cache) as an
// `env.customCache`, keyed by the same cache key transformers.js already
// uses (a plain string, not a Request object — see the library's own
// hub.js `cache.match(cacheKey)` / `cache.put(cacheKey, response)` calls).
const DB_NAME = 'anonymaizer-ner-model-cache';
const STORE_NAME = 'files';

interface CacheEntry {
  body: ArrayBuffer;
  headers: [string, string][];
}

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error as Error);
  });

export const createIndexedDbModelCache = () => ({
  async match(key: string): Promise<Response | undefined> {
    try {
      const db = await openDb();
      const entry = await new Promise<CacheEntry | undefined>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(key);
        req.onsuccess = () => resolve(req.result as CacheEntry | undefined);
        req.onerror = () => reject(req.error as Error);
      });
      db.close();
      return entry ? new Response(entry.body, { headers: entry.headers }) : undefined;
    } catch {
      // A cache miss (including a failed lookup) just means "download it" —
      // never let a caching problem break NER itself.
      return undefined;
    }
  },

  async put(key: string, response: Response): Promise<void> {
    try {
      const body = await response.arrayBuffer();
      const headers: [string, string][] = [...response.headers.entries()];
      const db = await openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put({ body, headers } satisfies CacheEntry, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error as Error);
      });
      db.close();
    } catch {
      // Best-effort — e.g. IndexedDB quota exceeded. Model still loaded
      // fine this run, it'll just re-download next time.
    }
  },
});
