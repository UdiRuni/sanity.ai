import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships WASM and must not be bundled into the server build.
  serverExternalPackages: ["@electric-sql/pglite"],
  // The SQL migrations are read from disk at runtime, so they have to be
  // copied into every server function. Without this a serverless deploy
  // cannot find ./drizzle and fails on its first database call.
  outputFileTracingIncludes: {
    "/**": ["./drizzle/**/*"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
