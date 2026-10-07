// P19: the landing's paste/upload control *is* the call to action — it hands
// what the user gave it to the wizard, which picks it up on mount. In memory
// only: a document never touches localStorage on its way across, and a reload
// in between simply drops it.
export type Handoff = { kind: 'text'; text: string } | { kind: 'file'; file: File };

let pending: Handoff | null = null;

export const setHandoff = (handoff: Handoff): void => {
  pending = handoff;
};

export const takeHandoff = (): Handoff | null => {
  const h = pending;
  pending = null;
  return h;
};
