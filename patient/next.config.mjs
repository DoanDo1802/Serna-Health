/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'd3ql15awrosklt.cloudfront.net',
      },
      {
        protocol: 'https',
        hostname: 'wolverineworldwide.com',
      },
    ],
  },
};

export default nextConfig;
