import * as Sentry from "@sentry/nextjs";

Sentry.init({
	dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
	environment: process.env.VERCEL_ENV ?? "development",
	release: process.env.VERCEL_GIT_COMMIT_SHA,

	// No tracing on edge runtime — errors only.
	tracesSampleRate: 0,

	debug: false,
});
