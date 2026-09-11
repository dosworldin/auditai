/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: [
      "mammoth",
      "pdfjs-dist",
      "tesseract.js",
      "cheerio",
      "xlsx",
      "pdfkit",
    ],
  },
};

module.exports = nextConfig;
