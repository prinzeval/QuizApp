import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/dropzone/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { App } from "./App.tsx";
import { AppErrorBoundary } from "./components/AppErrorBoundary.tsx";
import { initErrorReporting } from "./lib/sentry.ts";
import { cssVariablesResolver, theme } from "./theme.ts";

// No-op unless VITE_SENTRY_DSN is set; the SDK loads in its own chunk.
initErrorReporting();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver} defaultColorScheme="light">
      <Notifications position="bottom-right" limit={3} />
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </MantineProvider>
  </StrictMode>,
);
