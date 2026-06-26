/**
 * URL-safe slug generator.
 * - Lowercases, strips accents and special chars, collapses spaces/dashes.
 * - Returns "" for empty/whitespace input.
 */
export function slugify(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/['"`´]/g, "")
    .replace(/&/g, "-and-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Returns true when the value looks like a slug already (so we don't overwrite manual edits). */
export function isSlug(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^[a-z0-9-]+$/.test(value);
}
