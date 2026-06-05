/** @type {import('next').NextConfig} */
const rawBasePath = process.env.NEXT_PUBLIC_APP_BASE_PATH || "";
const basePath =
  rawBasePath && rawBasePath !== "/" ? rawBasePath.replace(/\/+$/, "") : "";

const rawAssetPrefix = process.env.NEXT_PUBLIC_APP_ASSET_PREFIX || "";
const assetPrefix =
  rawAssetPrefix && rawAssetPrefix !== "/"
    ? rawAssetPrefix.replace(/\/+$/, "")
    : "";

const nextConfig = {
  reactStrictMode: true,

  ...(basePath ? { basePath } : {}),
  ...(assetPrefix ? { assetPrefix } : {}),

  webpack(config) {
    config.module.rules.push({
      test: /\.(svg)$/i,
      type: "asset/resource",
    });

    return config;
  },
};

export default nextConfig;