import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button, Center, Group, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconMoodSad, IconRefresh } from "@tabler/icons-react";
import { reportError } from "../lib/sentry.ts";

/** Catches a crash anywhere in the app, reports it, and shows a friendly page instead of a blank screen. */
export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, info.componentStack ?? undefined);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <Center mih="100dvh" px="md" py={48} bg="var(--app-canvas)">
        <Stack align="center" gap="md" maw={420} ta="center" role="alert">
          <ThemeIcon size={64} radius="xl" variant="light" color="clay">
            <IconMoodSad size={34} stroke={1.6} />
          </ThemeIcon>
          <Title order={1} fz={28}>
            Something went wrong
          </Title>
          <Text c="dimmed">
            Sorry, this page hit an unexpected error. Reloading usually fixes it, and your rooms and quizzes are safe.
          </Text>
          <Group gap="sm" mt="xs" justify="center">
            <Button leftSection={<IconRefresh size={18} />} onClick={() => window.location.reload()}>
              Reload page
            </Button>
            <Button variant="default" component="a" href="/">
              Go home
            </Button>
          </Group>
        </Stack>
      </Center>
    );
  }
}
