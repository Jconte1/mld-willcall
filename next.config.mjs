/** @type {import('next').NextConfig} */
const rawBasePath = process.env.NEXT_PUBLIC_APP_BASE_PATH || "";
const basePath =
  rawBasePath && rawBasePath !== "/" ? rawBasePath.replace(/\/+$/, "") : "";

const OLD_WILLCALL_HOST = "mld-willcall.vercel.app";
const NEW_WILLCALL_ORIGIN = "https://www.mld.com/willcall";

const nextConfig = {
  reactStrictMode: true,

  ...(basePath ? { basePath } : {}),

  async redirects() {
    return [
      // Old Vercel root:
      // https://mld-willcall.vercel.app
      // -> https://www.mld.com/willcall
      {
        source: "/",
        has: [
          {
            type: "host",
            value: OLD_WILLCALL_HOST,
          },
        ],
        destination: NEW_WILLCALL_ORIGIN,
        permanent: true,
        basePath: false,
      },

      // Old Vercel nested routes:
      // https://mld-willcall.vercel.app/staff
      // -> https://www.mld.com/willcall/staff
      //
      // https://mld-willcall.vercel.app/orders/123
      // -> https://www.mld.com/willcall/orders/123
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: OLD_WILLCALL_HOST,
          },
        ],
        destination: `${NEW_WILLCALL_ORIGIN}/:path*`,
        permanent: true,
        basePath: false,
      },
    ];
  },

  webpack(config) {
    // Allow `import url from './file.svg'` to behave like Vite.
    config.module.rules.push({
      test: /\.(svg)$/i,
      type: "asset/resource",
    });

    return config;
  },
};

export default nextConfig;