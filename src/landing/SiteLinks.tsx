import { linkProps } from '../lib/router';

// P20: the legal links, shared by the landing, the legal pages, the wizard's
// footer and the settings menu's About section. Hosted build only — the
// portable build has no routes, so it links to the public copies instead.
const LINKS = [
  { path: '/privacy', label: 'Privacy' },
  { path: '/cookies', label: 'Cookies' },
  { path: '/terms', label: 'Terms' },
];

export function SiteLinks() {
  return (
    <>
      {LINKS.map((l) =>
        __PORTABLE__ ? (
          <a key={l.path} href={`${import.meta.env.VITE_SITE_ORIGIN}${l.path}`} target="_blank" rel="noreferrer">
            {l.label}
          </a>
        ) : (
          <a key={l.path} {...linkProps(l.path)}>
            {l.label}
          </a>
        ),
      )}
    </>
  );
}
