// Public storefront slug generation (Shopix, design §1.5: public entities are
// addressed by slug, never internal uuid). Pure + deterministic; uniqueness
// within a tenant is enforced by the caller (collision-suffix loop) + the
// `(tenant_id, slug)` unique index.

const COMBINING_MARKS = /[̀-ͯ]/g;
const NON_SLUG_RUN = /[^a-z0-9]+/g;
const EDGE_DASHES = /^-+|-+$/g;

// Lowercase, strip diacritics, collapse any non-alphanumeric run to a single
// dash, trim edge dashes. Returns "" for input with no usable characters (the
// caller substitutes a fallback base).
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(NON_SLUG_RUN, "-")
    .replace(EDGE_DASHES, "");
}
