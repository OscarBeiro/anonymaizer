import { COPYRIGHT } from '../site';

// S5: a plain outbound link — nothing is fetched, so hard rule 2 holds on file:// too.
export const Copyright = () => (
  <a href={COPYRIGHT.url} target="_blank" rel="noopener noreferrer">
    {COPYRIGHT.label}
  </a>
);
