import type { NextConfig } from "next";
import path from "path";

// Guarantee Cesium static assets are copied to public/cesium on every build/dev invocation
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { copyCesiumAssets } = require("./scripts/copy-cesium.js");
  copyCesiumAssets();
} catch (err) {
  console.warn("[next.config.ts] Could not run copyCesiumAssets:", err);
}

const stubPath = path.resolve(__dirname, "src/lib/globe/spz-loader-stub.js");

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      "@spz-loader/core": "./src/lib/globe/spz-loader-stub.js",
    },
  },
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@spz-loader/core": stubPath,
    };
    return config;
  },
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

