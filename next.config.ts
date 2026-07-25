import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Document uploads go through a route handler, but keep headroom for
      // form posts that carry a file.
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
