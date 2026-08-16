/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    // Awin advertiser logos are served from various external hosts.
    // Using unoptimized keeps things simple and avoids per-host allowlists.
    unoptimized: true,
  },
};

module.exports = nextConfig;
