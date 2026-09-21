// .eml fixtures are plain text, so they are written as template literals
// rather than built by a helper — a MIME message *is* its source, and the
// point of a test here is usually the exact bytes on the wire (a soft line
// break, a `=E1`, a boundary).
//
// CRLF matters: RFC 5322 line endings are \r\n, and a parser that only works
// on \n would pass every test written with bare newlines and then fail on
// every real message. `crlf` is applied to each fixture below.

const crlf = (text: string): string => text.replace(/\r?\n/g, '\r\n');

export const toBytes = (text: string): ArrayBuffer => new TextEncoder().encode(text).buffer;

/** UTF-8 body, quoted-printable, with accented Spanish and a soft line break. */
export const QUOTED_PRINTABLE_EML = crlf(`From: Laura Ferreiro <laura@acme.example>
To: Mario Prieto <mario.prieto@example.com>
Subject: =?UTF-8?Q?Revisi=C3=B3n_del_expediente?=
Date: Fri, 18 Sep 2026 13:42:10 +0200
MIME-Version: 1.0
Content-Type: text/plain; charset="UTF-8"
Content-Transfer-Encoding: quoted-printable

Estimado Mario,

La evaluaci=C3=B3n psicol=C3=B3gica se realiz=C3=B3 el mi=C3=A9rcoles. El n=
=C3=BAmero de expediente es EV-014/2026.

Un saludo,
Laura
`);

/** Latin-1 body: the charset is declared, and the bytes are not UTF-8. */
export const LATIN1_EML_BYTES = (): ArrayBuffer => {
  const headers = crlf(`From: Laura Ferreiro <laura@acme.example>
To: mario.prieto@example.com
Subject: Evaluacion
Content-Type: text/plain; charset="ISO-8859-1"
Content-Transfer-Encoding: 8bit

`);
  // "La evaluación se realizó el miércoles." in latin-1 — every accented
  // character is one byte, which is precisely what would come out as mojibake
  // if the declared charset were ignored and the body read as UTF-8.
  const body = 'La evaluación se realizó el miércoles.\r\n';

  const bytes = new Uint8Array(headers.length + body.length);
  for (let i = 0; i < headers.length; i += 1) bytes[i] = headers.charCodeAt(i);
  for (let i = 0; i < body.length; i += 1) bytes[headers.length + i] = body.charCodeAt(i) & 0xff;
  return bytes.buffer;
};

/** multipart/alternative: a plain part and an HTML part saying different things. */
export const MULTIPART_ALTERNATIVE_EML = crlf(`From: Laura Ferreiro <laura@acme.example>
To: mario.prieto@example.com
Subject: Dos versiones
MIME-Version: 1.0
Content-Type: multipart/alternative; boundary="frontera"

--frontera
Content-Type: text/plain; charset="UTF-8"

Version en texto plano.
--frontera
Content-Type: text/html; charset="UTF-8"

<html><body><p>Version en <strong>HTML</strong>.</p></body></html>
--frontera--
`);

/** HTML only: the converter has to run, and headings/lists must survive. */
export const HTML_ONLY_EML = crlf(`From: Laura Ferreiro <laura@acme.example>
To: mario.prieto@example.com
Subject: Solo HTML
MIME-Version: 1.0
Content-Type: text/html; charset="UTF-8"

<html><body><h1>Informe</h1><p>Contacto: <strong>Mario Prieto Casal</strong></p>
<ul><li>DNI 45678912S</li></ul></body></html>
`);

/** An attachment, which is dropped: only its name should reach the warning. */
export const WITH_ATTACHMENT_EML = crlf(`From: Laura Ferreiro <laura@acme.example>
To: mario.prieto@example.com
Subject: Con adjunto
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="frontera"

--frontera
Content-Type: text/plain; charset="UTF-8"

Te adjunto el informe.
--frontera
Content-Type: application/pdf; name="informe confidencial.pdf"
Content-Disposition: attachment; filename="informe confidencial.pdf"
Content-Transfer-Encoding: base64

JVBERi0xLjQK
--frontera--
`);

/** Every recipient header populated, including Cc and a base64 body. */
export const FULL_HEADERS_EML = crlf(`From: "Ferreiro Iglesias, Laura" <laura@acme.example>
To: Mario Prieto <mario.prieto@example.com>, Ana Soto <ana@example.com>
Cc: Direccion <direccion@acme.example>
Subject: Expediente EV-014/2026
Date: Fri, 18 Sep 2026 13:42:10 +0200
MIME-Version: 1.0
Content-Type: text/plain; charset="UTF-8"
Content-Transfer-Encoding: base64

Q3VlcnBvIGRlbCBtZW5zYWplLg==
`);
