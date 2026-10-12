/** Resolve browser and explicit locale codes against bundled locale names. */
export const resolveLocale = (requested: string | null | undefined, available: readonly string[], fallback = 'en'): string => {
  const normalize = (code: string) => code.trim().replace(/_/g, '-').toLowerCase();
  const normalized = normalize(requested ?? '');
  return available.find(code => normalize(code) === normalized)
    ?? available.find(code => normalize(code) === normalized.split('-')[0])
    ?? available.find(code => normalize(code) === normalize(fallback))
    ?? fallback;
};

/** Choose the first supported browser preference, then fall back once. */
export const resolvePreferredLocale = (requested: readonly string[], available: readonly string[], fallback = 'en'): string => {
  for (const code of requested) {
    const match = resolveLocale(code, available, '');
    if (match) return match;
  }
  return resolveLocale(fallback, available, fallback);
};
