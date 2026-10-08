/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async redirects() {
    // Preserve ad destinations from the former /store/ URL structure.
    return [
      { source: '/store/beauty-amora-coupon-code', destination: '/au/beauty-amora', permanent: true },
      { source: '/store/code-promo-hacoo', destination: '/fr/hacoo', permanent: true },
    ];
  },
  images: {
    // Awin advertiser logos are served from various external hosts.
    // Using unoptimized keeps things simple and avoids per-host allowlists.
    unoptimized: true,
  },
};

module.exports = nextConfig;
