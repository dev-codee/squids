import type { Metadata } from "next";
import SavedProductsClient from "./SavedProductsClient";
export const metadata: Metadata = { title: "Saved products", robots: { index: false, follow: true } };
export default function SavedPage() { return <SavedProductsClient />; }
