import PostalMime, { type Address, type Email } from 'postal-mime';
import type { ParsedDocument } from '../../core/parsers';
import { convertHtmlToMarkdown } from '../htmlToMarkdown';

// .eml via postal-mime (M3/P8g).
//
// **Not letterparser or eml-parse-js**, which the plan named: letterparser was
// last published in 2024 and eml-parse-js is on a beta. postal-mime 3.0.0 is
// current (2026), has **zero dependencies**, audits clean, ships types, is
// written for the browser, and contains no `fetch`/`XMLHttpRequest`/`Worker`
// anywhere in its tree — checked, because hard rule 3 says a dependency may
// not make a network request. Unlike .xlsx at P8f there was no reason to
// hand-roll: MIME is genuinely nasty (nested multiparts, RFC 2047
// encoded-words, the charset zoo, base64 split across line breaks) and here a
// maintained zero-dependency library exists.
//
// **The header block is the point of this parser, not decoration.** From/To/
// Cc/Subject/Date are the densest PII in an email — every one of them is a
// name or an address — and a body-only extraction would quietly drop all of
// it. So the headers are rendered into the Markdown, where the detectors run
// over them like any other text.

const formatAddress = (address: Address): string => {
  // postal-mime models a group ("Undisclosed recipients:;") as an address with
  // a `group` array and no `address` of its own.
  if ('group' in address && Array.isArray(address.group)) {
    return `${address.name}: ${address.group.map(formatAddress).join(', ')}`;
  }
  return address.name ? `${address.name} <${address.address}>` : (address.address ?? '');
};

const formatAddresses = (addresses: Address[] | undefined): string =>
  (addresses ?? []).map(formatAddress).join(', ');

// Plain `Label: value` lines, deliberately **not** `**Label:**`. Emphasis
// markers are not cosmetic here: `*` and `_` are in MASK_GLYPHS
// (src/core/detectors.ts), so `**From:**` is a two-character mask run followed
// by four alphanumerics — a textbook MASKED_ID. Caught in a live browser run,
// where every header label came back as `[[MASKED_ID_001]]:**`. The same rule
// binds any parser that generates Markdown: no emphasis characters, ever.
const headerBlock = (email: Email): string => {
  const lines: string[] = [];
  const add = (label: string, value: string): void => {
    if (value.trim() !== '') lines.push(`${label}: ${value}`);
  };

  add('From', email.from ? formatAddress(email.from) : '');
  add('To', formatAddresses(email.to));
  add('Cc', formatAddresses(email.cc));
  add('Bcc', formatAddresses(email.bcc));
  add('Reply-To', formatAddresses(email.replyTo));
  add('Subject', email.subject ?? '');
  add('Date', email.date ?? '');

  return lines.join('\n');
};

export const parse = async (bytes: ArrayBuffer, fileName: string): Promise<ParsedDocument> => {
  let email: Email;
  try {
    email = await PostalMime.parse(bytes);
  } catch (cause) {
    throw new Error(`Could not read "${fileName}" — it does not look like an email message.`, { cause });
  }

  // postal-mime accepts almost anything and returns an empty shell rather than
  // throwing, so "not an email" has to be judged from the result: no headers
  // and no body means the file was never a message.
  if (!email.from && !email.subject && !email.text && !email.html && (email.to ?? []).length === 0) {
    throw new Error(`Could not read "${fileName}" — it does not look like an email message.`);
  }

  const warnings: string[] = [];
  const blocks = [headerBlock(email)].filter((block) => block !== '');

  if (email.text) {
    // text/plain is preferred over text/html whenever both exist: it is what
    // the sender wrote, and it needs no conversion that could perturb the
    // offsets the detectors run over.
    blocks.push(email.text.trim());
  } else if (email.html) {
    blocks.push(convertHtmlToMarkdown(email.html).trim());
  } else {
    warnings.push('This message has no message body — only headers.');
  }

  const attachments = email.attachments ?? [];
  if (attachments.length > 0) {
    const names = attachments.map((attachment, index) => attachment.filename || `unnamed ${index + 1}`);
    warnings.push(
      `${attachments.length} attachment(s) were dropped: ${names.join(', ')}. ` +
        'Their contents were not read, so nothing inside them has been detected or masked — ' +
        'and note that a filename can itself be revealing.',
    );
  }

  return {
    markdown: blocks.join('\n\n'),
    format: 'eml',
    ...(warnings.length > 0 ? { warnings } : {}),
  };
};
