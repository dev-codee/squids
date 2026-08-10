import { NextRequest, NextResponse } from "next/server";
import { getStoreMetasFromDb, StoreMetaQuery } from "@/lib/db/storeMeta";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const pageRaw = searchParams.get("page");
    const pageSizeRaw = searchParams.get("pageSize");
    const search = searchParams.get("search") || undefined;

    const page = pageRaw ? parseInt(pageRaw, 10) : 1;
    const pageSize = pageSizeRaw ? parseInt(pageSizeRaw, 10) : 24;

    const query: StoreMetaQuery = {
      page: isNaN(page) ? 1 : page,
      pageSize: isNaN(pageSize) ? 24 : pageSize,
      search,
    };

    const data = await getStoreMetasFromDb(query);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching store meta list:", error);
    return NextResponse.json(
      { error: "Failed to load store meta." },
      { status: 500 },
    );
  }
}
