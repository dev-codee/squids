import { NextRequest, NextResponse } from "next/server";
import {
  createProduct,
  updateProduct,
  deleteProduct,
  getNextProductId,
} from "@/lib/db/products";

export const dynamic = "force-dynamic";

function toNumberOrNull(val: any): number | null {
  if (val === null || val === undefined || val === "") return null;
  const num = Number(val);
  return isNaN(num) ? null : num;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.advertiserId) {
      return NextResponse.json({ error: "Advertiser ID is required." }, { status: 400 });
    }
    if (!body.title) {
      return NextResponse.json({ error: "Title is required." }, { status: 400 });
    }

    const id = body.id && !isNaN(Number(body.id))
      ? Number(body.id)
      : await getNextProductId();

    const product = {
      id,
      advertiserId: Number(body.advertiserId),
      title: body.title,
      category: body.category || null,
      imageUrl: body.imageUrl || null,
      originalPrice: toNumberOrNull(body.originalPrice),
      salePrice: toNumberOrNull(body.salePrice),
      discountPercentage: toNumberOrNull(body.discountPercentage),
      rating: toNumberOrNull(body.rating),
      reviewsCount: toNumberOrNull(body.reviewsCount),
      inStock: body.inStock !== false, // default true
      trackingUrl: body.trackingUrl || null,
    };

    const created = await createProduct(product);
    return NextResponse.json({ success: true, product: created });
  } catch (error) {
    console.error("Error creating product:", error);
    return NextResponse.json({ error: "Failed to create product." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const id = toNumberOrNull(body.id);

    if (!id) {
      return NextResponse.json({ error: "Product ID is required." }, { status: 400 });
    }

    const productData = {
      ...(body.advertiserId && { advertiserId: Number(body.advertiserId) }),
      ...(body.title && { title: body.title }),
      ...(body.category !== undefined && { category: body.category || null }),
      ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl || null }),
      ...(body.originalPrice !== undefined && { originalPrice: toNumberOrNull(body.originalPrice) }),
      ...(body.salePrice !== undefined && { salePrice: toNumberOrNull(body.salePrice) }),
      ...(body.discountPercentage !== undefined && { discountPercentage: toNumberOrNull(body.discountPercentage) }),
      ...(body.rating !== undefined && { rating: toNumberOrNull(body.rating) }),
      ...(body.reviewsCount !== undefined && { reviewsCount: toNumberOrNull(body.reviewsCount) }),
      ...(body.inStock !== undefined && { inStock: Boolean(body.inStock) }),
      ...(body.trackingUrl !== undefined && { trackingUrl: body.trackingUrl || null }),
    };

    const success = await updateProduct(id, productData);
    if (!success) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating product:", error);
    return NextResponse.json({ error: "Failed to update product." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const idStr = searchParams.get("id");
    if (!idStr) {
      return NextResponse.json({ error: "Product ID is required." }, { status: 400 });
    }

    const id = parseInt(idStr, 10);
    const success = await deleteProduct(id);

    if (!success) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting product:", error);
    return NextResponse.json({ error: "Failed to delete product." }, { status: 500 });
  }
}
