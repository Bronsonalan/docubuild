/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@remotion/renderer', '@remotion/bundler', '@remotion/cli'],
  },
};

export default nextConfig;
