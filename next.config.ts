import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Hasta 6 JPEG ya comprimidos en el cliente (tope 2 MiB cada uno).
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
