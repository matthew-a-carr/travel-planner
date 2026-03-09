import * as Sentry from "@sentry/nextjs";

Sentry.init({
	dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
	environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
	release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,

	// Conservative trace sample rate to stay within free tier.
	// Production: 5% of requests; elsewhere: errors only (no tracing).
	tracesSampleRate:
		process.env.NEXT_PUBLIC_VERCEL_ENV === "production" ? 0.05 : 0,

	// Replay is off by default — enable later if quota/budget allows.
	replaysSessionSampleRate: 0,
	replaysOnErrorSampleRate: 0,

	debug: false,
});
