import { expect, it } from 'vitest';
import { decryptRestorationKey, encryptRestorationKey } from './restorationKey';
import { freezeSnapshot } from '../core/roundTrip';
const snapshot = freezeSnapshot({ scope: 'A'.repeat(32), documentId: 'd', documentRevision: 1, policyRevision: 1, mappingRevision: 1 }, 'e', [], '1');
it('round-trips a Unicode password, authenticates parameters and fails atomically', async () => {
  const file = await encryptRestorationKey(snapshot, 'café 日本語');
  expect(await decryptRestorationKey(file, 'café 日本語')).toEqual(snapshot);
  await expect(decryptRestorationKey(file, 'wrong')).rejects.toThrow('incorrect password');
  const e = JSON.parse(file); e.iterations = 600001;
  await expect(decryptRestorationKey(JSON.stringify(e), 'café 日本語')).rejects.toThrow('incorrect password');
  e.iterations = 1000001;
  await expect(decryptRestorationKey(JSON.stringify(e), 'café 日本語')).rejects.toThrow('parameters');
  await expect(decryptRestorationKey(file.slice(0, -1), 'x')).rejects.toThrow('Malformed');
});
