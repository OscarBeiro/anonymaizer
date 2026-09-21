/**
 * Synthesized stand-in for a real psychological evaluation report that
 * surfaced 12 M1 detection failures in a field review. Every structural
 * shape from that report is reproduced here with invented names, numbers and
 * dates — the source document is never committed, since it names real,
 * identifiable people.
 *
 * Shapes exercised: a masked DNI, a label-anchored professional membership
 * code ("Colegiada"), a label-anchored case reference ("Expediente"), a
 * paragraph of legal citations, a professional-title line, and a digital
 * signature block with an ALL-CAPS surname-first name plus a timestamp.
 *
 * D1 — do NOT "fix" the signature block's `33112244F` by correcting it. Its
 * check letter is wrong (`H` is the right one) and that is now deliberate:
 * until D1 it meant this fixture's own DNI was never once detected by the
 * suite that uses the fixture as a bench, which is exactly the failure D1
 * exists to catch. The valid DNI on the last line is the companion case, so
 * both paths stay covered.
 */
export const CLINICAL_REPORT_FIXTURE = `Informe psicológico. Expediente EV-014/2026.
D. Mario Prieto Casal, con DNI 45****78Q, fue evaluado por Laura Ferreiro, Psicóloga General Sanitaria, Colegiada T-09310.
Se aplica la Ley de Prevención de Riesgos Laborales y el Real Decreto Legislativo 1/2013, Texto Refundido, así como la Directiva 2000/78/CE y la Convención Internacional sobre los Derechos de las Personas con Discapacidad.
Firmado digitalmente por FERREIRO IGLESIAS LAURA - 33112244F Fecha: 2026.09.18 13:42:10 +02'00'
Laura Ferreiro Iglesias
Tutor legal: Anxo Nogueira Vidal, DNI 12345678Z.`;
