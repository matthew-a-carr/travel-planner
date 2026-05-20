import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @travel-planner/shared is shipped as source-only TypeScript via the
  // pnpm workspace symlink. Next doesn't transpile node_modules by default;
  // this opt-in lets the runtime + build see the package's .ts source.
  // See SPEC-005 §7.
  transpilePackages: ["@travel-planner/shared"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  // Suppress noisy SDK logs outside CI to keep local dev output clean.
  silent: !process.env.CI,

  // Upload source maps for dependencies and Next.js internals too.
  widenClientFileUpload: true,

  // Source maps are uploaded then automatically deleted from the build
  // output (deleteSourcemapsAfterUpload defaults to true) so they are
  // never served to end users.

  // Sentry org/project are read from SENTRY_ORG and SENTRY_PROJECT env vars
  // automatically by the Sentry webpack plugin.
});

