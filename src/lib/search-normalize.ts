/** Normalizes text by decomposing Unicode accents (NFD), stripping combining marks, and lowercasing. */
export function normalizeSearchText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
