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
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  verification: {
    google: "1AmY1d7beFPQ4YfWB3io_5QczTIInMCbim4HfpH0c_A",
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
      <head>
        {/* Google tag (gtag.js) */}
        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-PDP7P7BTLT"
        />
        <script
          id="google-tag-init"
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-PDP7P7BTLT');`,
          }}
        />

        {/* Google Tag Manager */}
        <script
          id="gtm-init"
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-NSRTJD3L');`,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-NSRTJD3L"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        {children}
      </body>
    </html>
  );
}
