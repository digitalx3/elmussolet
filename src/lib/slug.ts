/**
 * URL-safe slug generator and helpers (centralized).
 * Used by admin forms (products, brands, categories, attributes) so that
 * slugs are validated and normalized consistently across the platform.
 */

const DIACRITICS = /[\u0300-\u036f]/g;
const QUOTES = /['"`´’‘]/g;
const NON_SLUG = /[^a-z0-9]+/g;
const TRIM_DASHES = /^-+|-+$/g;
const MAX_LEN = 80;

/**
 * Canonical slugify: lowercases, strips accents/quotes, collapses
 * any non `[a-z0-9]` run into a single dash, trims dashes and caps length.
 * Returns "" for empty/whitespace input.
 */
export function slugify(input: string | null | undefined): string {
  if (input == null) return "";
  const raw = String(input);
  if (!raw.trim()) return "";
  return raw
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .replace(QUOTES, "")
    .replace(/&/g, "-and-")
    .replace(NON_SLUG, "-")
    .replace(TRIM_DASHES, "")
    .slice(0, MAX_LEN)
    .replace(TRIM_DASHES, "");
}

/** Returns true when the value already matches the slug shape. */
export function isSlug(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

/**
 * Live input normalizer for slug `<input>` fields.
 * Allows typing dashes mid-edit (does not trim trailing dash while typing),
 * but blocks invalid characters and enforces lowercase.
 */
export function normalizeSlugInput(value: string): string {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+/, "")
    .slice(0, MAX_LEN);
}

/**
 * Decide the next slug for a field that should auto-fill from a name,
 * while preserving manual edits done by the user.
 *
 * Rules:
 * - If the slug is empty, derive it from the new name.
 * - If the slug equals what would have been auto-generated from the
 *   previous name, follow the new name (still "auto").
 * - Otherwise the user typed it manually — keep it untouched.
 */
export function autoSlug(
  nextName: string,
  prevName: string | null | undefined,
  currentSlug: string | null | undefined,
): string {
  const current = (currentSlug ?? "").trim();
  if (!current) return slugify(nextName);
  const prevAuto = slugify(prevName ?? "");
  if (current === prevAuto) return slugify(nextName);
  return current;
}
