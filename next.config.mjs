/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
