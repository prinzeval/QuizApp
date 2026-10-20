// Only the pieces of the SDK we use, so the lazily loaded chunk stays small (no replay, feedback, etc.).
export { browserTracingIntegration, captureException, init, setUser } from "@sentry/react";
