/** Explicitly labelled fixture products can be previewed but must not be indexed. */
export const TEST_PRODUCT_TITLE = /^\s*\[test\]/i;
export function isIndexableProductTitle(title: string): boolean {
  return Boolean(title.trim()) && !TEST_PRODUCT_TITLE.test(title);
}
