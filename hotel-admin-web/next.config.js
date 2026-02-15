/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Use standalone output for Docker; Vercel ignores this and uses its own build pipeline
  output: process.env.VERCEL ? undefined : 'standalone',
};

export default nextConfig;
