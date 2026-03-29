import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

const sharedConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      "@remotion/renderer",
      "@remotion/bundler",
      "@remotion/cli",
    ],
  },
};

export default function nextConfig(phase) {
  return {
    ...sharedConfig,
    // Keep `next dev` from clobbering the production build output.
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
  };
}
