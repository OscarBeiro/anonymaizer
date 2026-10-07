# 08 — NER model candidates (research only)

Researched 2026-10-07 from Hugging Face model cards and file trees. Nothing
was downloaded or tested; scores are the model authors' own claims.

`src/workers/ner.worker.ts` loads `Xenova/bert-base-NER` (P7d): English only,
PER/ORG/LOC/MISC. Spanish and Galician names go unseen. A replacement must
run in transformers.js (ONNX), be MIT/Apache-compatible, and make no network
call beyond the opt-in model download (hard rules 2–3).

| Model | Licence | Languages | Labels | Browser files | Size | Reported score |
|---|---|---|---|---|---|---|
| **Wismut/nym-pii-multilingual** | MIT | ~23 incl. ES | 40 PII types | ONNX + `tokenizer.json` | int8 359 MB | real-text F1 79.1 |
| lBroth/nullpii (GLiNER multi-PII) | Apache-2.0 | 6 incl. ES | ~14 PII | ONNX, GLiNER layout | int8 349 MB | macro F1 0.778 (OOD) |
| riidact/ner-multilingual | **CC-BY-NC-4.0** | 103 | PER/LOC/ORG | ONNX, transformers.js-ready | q 178 MB | PER F1 ≥ 0.80 in 84 langs |
| gpancardo/beto-pii | MIT | ES only | 24 PII | **no ONNX** | 110M params | span F1 0.952 (synthetic) |
| desert-ant-labs/redact | source-available | 27 EU | 20 PII | **TFLite/Core ML only** | 24 MB | — |

None lists Galician explicitly.

### [ ] N1 — Spike `nym-pii-multilingual`

The best fit on paper: MIT, Spanish, a PII label set that overlaps our
categories. About 3.5× the current ~104 MB. Check first:

- the ONNX lives in an `int8/` folder, not `onnx/model_quantized.onnx` —
  transformers.js may need a local re-layout;
- it is ModernBERT, which needs a transformers.js version that supports it.

Spike: load it in the worker, run the Spanish/English fixtures against
bert-base-NER, map its labels onto `src/core/ner.ts`.

### Fallbacks

- **nullpii** via the `gliner` npm package — a second runtime; `onnxruntime-web`
  WASM must be bundled, not fetched from a CDN.
- **riidact/ner-multilingual** — drop-in, but non-commercial licence.
- beto-pii and redact are out: no ONNX build.

Sources: [nym-pii-multilingual](https://huggingface.co/Wismut/nym-pii-multilingual),
[nullpii](https://huggingface.co/lBroth/nullpii),
[ner-multilingual](https://huggingface.co/riidact/ner-multilingual),
[beto-pii](https://huggingface.co/gpancardo/beto-pii),
[redact](https://huggingface.co/desert-ant-labs/redact),
[gliner (npm)](https://npmjs.com/package/gliner).
