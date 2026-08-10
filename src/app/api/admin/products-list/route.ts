import { NextRequest, NextResponse } from "next/server";
import { getProductsFromDb, ProductQuery } from "@/lib/db/products";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const pageRaw = searchParams.get("page");
    const pageSizeRaw = searchParams.get("pageSize");
    const search = searchParams.get("search") || undefined;
    const advertiserIdRaw = searchParams.get("advertiserId");

    const page = pageRaw ? parseInt(pageRaw, 10) : 1;
    const pageSize = pageSizeRaw ? parseInt(pageSizeRaw, 10) : 24;

    const query: ProductQuery = {
      page: isNaN(page) ? 1 : page,
      pageSize: isNaN(pageSize) ? 24 : pageSize,
      search,
      advertiserId: advertiserIdRaw ? parseInt(advertiserIdRaw, 10) : undefined,
    };

    const data = await getProductsFromDb(query);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching products list:", error);
    return NextResponse.json(
      { error: "Failed to load products." },
      { status: 500 },
    );
  }
}
