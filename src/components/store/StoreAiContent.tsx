import { loadStoreAiContent } from "@/lib/storeData";
import StoreAiSections from "@/components/store/StoreAiSections";

/**
 * Async server component: loads (or first-time generates) the AI store-page
 * content. Rendered inside a <Suspense> boundary so the page streams a skeleton
 * until this resolves.
 */
export default async function StoreAiContent({
  slug,
  country,
  storeName,
}: {
  slug: string;
  country?: string;
  storeName: string;
}) {
  const content = await loadStoreAiContent(slug, country);
  if (!content) return null;
  return <StoreAiSections content={content} storeName={storeName} />;
}
