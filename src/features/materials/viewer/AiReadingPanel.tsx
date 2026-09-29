import { lazy, Suspense, useMemo, useState } from "react";
import { Markdown } from "../../tutor/Markdown.tsx";
import { Alert, Badge, Box, Button, CloseButton, Group, ScrollArea, Skeleton, Stack, Text, TextInput, Title, UnstyledButton } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconAlertCircle, IconSearch, IconSparkles } from "@tabler/icons-react";
import type { Material } from "../../../lib/learningApi.ts";
import { plural } from "../../../lib/format.ts";
import { aiReadSummary, searchSections, type PassageSection } from "./passages.ts";
import type { PDFDocumentProxy } from "pdfjs-dist";

const PdfPageThumbnail = lazy(() => import("./PageThumbnail.tsx").then(module => ({ default: module.PdfPageThumbnail })));

const BATCH = 12;
const THUMB = 56;

interface AiReadingPanelProps {
  material: Material;
  sections: PassageSection[] | undefined;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  /** The PDF the preview loaded, for page thumbnails (PDFs only). */
  pdf: PDFDocumentProxy | null;
  onShowPage: (page: number) => void;
  onClose?: () => void;
  /** The drawer (phones) has its own title bar. */
  withHeader?: boolean;
}

/** "How the AI reads this file": per page, the Markdown quizzes and the tutor actually use. */
export function AiReadingPanel({ material, sections, loading, error, onRetry, pdf, onShowPage, onClose, withHeader = true }: AiReadingPanelProps) {
  const [search, setSearch] = useState("");
  const [needle] = useDebouncedValue(search.trim(), 150);
  const [limit, setLimit] = useState(BATCH);
  const results = useMemo(() => searchSections(sections ?? [], needle), [sections, needle]);
  const shown = results.slice(0, limit);
  const totalMatches = results.reduce((sum, result) => sum + result.matches, 0);
  const summary = material.status === "ready" ? aiReadSummary(material) : null;
  const usedVision = material.visionPages + material.visionFigures > 0;
  const isPdf = material.kind === "pdf";
  const reading = material.status === "queued" || material.status === "processing";

  return (
    <Stack gap={0} h="100%" mih={0} data-testid="ai-panel">
      <Stack gap={6} pb="sm">
        {withHeader && (
          <Group justify="space-between" wrap="nowrap" gap="xs">
            <Group gap={8} wrap="nowrap" miw={0}>
              <IconSparkles size={18} color="var(--mantine-primary-color-filled)" aria-hidden="true" style={{ flexShrink: 0 }} />
              <Title order={2} fz="md" ff="var(--mantine-font-family)" fw={650}>
                How the AI reads this file
              </Title>
            </Group>
            {onClose && <CloseButton onClick={onClose} aria-label="Close panel" size="lg" />}
          </Group>
        )}
        <Text size="sm" c="dimmed">
          {usedVision ? "Quizzes and the tutor use this text. Diagrams and tables were read by AI." : "Quizzes and the tutor use this text."}
        </Text>
        {(summary || sections?.length) && (
          <Group gap={6}>
            {summary && (
              <Badge variant="light" color="violet" radius="sm" tt="none" fw={600} leftSection={<IconSparkles size={12} aria-hidden="true" />}>
                {summary}
              </Badge>
            )}
            {!!sections?.length && sections.some(section => section.location) && (
              <Badge variant="default" radius="sm" tt="none" fw={500}>
                {plural(sections.length, material.kind === "pptx" ? "slide" : "page")} with text
              </Badge>
            )}
          </Group>
        )}
        {!!sections?.length && (
          <TextInput
            mt={6}
            type="search"
            placeholder="Search what the AI read"
            aria-label="Search what the AI read"
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={event => {
              setSearch(event.currentTarget.value);
              setLimit(BATCH);
            }}
            data-testid="ai-search"
          />
        )}
        {needle && (
          <Text size="xs" c="dimmed" aria-live="polite" data-testid="ai-search-summary">
            {results.length ? `${totalMatches} ${totalMatches === 1 ? "match" : "matches"} on ${plural(results.length, material.kind === "pptx" ? "slide" : "page")}` : `Nothing matches "${needle}".`}
          </Text>
        )}
      </Stack>

      <ScrollArea.Autosize mah="100%" type={withHeader ? "auto" : "scroll"} offsetScrollbars="y" style={{ flex: 1, minHeight: 0 }}>
        {loading ? (
          <Stack gap="xs" py="md" aria-busy="true" aria-label="Loading what the AI read">
            <Skeleton h={16} w="30%" />
            <Skeleton h={12} />
            <Skeleton h={12} />
            <Skeleton h={12} w="70%" />
          </Stack>
        ) : error ? (
          <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} mt="sm">
            <Text size="sm">{error}</Text>
            <Button size="xs" variant="default" mt="xs" onClick={onRetry}>
              Try again
            </Button>
          </Alert>
        ) : !sections?.length ? (
          <Text size="sm" c="dimmed" py="lg" ta="center">
            {reading ? "The AI is reading this file. What it reads shows up here when it's done." : material.status === "failed" ? "The AI couldn't read this file." : "The AI didn't find any text in this file."}
          </Text>
        ) : (
          <Stack gap={0}>
            {shown.map(({ section, matches }) => (
              <Box key={section.id} py="md" style={{ borderTop: "1px solid var(--mantine-color-default-border)" }} data-testid="ai-section" data-location={section.location ?? ""}>
                <Group gap="sm" wrap="nowrap" mb="sm" align="center">
                  {isPdf && section.number !== null && (
                    <UnstyledButton onClick={() => onShowPage(section.number!)} aria-label={`Show page ${section.number} in the file`} style={{ borderRadius: 6, flexShrink: 0 }}>
                      <Suspense fallback={<Skeleton w={THUMB} h={Math.round(THUMB * 1.3)} radius={6} />}>
                        <PdfPageThumbnail pdf={pdf ?? undefined} page={section.number} width={THUMB} />
                      </Suspense>
                    </UnstyledButton>
                  )}
                  <Stack gap={2} miw={0}>
                    <Group gap={6} wrap="nowrap">
                      <Text fw={650} size="sm">
                        {section.location ?? (material.kind === "image" ? "What's in the picture" : "Text")}
                      </Text>
                      {needle && matches > 0 && (
                        <Badge size="xs" variant="light" color="yellow" radius="sm">
                          {matches}
                        </Badge>
                      )}
                    </Group>
                    {isPdf && section.number !== null && (
                      <Button variant="subtle" size="xs" px={6} ml={-6} onClick={() => onShowPage(section.number!)} style={{ alignSelf: "flex-start" }}>
                        Show in the file
                      </Button>
                    )}
                  </Stack>
                </Group>
                <Markdown text={section.text} size="sm" highlight={needle} />
              </Box>
            ))}
            {results.length > shown.length && (
              <Button variant="default" onClick={() => setLimit(value => value + BATCH * 2)} my="sm">
                Show more ({results.length - shown.length} left)
              </Button>
            )}
          </Stack>
        )}
      </ScrollArea.Autosize>
    </Stack>
  );
}
