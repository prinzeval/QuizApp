import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/dropzone/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { App } from "./App.tsx";
import { cssVariablesResolver, theme } from "./theme.ts";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver} defaultColorScheme="light">
      <Notifications position="bottom-right" limit={3} />
      <App />
    </MantineProvider>
  </StrictMode>,
);
