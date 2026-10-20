import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Anchor, Box, Container, Divider, Group, Image, Text, Title, Typography } from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";

export const LEGAL_LAST_UPDATED = "October 20, 2026";
export const SUPPORT_EMAIL = "support@smartquiz.app";

/** A calm, readable page for the privacy policy and terms (public, works logged in or out). */
export function LegalLayout({ title, intro, children }: { title: string; intro: ReactNode; children: ReactNode }) {
  return (
    <Box mih="100dvh" bg="var(--app-canvas)">
      <Container size={760} px="md" py={{ base: 24, sm: 40 }}>
        <Group justify="space-between" gap="sm" mb={{ base: 28, sm: 40 }}>
          <Anchor component={Link} to="/" underline="never" c="inherit" aria-label="SmartQuiz home">
            <Group gap={10} wrap="nowrap">
              <Image src="/icons/icon-192.png" alt="" w={28} h={28} radius="md" />
              <Text fw={700}>SmartQuiz</Text>
            </Group>
          </Anchor>
          <Anchor component={Link} to="/" size="sm" fw={500}>
            <Group gap={4} wrap="nowrap">
              <IconArrowLeft size={16} />
              Back to the app
            </Group>
          </Anchor>
        </Group>

        <Box component="article" bg="var(--mantine-color-body)" p={{ base: "lg", sm: 48 }} bd="1px solid var(--mantine-color-default-border)" style={{ borderRadius: "var(--mantine-radius-lg)" }}>
          <Title order={1} fz={{ base: 30, sm: 38 }} style={{ letterSpacing: "-0.01em" }}>
            {title}
          </Title>
          <Text size="sm" c="dimmed" mt={8}>
            Last updated {LEGAL_LAST_UPDATED}
          </Text>
          <Text fz="lg" mt="lg" lh={1.65}>
            {intro}
          </Text>
          <Divider my="xl" />
          <Typography
            styles={{
              root: { fontSize: "var(--mantine-font-size-md)", lineHeight: 1.7, overflowWrap: "anywhere" },
            }}
          >
            {children}
          </Typography>
        </Box>

        <Group component="nav" aria-label="Legal" justify="center" gap="lg" mt="xl">
          <Anchor component={Link} to="/privacy" size="sm" c="dimmed">
            Privacy Policy
          </Anchor>
          <Anchor component={Link} to="/terms" size="sm" c="dimmed">
            Terms of Service
          </Anchor>
          <Anchor href={`mailto:${SUPPORT_EMAIL}`} size="sm" c="dimmed">
            {SUPPORT_EMAIL}
          </Anchor>
        </Group>
      </Container>
    </Box>
  );
}
