import { describe, expect, it } from 'vitest';
import {
  FULL_HEADERS_EML,
  HTML_ONLY_EML,
  LATIN1_EML_BYTES,
  MULTIPART_ALTERNATIVE_EML,
  QUOTED_PRINTABLE_EML,
  WITH_ATTACHMENT_EML,
  toBytes,
} from './__fixtures__/eml';
import { parse } from './eml';

describe('.eml parser', () => {
  it('writes headers as plain lines, never emphasised: * is a mask glyph', async () => {
    const { markdown } = await parse(toBytes(FULL_HEADERS_EML), 'm.eml');
    // `**From:**` reads to the detectors as a masked ID, which a live browser
    // run duly turned into `[[MASKED_ID_001]]:**`.
    expect(markdown).not.toContain('**');
  });

  it('puts the headers in the text, where the densest PII lives', async () => {
    const { markdown, format } = await parse(toBytes(FULL_HEADERS_EML), 'm.eml');
    expect(format).toBe('eml');
    expect(markdown).toContain('From: Ferreiro Iglesias, Laura <laura@acme.example>');
    expect(markdown).toContain('To: Mario Prieto <mario.prieto@example.com>, Ana Soto <ana@example.com>');
    expect(markdown).toContain('Cc: Direccion <direccion@acme.example>');
    expect(markdown).toContain('Subject: Expediente EV-014/2026');
    expect(markdown).toContain('Date: ');
  });

  it('decodes a base64 body', async () => {
    const { markdown } = await parse(toBytes(FULL_HEADERS_EML), 'm.eml');
    expect(markdown).toContain('Cuerpo del mensaje.');
  });

  it('decodes a quoted-printable body with accented Spanish, soft breaks included', async () => {
    const { markdown } = await parse(toBytes(QUOTED_PRINTABLE_EML), 'qp.eml');
    expect(markdown).toContain('La evaluación psicológica se realizó el miércoles.');
    // A soft line break (`=` at end of line) must vanish, not split the word.
    expect(markdown).toContain('El número de expediente es EV-014/2026.');
    expect(markdown).not.toContain('=C3');
  });

  it('decodes an RFC 2047 encoded-word subject', async () => {
    const { markdown } = await parse(toBytes(QUOTED_PRINTABLE_EML), 'qp.eml');
    expect(markdown).toContain('Subject: Revisión del expediente');
    expect(markdown).not.toContain('=?UTF-8?Q?');
  });

  it('honours a declared latin-1 charset instead of producing mojibake', async () => {
    const { markdown } = await parse(LATIN1_EML_BYTES(), 'l1.eml');
    expect(markdown).toContain('La evaluación se realizó el miércoles.');
    expect(markdown).not.toContain('Ã');
  });

  it('prefers the plain part of a multipart/alternative message', async () => {
    const { markdown } = await parse(toBytes(MULTIPART_ALTERNATIVE_EML), 'alt.eml');
    expect(markdown).toContain('Version en texto plano.');
    expect(markdown).not.toContain('Version en HTML.');
  });

  it('converts the HTML part when that is all there is', async () => {
    const { markdown } = await parse(toBytes(HTML_ONLY_EML), 'html.eml');
    expect(markdown).toContain('# Informe');
    expect(markdown).toContain('Contacto: Mario Prieto Casal');
    expect(markdown).toContain('-   DNI 45678912S');
    // Through the shared converter, so no emphasis markers reach the detectors.
    expect(markdown).not.toContain('**Mario');
  });

  it('warns listing a dropped attachment by name', async () => {
    const { markdown, warnings } = await parse(toBytes(WITH_ATTACHMENT_EML), 'att.eml');
    expect(markdown).toContain('Te adjunto el informe.');
    expect(warnings?.join(' ')).toContain('informe confidencial.pdf');
    expect(warnings?.join(' ')).toMatch(/attachment/i);
  });

  it('leaves warnings undefined for a plain message with no attachments', async () => {
    const { warnings } = await parse(toBytes(QUOTED_PRINTABLE_EML), 'qp.eml');
    expect(warnings).toBeUndefined();
  });

  it('carries header and body PII through to detection', async () => {
    const { markdown } = await parse(toBytes(QUOTED_PRINTABLE_EML), 'qp.eml');
    expect(markdown).toContain('laura@acme.example');
    expect(markdown).toContain('mario.prieto@example.com');
  });

  it('warns and returns only headers when the message has no body at all', async () => {
    const headersOnly = 'From: a@example.com\r\nSubject: Vacio\r\n\r\n';
    const { markdown, warnings } = await parse(toBytes(headersOnly), 'vacio.eml');
    expect(markdown).toContain('Subject: Vacio');
    expect(warnings?.join(' ')).toMatch(/no message body/i);
  });

  it('throws an error naming the file when the bytes are not a message', async () => {
    await expect(parse(toBytes('just some words'), 'roto.eml')).rejects.toThrow(/roto\.eml/);
  });
});
