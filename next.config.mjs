/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3", "mammoth", "pdfjs-dist"],
  },
};

export default nextConfig;
