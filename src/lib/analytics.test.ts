import { describe, expect, it } from 'vitest';
import { isPublicDeploymentAt } from './analytics';

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
