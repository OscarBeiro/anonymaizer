import { describe, expect, it } from 'vitest';
import { isPublicDeploymentAt, modelDownloadAllowedAt } from './analytics';

const PROD = 'anonymaizer.example.com';
const at = (href: string) => {
  const u = new URL(href);
  return { protocol: u.protocol, hostname: u.hostname };
};

describe('isPublicDeploymentAt', () => {
  it('allows only https on the production hostname, with the build flag on', () => {
    expect(isPublicDeploymentAt(at(`https://${PROD}/app`), true, PROD)).toBe(true);
  });

  it('refuses when the build flag is off, even on the real hostname', () => {
    expect(isPublicDeploymentAt(at(`https://${PROD}/`), false, PROD)).toBe(false);
  });

  it.each([
    ['a file:// page (portable build)', 'file:///home/me/anonymaizer/index.html'],
    ['localhost', 'https://localhost:5173/'],
    ['plain http on the real hostname', `http://${PROD}/`],
    ['a LAN IP', 'https://192.168.1.20/'],
    ['a lookalike hostname', `https://${PROD}.evil.com/`],
    ['a subdomain (e.g. a preview deployment)', `https://preview.${PROD}/`],
    ['a self-hosted copy', 'https://intranet.corp.local/anonymaizer/'],
  ])('refuses %s', (_label, href) => {
    expect(isPublicDeploymentAt(at(href), true, PROD)).toBe(false);
  });

  it('refuses when no production hostname is configured', () => {
    expect(isPublicDeploymentAt(at('https://x.test/'), true, '')).toBe(false);
  });
});

import { visitEvent } from './analytics';
it('allowlists constant routes and rejects queries, fragments and document-derived routes', () => {
  expect(visitEvent('/app')).toEqual({ version: 1, event: 'visit', route: '/app' });
  expect(visitEvent('/app?file=private.pdf')).toBeNull();
  expect(visitEvent('/app#private')).toBeNull();
  expect(visitEvent('/private-document')).toBeNull();
});

describe('modelDownloadAllowedAt (hard rule 2)', () => {
  it('allows the public HTTPS deployment only', () => {
    expect(modelDownloadAllowedAt(at(`https://${PROD}/app`), false, PROD)).toBe(true);
  });

  it.each([
    'http://localhost:5173/app',
    'http://127.0.0.1:4173/app',
    'file:///home/user/anonymaizer.html',
    'https://self-hosted.example.org/app',
    `http://${PROD}/app`,
    `https://preview.${PROD}/app`,
  ])('refuses %s', (href) => {
    expect(modelDownloadAllowedAt(at(href), false, PROD)).toBe(false);
  });

  it('refuses the portable build everywhere, even with the dev override', () => {
    expect(modelDownloadAllowedAt(at(`https://${PROD}/app`), true, PROD)).toBe(false);
    expect(modelDownloadAllowedAt(at('http://localhost:5173/app'), true, PROD, true)).toBe(false);
  });

  it('the dev override allows a non-portable local dev server', () => {
    expect(modelDownloadAllowedAt(at('http://localhost:5173/app'), false, PROD, true)).toBe(true);
  });
});
