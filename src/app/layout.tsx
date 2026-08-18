import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { getRegionConfig, getSiteUrl } from "@/lib/regions";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: "Coupon Codes and Deals",
  description: "Browse verified deals, vouchers, and coupon codes from top advertisers.",
  icons: {
    icon: "/logo.png",
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Region is surfaced by the middleware so <html lang> matches the URL locale.
  const region = getRegionConfig(headers().get("x-region-country"));

  return (
    <html lang={region.locale} className={inter.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
