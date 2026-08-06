import { redirect } from "next/navigation";
import AdvertiserDetailClient from "./AdvertiserDetailClient";

export const dynamic = "force-dynamic";

const CODE_RE = /^[A-Za-z]{2}$/;

/**
 * Advertiser detail page at /{country}/advertisers/{id}.
 * Shows advertiser info and their active deals.
 */
export default function AdvertiserDetailPage({
  params,
}: {
  params: { country: string; slug: string };
}) {
  const { country: rawCountry, slug: rawSlug } = params;

  if (!CODE_RE.test(rawCountry)) {
    redirect("/");
  }

  if (rawCountry !== rawCountry.toLowerCase()) {
    redirect(`/${rawCountry.toLowerCase()}/advertisers/${rawSlug}`);
  }

  const advertiserId = Number.parseInt(rawSlug, 10);
  if (Number.isNaN(advertiserId)) {
    redirect(`/${rawCountry.toLowerCase()}`);
  }

  return (
    <AdvertiserDetailClient
      country={rawCountry.toUpperCase()}
      advertiserId={advertiserId}
    />
  );
}
