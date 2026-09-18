import type { NextConfig } from "next";

// Guarantee Cesium static assets are copied to public/cesium on every build/dev invocation
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { copyCesiumAssets } = require("./scripts/copy-cesium.js");
  copyCesiumAssets();
} catch (err) {
  console.warn("[next.config.ts] Could not run copyCesiumAssets:", err);
}

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/cesium/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

