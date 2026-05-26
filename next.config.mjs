/** @type {import('next').NextConfig} */
const rawBasePath = process.env.NEXT_PUBLIC_APP_BASE_PATH || "";
const basePath = rawBasePath && rawBasePath !== "/" ? rawBasePath.replace(/\/+$/, "") : "";

const nextConfig = {
  reactStrictMode: true,
  ...(basePath ? { basePath } : {}),
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
