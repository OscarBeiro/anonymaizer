/** Decimal megabytes, the unit download sizes are quoted in. */
export const formatMegabytes = (bytes: number): string => `${Math.round(bytes / 1e6).toLocaleString('en')} MB`;
