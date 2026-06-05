/** @type {import('next').NextConfig} */
const rawBasePath = process.env.NEXT_PUBLIC_APP_BASE_PATH || "";
const basePath =
  rawBasePath && rawBasePath !== "/" ? rawBasePath.replace(/\/+$/, "") : "";
const canonicalWillCallUrl = "https://www.mld.com/willcall";
const legacyHost = "mld-willcall.vercel.app";

const nextConfig = {
  reactStrictMode: true,

  ...(basePath ? { basePath } : {}),

  async redirects() {
    const legacyHostRule = [{ type: "host", value: legacyHost }];

    return [
      {
        source: "/",
        has: legacyHostRule,
        destination: canonicalWillCallUrl,
        permanent: false,
        basePath: false,
      },
      {
        source: "/willcall",
        has: legacyHostRule,
        destination: canonicalWillCallUrl,
        permanent: false,
        basePath: false,
      },
      {
        source: "/willcall/:path*",
        has: legacyHostRule,
        destination: `${canonicalWillCallUrl}/:path*`,
        permanent: false,
        basePath: false,
      },
      {
        source: "/:path*",
        has: legacyHostRule,
        destination: `${canonicalWillCallUrl}/:path*`,
        permanent: false,
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
