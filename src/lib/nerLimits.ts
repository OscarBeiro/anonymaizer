// L3: NER runs the ~104 MB model over the whole text, in chunks, and its cost
// grows with length — unlike the regex detectors, which L2 measured at
// well under a second for 3 MB. It is already opt-in (off at load); above this
// size the opt-in asks for confirmation first. 200 000 characters is about 70
// pages of dense text, a little under the PDF parser's 100-page warning.
export const NER_LONG_DOCUMENT_CHARS = 200_000;

export const isLongForNer = (text: string): boolean => text.length > NER_LONG_DOCUMENT_CHARS;

export const nerLongDocumentMessage = (chars: number): string =>
  `This document is large (about ${Math.round(chars / 1000).toLocaleString('en')}k characters). ` +
  'Local AI detection will be slow, possibly several minutes, and the page may feel unresponsive while it runs. ' +
  'The built-in detectors already cover emails, IDs, phones, amounts and most names. Turn it on anyway?';
