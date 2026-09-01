/** @type {import('next').NextConfig} */
const isTauri = process.env.BUILD_TARGET === "tauri";

const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    domains: ["firebase-io.com", "fonts.googleapis.com"],
  },
  // Tauri: static export (no headers/server features)
  // Web: keep headers for security
  ...(isTauri
    ? { output: "export", images: { unoptimized: true } }
    : {
        async headers() {
          return [
            {
              source: "/(.*)",
              headers: [
                { key: "X-Content-Type-Options", value: "nosniff" },
                { key: "X-Frame-Options", value: "DENY" },
                { key: "X-XSS-Protection", value: "1; mode=block" },
                { key: "Cache-Control", value: "public, max-age=3600" },
              ],
            },
          ];
        },
      }),
};

module.exports = nextConfig;