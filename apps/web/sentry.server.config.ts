import * as Sentry from "@sentry/nextjs";

Sentry.init({
	dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
	environment: process.env.VERCEL_ENV ?? "development",
	release: process.env.VERCEL_GIT_COMMIT_SHA,

	// Conservative trace sample rate to stay within free tier.
	tracesSampleRate: process.env.VERCEL_ENV === "production" ? 0.05 : 0,

	debug: false,
});
