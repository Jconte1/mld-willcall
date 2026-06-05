/** @type {import('next').NextConfig} */
const rawBasePath = process.env.NEXT_PUBLIC_APP_BASE_PATH || "";
const basePath = rawBasePath && rawBasePath !== "/" ? rawBasePath.replace(/\/+$/, "") : "";

const nextConfig = {
  reactStrictMode: true,

  ...(basePath ? { basePath } : {}),

  async redirects() {
    return [
      {
        source: "/",
        destination: "https://www.mld.com/willcall",
        permanent: true,
        basePath: false,
      },
    ];
  },

  webpack(config) {
    config.module.rules.push({
      test: /\.(svg)$/i,
      type: "asset/resource",
    });
    return config;
  },
};

export default nextConfig;