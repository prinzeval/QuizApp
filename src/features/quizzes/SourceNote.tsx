import { useId, useState } from "react";
import { Box, Collapse, Group, Text, UnstyledButton } from "@mantine/core";
import { IconChevronDown, IconQuote } from "@tabler/icons-react";
import type { QuestionSource } from "../../lib/learningApi.ts";
import { SourcePreview } from "../materials/SourcePreview.tsx";
import { plainExcerpt } from "../materials/viewer/passages.ts";

/** "From your notes: Heart lecture · Page 3" that expands to show the passage the question came from. */
export function SourceNote({ source, defaultOpen = false }: { source: QuestionSource | null; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  if (!source) return null;

  const label = [source.materialTitle ?? "Your notes", source.location].filter(Boolean).join(" · ");

  return (
    <Box>
      <UnstyledButton
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls={id}
        mih={40}
        py={6}
        style={{ display: "flex", alignItems: "center", maxWidth: "100%", borderRadius: "var(--mantine-radius-sm)" }}
        data-testid="source-toggle"
      >
        <Group gap={8} wrap="nowrap" miw={0}>
          <IconQuote size={16} stroke={1.8} color="var(--mantine-primary-color-filled)" style={{ flexShrink: 0 }} aria-hidden="true" />
          <Text size="sm" c="dimmed" lineClamp={1} miw={0}>
            From your notes:{" "}
            <Text span size="sm" fw={600} c="var(--mantine-color-text)">
              {label}
            </Text>
          </Text>
          <IconChevronDown
            size={16}
            style={{ flexShrink: 0, transition: "transform 150ms ease", transform: open ? "rotate(180deg)" : undefined }}
            aria-hidden="true"
          />
        </Group>
      </UnstyledButton>
      <Collapse expanded={open} id={id}>
        {/* Mounted only while open, so the page thumbnail (and the file) load on demand. */}
        {open && (
          <Box mt={4}>
            <SourcePreview materialId={source.materialId} location={source.location} newTab>
              <Text
                size="sm"
                p="sm"
                bg="var(--mantine-color-default-hover)"
                bdrs="md"
                style={{ borderLeft: "3px solid var(--mantine-color-clay-3)", whiteSpace: "pre-line", overflowWrap: "anywhere" }}
                data-testid="source-excerpt"
              >
                {source.excerpt ? plainExcerpt(source.excerpt) : "The passage isn't available any more."}
              </Text>
            </SourcePreview>
          </Box>
        )}
      </Collapse>
    </Box>
  );
}
