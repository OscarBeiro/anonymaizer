// L3 / M06-02: NER runs the ~104 MB model over the whole text in overlapping
// windows of about 800 characters (core/ner.ts), so its cost grows with
// length — unlike the regex detectors, which L2 measured at well under a
// second for 3 MB. It is already opt-in (off at load).
//
// Two limits, and the first must stay below the second or the confirmation
// asks for something that then fails:
// - above NER_LONG_DOCUMENT_CHARS (about 40 windows, roughly 10 pages) the
//   opt-in asks for confirmation first;
// - above NER_MAX_CHARS (about 150 windows) the model is not run at all.
export const NER_LONG_DOCUMENT_CHARS = 25_000;
export const NER_MAX_CHARS = 100_000;

export const isLongForNer = (text: string): boolean => text.length > NER_LONG_DOCUMENT_CHARS;

export const nerLongDocumentMessage = (chars: number): string =>
  `This document is large (about ${Math.round(chars / 1000).toLocaleString('en')}k characters). ` +
  'Local AI detection will be slow, possibly several minutes, and the page may feel unresponsive while it runs. ' +
  'The built-in detectors already cover emails, IDs, phones, amounts and most names. Turn it on anyway?';
