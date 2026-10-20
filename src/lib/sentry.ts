/**
 * Error reporting with Sentry, only when VITE_SENTRY_DSN is set.
 *
 * The SDK is imported dynamically so it never weighs down the main bundle: without a DSN it isn't
 * downloaded at all, and with one it loads in its own chunk right after the app starts.
 */
type SentryModule = typeof import("./sentryClient.ts");

const DSN = (import.meta.env.VITE_SENTRY_DSN as string | undefined)?.trim();

let sentry: Promise<SentryModule | null> | null = null;
let pendingUser: { id: string } | null = null;

export function initErrorReporting(): void {
  if (!DSN || sentry) return;
  sentry = import("./sentryClient.ts")
    .then(Sentry => {
      Sentry.init({
        dsn: DSN,
        environment: import.meta.env.MODE,
        integrations: [Sentry.browserTracingIntegration()],
        tracesSampleRate: 0.1,
        // Don't add tracing headers to the (cross-origin) API: they'd fail its CORS preflight.
        tracePropagationTargets: [/^\/(?!\/)/],
      });
      Sentry.setUser(pendingUser);
      return Sentry;
    })
    .catch(() => null); // blocked by an ad blocker or offline: carry on without reporting
}

/** Report an error (e.g. from the React error boundary). Logs to the console when Sentry is off. */
export function reportError(error: unknown, componentStack?: string): void {
  if (!sentry) {
    console.error(error);
    return;
  }
  void sentry.then(Sentry => {
    if (!Sentry) return console.error(error);
    Sentry.captureException(error, componentStack ? { contexts: { react: { componentStack } } } : undefined);
  });
}

/** Attach the signed-in account (id only) to later reports, or clear it on logout. */
export function setErrorReportingUser(user: { id: string } | null): void {
  pendingUser = user;
  void sentry?.then(Sentry => Sentry?.setUser(user));
}
