import type { ReactNode } from "react";
import { Badge, Button, Group, Popover, ScrollArea, Stack, Text, ThemeIcon } from "@mantine/core";
import { IconFileText } from "@tabler/icons-react";
import type { TutorSource } from "../../lib/learningApi.ts";
import { SourcePreview } from "../materials/SourcePreview.tsx";
import { plainExcerpt } from "../materials/viewer/passages.ts";

/** Where a source came from: "heart-lecture.pdf · Page 3". */
export const sourceLabel = (source: TutorSource) => (source.location ? `${source.materialTitle} · ${source.location}` : source.materialTitle);

function SourceCard({ source }: { source: TutorSource }) {
  return (
    <Stack gap="xs">
      <Group gap="xs" wrap="nowrap" align="flex-start">
        <ThemeIcon variant="light" size={28} radius="md" aria-hidden="true">
          <IconFileText size={16} />
        </ThemeIcon>
        <Stack gap={0} miw={0}>
          <Text size="sm" fw={600} lineClamp={2} style={{ overflowWrap: "anywhere" }}>
            {source.materialTitle}
          </Text>
          <Text size="xs" c="dimmed">
            {source.tag}
            {source.location ? ` · ${source.location}` : ""}
          </Text>
        </Stack>
      </Group>
      <SourcePreview materialId={source.materialId} location={source.location}>
        <ScrollArea.Autosize mah={200} type="auto" offsetScrollbars>
          <Text
            size="sm"
            c="dimmed"
            pl="sm"
            style={{ whiteSpace: "pre-wrap", borderLeft: "2px solid var(--mantine-color-default-border)", overflowWrap: "anywhere" }}
            data-testid="source-excerpt"
          >
            {plainExcerpt(source.excerpt)}
          </Text>
        </ScrollArea.Autosize>
      </SourcePreview>
    </Stack>
  );
}

function SourcePopover({ source, children }: { source: TutorSource; children: ReactNode }) {
  return (
    <Popover width={360} position="top" withArrow shadow="md" radius="md" trapFocus={false} returnFocus>
      <Popover.Target>{children}</Popover.Target>
      <Popover.Dropdown maw="calc(100vw - 32px)" aria-label={`Source ${source.tag}`}>
        <SourceCard source={source} />
      </Popover.Dropdown>
    </Popover>
  );
}

/** An inline "[S1]" chip; opens the passage it points to. */
export function CitationChip({ tag, source }: { tag: string; source: TutorSource | undefined }) {
  if (!source) {
    return (
      <Badge component="span" size="sm" variant="default" radius="sm" mx={2} data-testid="citation" style={{ verticalAlign: "baseline" }}>
        {tag}
      </Badge>
    );
  }
  return (
    <SourcePopover source={source}>
      <Badge
        component="button"
        type="button"
        size="sm"
        variant="light"
        radius="sm"
        mx={2}
        data-testid="citation"
        aria-label={`Source ${tag}: ${sourceLabel(source)}`}
        style={{ cursor: "pointer", verticalAlign: "baseline", border: 0, textTransform: "none" }}
      >
        {tag}
      </Badge>
    </SourcePopover>
  );
}

/** Compact row of the sources an answer cited. */
export function SourcesRow({ sources }: { sources: TutorSource[] }) {
  if (!sources.length) return null;
  return (
    <Group gap={6} data-testid="tutor-sources" aria-label="Sources" role="group">
      <Text size="xs" c="dimmed" fw={500} mr={2}>
        Sources
      </Text>
      {sources.map(source => (
        <SourcePopover key={source.tag} source={source}>
          <Button
            size="xs"
            variant="default"
            radius="xl"
            fw={500}
            maw={260}
            leftSection={
              <Text span size="xs" fw={700} c="var(--mantine-primary-color-light-color)">
                {source.tag}
              </Text>
            }
            styles={{ label: { minWidth: 0 } }}
          >
            <Text span inherit truncate="end" display="block">
              {sourceLabel(source)}
            </Text>
          </Button>
        </SourcePopover>
      ))}
    </Group>
  );
}
