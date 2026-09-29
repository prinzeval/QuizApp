import { Link, useNavigate } from "react-router-dom";
import { Button, Group, Paper, Progress, Stack, Table, Text, ThemeIcon, Tooltip, UnstyledButton, VisuallyHidden } from "@mantine/core";
import { IconAlertTriangle, IconChevronRight, IconRefresh, IconSparkles } from "@tabler/icons-react";
import type { Material } from "../../lib/learningApi.ts";
import { plural, timeAgo } from "../../lib/format.ts";
import { useIsMobile } from "../../hooks/useIsMobile.ts";
import { KIND, formatBytes } from "./fileTypes.ts";
import { MaterialStatusBadge } from "./MaterialStatusBadge.tsx";
import { aiReadBadge, readingProgress } from "./viewer/passages.ts";
import { viewerPath } from "./paths.ts";

interface ListProps {
  roomId: string;
  materials: Material[];
  canManage: (material: Material) => boolean;
  onRetry: (material: Material) => void;
  retryingId: string | null;
}

/** "12 pages · 2.4 MB" */
function facts(material: Material): string {
  const parts: string[] = [];
  if (material.pageCount) parts.push(plural(material.pageCount, material.kind === "pptx" ? "slide" : "page"));
  parts.push(formatBytes(material.sizeBytes));
  return parts.join(" · ");
}

function KindIcon({ material, size = 40 }: { material: Material; size?: number }) {
  const { icon: Icon, color, label } = KIND[material.kind];
  return (
    <ThemeIcon size={size} radius="md" variant="light" color={color} aria-label={label} role="img" style={{ flexShrink: 0 }}>
      <Icon size={size * 0.5} stroke={1.7} />
    </ThemeIcon>
  );
}

/** Small signals after the facts: what the AI read, and any heads-up. */
function Signals({ material }: { material: Material }) {
  const summary = material.status === "ready" ? aiReadBadge(material) : null;
  return (
    <>
      {summary && (
        <Tooltip label="The AI looked at the pages themselves, so diagrams, tables and handwriting count too." withArrow multiline maw={240}>
          <Group gap={4} wrap="nowrap" c="violet" component="span" style={{ display: "inline-flex" }} data-testid="material-ai-read">
            <IconSparkles size={13} aria-hidden="true" />
            <Text span size="xs" fw={500}>
              {summary}
            </Text>
          </Group>
        </Tooltip>
      )}
      {material.notice && material.status === "ready" && (
        <Tooltip label={material.notice} withArrow multiline maw={280}>
          <Group gap={4} wrap="nowrap" c="yellow.8" component="span" style={{ display: "inline-flex" }} aria-label={`Note: ${material.notice}`} data-testid="material-notice-icon">
            <IconAlertTriangle size={14} aria-hidden="true" />
            <Text span size="xs" fw={500}>
              Note
            </Text>
          </Group>
        </Tooltip>
      )}
    </>
  );
}

/** "Reading page 3 of 40…" with a slim bar, while the AI works. */
function MiniProgress({ material }: { material: Material }) {
  const progress = readingProgress(material);
  if (!progress) return null;
  return (
    <Stack gap={4} mt={2} maw={280} data-testid="material-progress">
      <Text size="xs" c="dimmed">
        {progress.label}
      </Text>
      <Progress value={progress.value ?? 100} animated={progress.value === null} striped={progress.value === null} size="xs" aria-label={progress.label} />
    </Stack>
  );
}

function RetryButton({ material, onRetry, loading }: { material: Material; onRetry: (m: Material) => void; loading: boolean }) {
  return (
    <Button
      size="xs"
      variant="default"
      leftSection={<IconRefresh size={14} />}
      loading={loading}
      onClick={event => {
        event.preventDefault();
        event.stopPropagation();
        onRetry(material);
      }}
    >
      Retry
    </Button>
  );
}

export function MaterialList(props: ListProps) {
  const mobile = useIsMobile();
  return mobile ? <MaterialCards {...props} /> : <MaterialTable {...props} />;
}

/** Desktop: a calm table; the whole row opens the file. */
function MaterialTable({ roomId, materials, canManage, onRetry, retryingId }: ListProps) {
  const navigate = useNavigate();
  return (
    <Paper withBorder style={{ overflow: "hidden" }}>
      <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md" layout="fixed" aria-label="Materials">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Name</Table.Th>
            <Table.Th w={150}>Status</Table.Th>
            <Table.Th w={190} visibleFrom="md">
              Added
            </Table.Th>
            <Table.Th w={44}>
              <VisuallyHidden>Open</VisuallyHidden>
            </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {materials.map(material => (
            <Table.Tr key={material.id} data-testid="material-row" onClick={() => navigate(viewerPath(roomId, material.id))} style={{ cursor: "pointer" }}>
              <Table.Td>
                <Group gap="sm" wrap="nowrap">
                  <KindIcon material={material} />
                  <Stack gap={2} miw={0}>
                    <UnstyledButton component={Link} to={viewerPath(roomId, material.id)} onClick={event => event.stopPropagation()} style={{ minWidth: 0 }}>
                      <Text data-testid="material-title" fw={600} size="sm" truncate="end" title={material.title}>
                        {material.title}
                      </Text>
                    </UnstyledButton>
                    <Group gap={8} wrap="wrap" style={{ rowGap: 0 }}>
                      <Text size="xs" c="dimmed">
                        {facts(material)}
                      </Text>
                      <Signals material={material} />
                    </Group>
                    <MiniProgress material={material} />
                    {material.status === "failed" && material.error && (
                      <Text size="xs" c="red" lineClamp={2}>
                        {material.error}
                      </Text>
                    )}
                  </Stack>
                </Group>
              </Table.Td>
              <Table.Td>
                <Stack gap={6} align="flex-start">
                  <MaterialStatusBadge status={material.status} />
                  {material.status === "failed" && canManage(material) && (
                    <RetryButton material={material} onRetry={onRetry} loading={retryingId === material.id} />
                  )}
                </Stack>
              </Table.Td>
              <Table.Td visibleFrom="md">
                <Text size="sm" truncate="end">
                  {material.uploaderName ?? "Former member"}
                </Text>
                <Text size="xs" c="dimmed">
                  {timeAgo(material.createdAt)}
                </Text>
              </Table.Td>
              <Table.Td>
                <IconChevronRight size={16} color="var(--mantine-color-dimmed)" aria-hidden="true" />
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}

/** Phones: one card per material, the whole card is the tap target. */
function MaterialCards({ roomId, materials, canManage, onRetry, retryingId }: ListProps) {
  return (
    <Stack component="ul" gap="sm" p={0} m={0} style={{ listStyle: "none" }} aria-label="Materials">
      {materials.map(material => (
        <Paper component="li" key={material.id} withBorder data-testid="material-row" style={{ overflow: "hidden" }}>
          <UnstyledButton component={Link} to={viewerPath(roomId, material.id)} w="100%" p="md" display="block">
            <Group gap="sm" wrap="nowrap" align="flex-start">
              <KindIcon material={material} />
              <Stack gap={4} flex={1} miw={0}>
                <Text data-testid="material-title" fw={600} size="sm" lineClamp={2} style={{ overflowWrap: "anywhere" }}>
                  {material.title}
                </Text>
                <Text size="xs" c="dimmed">
                  {facts(material)}
                </Text>
                <Text size="xs" c="dimmed" truncate="end">
                  {material.uploaderName ?? "Former member"} · {timeAgo(material.createdAt)}
                </Text>
                <Group gap={8} mt={2} wrap="wrap">
                  <MaterialStatusBadge status={material.status} />
                  <Signals material={material} />
                </Group>
                <MiniProgress material={material} />
              </Stack>
              <IconChevronRight size={18} color="var(--mantine-color-dimmed)" aria-hidden="true" style={{ flexShrink: 0, marginTop: 10 }} />
            </Group>
          </UnstyledButton>
          {material.status === "failed" && (
            <Group justify="space-between" gap="sm" wrap="nowrap" px="md" pb="md" mt={-4}>
              <Text size="xs" c="red" lineClamp={2}>
                {material.error ?? "We couldn't read this file."}
              </Text>
              {canManage(material) && <RetryButton material={material} onRetry={onRetry} loading={retryingId === material.id} />}
            </Group>
          )}
        </Paper>
      ))}
    </Stack>
  );
}
