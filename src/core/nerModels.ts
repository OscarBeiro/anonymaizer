import { BERT_LABEL_MAP, type NerLabelMap } from './ner';

// P39: the models the app knows how to run, as plain data. Nothing here loads
// a model — src/workers/ner.worker.ts reads an entry and src/lib code shows it.
// A model whose `status` is not 'validated' is never offered by default; it
// must pass the M06-01 gates (docs/plans/M06-01-Browser-local-model-review-plan.md).

export interface NerModelFile {
  /** Path inside the repository at `revision`. */
  path: string;
  bytes: number;
}

export type NerModelStatus = 'default' | 'experimental';
export type BackendSupport = 'untested' | 'works' | 'fails';

export interface NerModelSpec {
  id: string;
  repo: string;
  /** Commit the artifacts were measured at; downloads are pinned to it. */
  revision: string;
  license: string;
  status: NerModelStatus;
  /** Folder holding the quantized graph, when it is not the repository root. */
  subfolder?: string;
  modelFileName?: string;
  dtype: 'q8' | 'fp32';
  /** Everything one complete download fetches, tokenizer included. */
  files: readonly NerModelFile[];
  tokenizer: 'wordpiece' | 'sentencepiece';
  /** Tokens the model accepts at once, special tokens included. */
  contextTokens: number;
  /** Tokens per scan window; kept below the context to bound memory. */
  windowTokens: number;
  /** Every label type (BIO prefix stripped) the model can emit. */
  labels: readonly string[];
  labelMap: NerLabelMap;
  /** Confidence cut per category; absent categories use the default 0.8. */
  thresholds: Readonly<Record<string, number>>;
  languages: {
    /** What the publisher states; not evidence of quality. */
    claimed: readonly string[];
    /** Languages with measured results in our own evaluation. */
    tested: readonly string[];
  };
  /** Measured by running the graph, not by reading a card. */
  backends: { nodeOnnx: BackendSupport; wasm: BackendSupport; webgpu: BackendSupport };
  /** What stops this model being a drop-in, if anything. */
  caveat?: string;
}

export const modelTotalBytes = (model: NerModelSpec): number => model.files.reduce((sum, file) => sum + file.bytes, 0);

const NYM_LABELS = [
  'ACCOUNT_NUMBER', 'AGE', 'API_KEY', 'BUILDING_NUMBER', 'CITY', 'COMPANY_NAME', 'COUNTRY', 'CREDIT_DEBIT_CARD',
  'CUSTOMER_ID', 'CVV', 'DATE', 'DATE_OF_BIRTH', 'DRIVERS_LICENSE', 'EMAIL', 'EMPLOYEE_ID', 'FAX_NUMBER', 'GENDER',
  'GIVEN_NAME', 'GOVERNMENT_ID', 'IBAN', 'LICENSE_PLATE', 'MAC_ADDRESS', 'MEDICAL_RECORD_NUMBER', 'PASSPORT',
  'PASSWORD', 'PHONE', 'PIN', 'ROUTING_NUMBER', 'SECONDARY_ADDRESS', 'SSN', 'STATE', 'STREET_ADDRESS', 'STREET_NAME',
  'SURNAME', 'SWIFT_BIC', 'TAX_ID', 'TIME', 'URL', 'USERNAME', 'ZIP_CODE',
] as const;

// Every label is decided here. A location is not a street address: CITY, STATE
// and COUNTRY are LOCATION; only street-level labels are ADDRESS. Secrets and
// dates of birth get their own categories so they can be switched separately.
export const NYM_LABEL_MAP: NerLabelMap = {
  GIVEN_NAME: { category: 'NAME' },
  SURNAME: { category: 'NAME' },
  USERNAME: { category: 'NAME' },
  COMPANY_NAME: { category: 'COMPANY' },
  CITY: { category: 'LOCATION' },
  STATE: { category: 'LOCATION' },
  COUNTRY: { category: 'LOCATION' },
  STREET_ADDRESS: { category: 'ADDRESS' },
  STREET_NAME: { category: 'ADDRESS' },
  SECONDARY_ADDRESS: { category: 'ADDRESS' },
  BUILDING_NUMBER: { category: 'ADDRESS' },
  ZIP_CODE: { category: 'ADDRESS' },
  EMAIL: { category: 'EMAIL' },
  PHONE: { category: 'PHONE' },
  FAX_NUMBER: { category: 'PHONE' },
  IBAN: { category: 'IBAN' },
  CREDIT_DEBIT_CARD: { category: 'CREDIT_CARD' },
  GOVERNMENT_ID: { category: 'ID_CODE' },
  SSN: { category: 'ID_CODE' },
  TAX_ID: { category: 'ID_CODE' },
  PASSPORT: { category: 'ID_CODE' },
  DRIVERS_LICENSE: { category: 'ID_CODE' },
  MEDICAL_RECORD_NUMBER: { category: 'ID_CODE' },
  CUSTOMER_ID: { category: 'ID_CODE' },
  EMPLOYEE_ID: { category: 'ID_CODE' },
  ACCOUNT_NUMBER: { category: 'ID_CODE' },
  ROUTING_NUMBER: { category: 'ID_CODE' },
  SWIFT_BIC: { category: 'ID_CODE' },
  LICENSE_PLATE: { category: 'ID_CODE' },
  MAC_ADDRESS: { category: 'ID_CODE' },
  PASSWORD: { category: 'SECRET' },
  API_KEY: { category: 'SECRET' },
  PIN: { category: 'SECRET' },
  CVV: { category: 'SECRET' },
  DATE_OF_BIRTH: { category: 'DATE_OF_BIRTH' },
  AGE: { ignored: 'no policy yet: an age alone rarely identifies anyone' },
  DATE: { ignored: 'generic dates are not personal data without context' },
  TIME: { ignored: 'times of day are not personal data' },
  GENDER: { ignored: 'no policy yet; masking every pronoun-like mention would wreck readability' },
  URL: { ignored: 'no policy yet: most URLs in documents are public' },
};

// Chosen on the 'tuning' fixtures only (scripts/ner-eval.mts, NER_EVAL_SWEEP=1):
// recall was flat from 0.3 to 0.5 and fell above it, so the stricter 0.5.
const NYM_THRESHOLDS = Object.fromEntries(
  ['NAME', 'COMPANY', 'LOCATION', 'ADDRESS', 'EMAIL', 'PHONE', 'IBAN', 'CREDIT_CARD', 'ID_CODE', 'SECRET', 'DATE_OF_BIRTH'].map((c) => [c, 0.5]),
);

// Evidence gathered 2026-10-29 — see the M06-01 plan's P39 results.
export const NER_MODELS: readonly NerModelSpec[] = [
  {
    id: 'bert-base-ner',
    repo: 'Xenova/bert-base-NER',
    revision: 'main',
    license: 'MIT',
    status: 'default',
    dtype: 'q8',
    files: [{ path: 'onnx/model_quantized.onnx', bytes: 108_000_000 }],
    tokenizer: 'wordpiece',
    contextTokens: 512,
    windowTokens: 510,
    labels: ['PER', 'ORG', 'LOC', 'MISC'],
    labelMap: BERT_LABEL_MAP,
    thresholds: {},
    languages: { claimed: ['en'], tested: ['es', 'gl', 'pt', 'en'] },
    backends: { nodeOnnx: 'works', wasm: 'works', webgpu: 'untested' },
    caveat: 'English CoNLL-2003 training; only names, organisations and places map to categories.',
  },
  {
    id: 'nym-pii-small',
    repo: 'Wismut/nym-pii-multilingual-small',
    revision: '4348999cd3c2e20c49615e9af7c6bbb45b64cd85',
    license: 'MIT',
    status: 'experimental',
    subfolder: 'int8',
    modelFileName: 'model_int8',
    dtype: 'fp32',
    files: [
      { path: 'config.json', bytes: 5_688 },
      { path: 'tokenizer.json', bytes: 12_389_891 },
      { path: 'tokenizer_config.json', bytes: 573 },
      { path: 'int8/model_int8.onnx', bytes: 138_730_982 },
    ],
    tokenizer: 'sentencepiece',
    contextTokens: 8192,
    windowTokens: 512,
    labels: NYM_LABELS,
    labelMap: NYM_LABEL_MAP,
    thresholds: NYM_THRESHOLDS,
    languages: {
      claimed: ['en', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'pl', 'sv', 'cs', 'ro', 'tr', 'fi', 'da', 'el', 'ru', 'uk', 'ja', 'zh', 'ko', 'ar', 'hi'],
      tested: ['es', 'gl', 'pt', 'en'],
    },
    backends: { nodeOnnx: 'works', wasm: 'works', webgpu: 'untested' },
    caveat: 'Galician is not among the publisher\'s languages; on our 2 Galician acceptance documents recall was 94.3% against BERT\'s 99.4%. Fixtures are small and not yet reviewed by native speakers.',
  },
  {
    id: 'nym-pii-large',
    repo: 'Wismut/nym-pii-multilingual',
    revision: '0ed0242d67a30ca6a83e5f118506ff1e1daf83ca',
    license: 'MIT',
    status: 'experimental',
    subfolder: 'int8',
    modelFileName: 'model_int8',
    dtype: 'fp32',
    files: [
      { path: 'int8/config.json', bytes: 5_833 },
      { path: 'int8/tokenizer.json', bytes: 12_389_891 },
      { path: 'int8/tokenizer_config.json', bytes: 574 },
      { path: 'int8/model_int8.onnx', bytes: 375_701_127 },
    ],
    tokenizer: 'sentencepiece',
    contextTokens: 8192,
    windowTokens: 512,
    labels: NYM_LABELS,
    labelMap: NYM_LABEL_MAP,
    thresholds: NYM_THRESHOLDS,
    languages: { claimed: [], tested: ['es', 'gl', 'pt', 'en'] },
    backends: { nodeOnnx: 'works', wasm: 'works', webgpu: 'untested' },
    caveat: 'The int8 graph needs the pruned tokenizer in int8/; the stock loader reads the root 15 MB tokenizer and fails with an embedding index error. Runs only from a local package that supplies the matching tokenizer. Measured 2.4 s per 1,000 characters in WASM (target 2 s) and a 515 MB JS heap.',
  },
];

export const getNerModel = (id: string): NerModelSpec | undefined => NER_MODELS.find((model) => model.id === id);
