import { Markdown } from "../../tutor/Markdown.tsx";
import { Alert, Badge, Box, Group, Paper, Skeleton, Stack, Text } from "@mantine/core";
import { IconPresentation } from "@tabler/icons-react";
import type { Material } from "../../../lib/learningApi.ts";
import type { PassageSection } from "./passages.ts";


/**
 * PowerPoint can't be drawn faithfully in a browser yet, so slides are shown as what's on
 * each one (text, tables and AI descriptions of pictures), with the original a click away.
 */
export function SlidesPreview({
  material,
  sections,
  loading,
  downloadAction,
}: {
  material: Material;
  sections: PassageSection[] | undefined;
  loading: boolean;
  downloadAction: React.ReactNode;
}) {
  const reading = material.status === "queued" || material.status === "processing";

  return (
    <Stack gap="md" data-testid="slides-preview" maw={860} mx="auto">
      <Alert variant="light" color="clay" icon={<IconPresentation size={18} />} title="Slide contents" radius="lg">
        <Stack gap="sm" align="flex-start">
          <Text size="sm">
            PowerPoint files can't be shown exactly as designed in the browser yet, so here's what's on each slide. Download the file to see the
            original layout and animations.
          </Text>
          {downloadAction}
        </Stack>
      </Alert>

      {loading || (reading && !sections?.length) ? (
        reading ? (
          <Paper withBorder radius="lg" p="xl" ta="center">
            <Text size="sm" c="dimmed">
              Slides appear here as soon as the AI has read the file.
            </Text>
          </Paper>
        ) : (
          <Stack gap="md" aria-busy="true" aria-label="Loading slides">
            {[0, 1].map(i => (
              <Skeleton key={i} h={220} radius="lg" />
            ))}
          </Stack>
        )
      ) : !sections?.length ? (
        <Paper withBorder radius="lg" p="xl" ta="center">
          <Text size="sm" c="dimmed">
            {material.status === "failed" ? "This file couldn't be read, so there's nothing to show here yet." : "We didn't find any text on these slides."}
          </Text>
        </Paper>
      ) : (
        sections.map((section, index) => (
          <Paper key={section.id} withBorder radius="lg" p={{ base: "md", sm: "xl" }} data-testid="slide-card" data-slide={section.number ?? undefined}>
            <Group justify="space-between" mb="sm">
              <Badge variant="light" color="gray" radius="sm" tt="none" fw={600}>
                {section.location ?? (index === 0 ? "Slides" : "More from this file")}
              </Badge>
              {material.pageCount && section.number ? (
                <Text size="xs" c="dimmed">
                  {section.number} / {material.pageCount}
                </Text>
              ) : null}
            </Group>
            <Box mih={80}>
              <Markdown text={section.text} />
            </Box>
          </Paper>
        ))
      )}
    </Stack>
  );
}
