import type { ReactNode } from "react";
import { Box, Center, Group, Image, Stack, Text, Title } from "@mantine/core";
import { Scribble } from "./Doodles.tsx";

function Logo({ inverted = false }: { inverted?: boolean }) {
  return (
    <Group gap={10} wrap="nowrap">
      <Image src="/favicon.jpg" alt="" w={32} h={32} radius="md" />
      <Text fw={700} size="lg" c={inverted ? "white" : undefined}>
        SmartQuiz
      </Text>
    </Group>
  );
}

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <Group align="stretch" gap={0} wrap="nowrap" mih="100dvh" bg="var(--app-canvas)">
      <Box
        component="aside"
        aria-hidden="true"
        visibleFrom="md"
        w="44%"
        maw={560}
        p={56}
        bg="linear-gradient(160deg, var(--mantine-color-clay-9), var(--mantine-color-clay-8) 45%, var(--mantine-color-clay-7))"
      >
        <Stack h="100%" justify="center" gap={0}>
          <Logo inverted />
          <Text c="white" fz={34} fw={700} lh={1.25} mt={40} style={{ letterSpacing: "-0.02em" }}>
            Turn your notes into <Scribble>quizzes</Scribble> and actually remember what you read.
          </Text>
          <Text ff="Caveat, cursive" fz={26} c="yellow.3" mt={28}>
            made with love for Nana ♥
          </Text>
        </Stack>
      </Box>

      <Center component="main" flex={1} px="md" py={32}>
        <Stack w="100%" maw={400} gap="lg">
          <Box hiddenFrom="md">
            <Logo />
          </Box>
          <div>
            <Title order={1}>{title}</Title>
            <Text c="dimmed" mt={6}>
              {subtitle}
            </Text>
          </div>
          {children}
          <Text size="sm" c="dimmed" ta="center">
            {footer}
          </Text>
        </Stack>
      </Center>
    </Group>
  );
}
