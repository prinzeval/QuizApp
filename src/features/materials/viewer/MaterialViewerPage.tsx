import { lazy, Suspense, useCallback, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Center,
  Drawer,
  EmptyState,
  Group,
  Loader,
  Menu,
  Modal,
  Paper,
  Progress,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
  VisuallyHidden,
} from "@mantine/core";
import { useQueryClient } from "@tanstack/react-query";
import {
  IconAlertCircle,
  IconChevronLeft,
  IconDots,
  IconDownload,
  IconInfoCircle,
  IconRefresh,
  IconSparkles,
  IconTrash,
} from "@tabler/icons-react";
import { useRoom } from "../../../hooks/rooms.ts";
import { useDeleteMaterial, useMaterial, useMaterials, useRetryMaterial } from "../../../hooks/learning.ts";
import { useMaterialFile } from "../../../hooks/materialFile.ts";
import { queryKeys } from "../../../hooks/queryKeys.ts";
import { useIsMobile } from "../../../hooks/useIsMobile.ts";
import { ApiError, type Room } from "../../../lib/api.ts";
import type { Material } from "../../../lib/learningApi.ts";
import { timeAgo } from "../../../lib/format.ts";
import { notify } from "../../../notify.ts";
import { useRoomLive } from "../../../realtime/useRoomLive.ts";
import { KIND, downloadName, formatBytes } from "../fileTypes.ts";
import { MaterialStatusBadge } from "../MaterialStatusBadge.tsx";
import { useCanManage } from "../useCanManage.ts";
import { aiReadSummary, groupPassages, readingProgress } from "./passages.ts";
import { AiReadingPanel } from "./AiReadingPanel.tsx";
import { ImagePreview } from "./ImagePreview.tsx";
import { TextPreview } from "./TextPreview.tsx";
import { SlidesPreview } from "./SlidesPreview.tsx";
import type { PdfViewerHandle } from "./PdfPreview.tsx";
import type { PDFDocumentProxy } from "pdfjs-dist";
import classes from "./Viewer.module.css";

const PdfPreview = lazy(() => import("./PdfPreview.tsx"));
const DocxPreview = lazy(() => import("./DocxPreview.tsx"));

/** `/rooms/:roomId/materials/:materialId?page=N` — the original file, full size, with what the AI read one click away. */
export function MaterialViewerPage() {
  const { roomId = "", materialId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const pageParam = Number(searchParams.get("page"));
  const initialPage = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : null;

  useRoomLive(roomId);
  const room = useRoom(roomId);
  const list = useMaterials(roomId);
  const detail = useMaterial(roomId, materialId);
  // The list is live-patched on every status/progress event, so prefer it.
  const material = list.data?.materials.find(m => m.id === materialId) ?? (list.isSuccess ? undefined : detail.data?.material);
  const back = `/rooms/${roomId}`;

  if (room.isPending || (list.isPending && detail.isPending)) {
    return (
      <Center py={96} role="status">
        <Loader aria-hidden="true" />
        <VisuallyHidden>Loading file…</VisuallyHidden>
      </Center>
    );
  }

  const missing = (detail.error instanceof ApiError && detail.error.status === 404) || (list.isSuccess && !material);
  if (room.isError || missing || !material) {
    const roomGone = room.error instanceof ApiError && room.error.status === 404;
    return (
      <EmptyState
        title={roomGone ? "Room not found" : missing ? "This file isn't here any more" : "Couldn't open this file"}
        description={roomGone ? "It may have been deleted, or you're not a member." : missing ? "It may have been deleted by the person who added it or the room owner." : (room.error ?? list.error ?? detail.error)?.message}
        py={56}
        bd="1px dashed var(--mantine-color-default-border)"
        bdrs="lg"
      >
        <EmptyState.Actions>
          <Button component={Link} to={roomGone ? "/" : back} variant="default">
            {roomGone ? "Back to your rooms" : "Back to materials"}
          </Button>
        </EmptyState.Actions>
      </EmptyState>
    );
  }

  return <Viewer key={material.id} roomId={roomId} room={room.data.room} material={material} initialPage={initialPage} detail={detail} />;
}

interface ViewerProps {
  roomId: string;
  room: Room;
  material: Material;
  initialPage: number | null;
  detail: ReturnType<typeof useMaterial>;
}

function Viewer({ roomId, room, material, initialPage, detail }: ViewerProps) {
  const mobile = useIsMobile();
  const canManage = useCanManage(room)(material);
  const back = `/rooms/${roomId}`;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const file = useMaterialFile(roomId, material.id);
  const retry = useRetryMaterial(roomId);
  const remove = useDeleteMaterial(roomId);
  const [panelOpen, setPanelOpen] = useState(false);
  const [confirm, setConfirm] = useState<"reread" | "delete" | null>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const viewer = useRef<PdfViewerHandle>(null);

  const sections = useMemo(() => (detail.data ? groupPassages(detail.data.chunks) : undefined), [detail.data]);
  const progress = readingProgress(material);
  const aiSummary = material.status === "ready" ? aiReadSummary(material) : null;
  const { icon: KindIcon, color, label: kindLabel } = KIND[material.kind];
  const unit = material.kind === "pptx" ? "slide" : "page";
  const canReread = canManage && (material.status === "ready" || material.status === "failed");

  const showPage = useCallback(
    (page: number) => {
      if (mobile) setPanelOpen(false);
      // Let the drawer close before scrolling the page underneath it.
      window.setTimeout(() => viewer.current?.goTo(page, { highlight: true }), mobile ? 220 : 0);
    },
    [mobile],
  );

  const download = file.data ? (
    <Button component="a" href={file.data.url} download={downloadName(material)} variant="default" leftSection={<IconDownload size={16} />} data-testid="material-download">
      Download
    </Button>
  ) : (
    <Button variant="default" leftSection={<IconDownload size={16} />} loading={file.isPending} disabled={file.isError}>
      Download
    </Button>
  );

  const reread = () =>
    retry.mutate(material.id, {
      onSuccess: ({ material: updated }) => {
        queryClient.setQueryData<{ materials: Material[] }>(queryKeys.materials(roomId), current =>
          current ? { materials: current.materials.map(m => (m.id === updated.id ? updated : m)) } : current,
        );
        setConfirm(null);
        notify(`Re-reading "${material.title}"…`, "info");
      },
      onError: error => notify(error.message, "error"),
    });

  const facts = [
    kindLabel,
    formatBytes(material.sizeBytes),
    material.pageCount ? `${material.pageCount} ${unit}${material.pageCount === 1 ? "" : "s"}` : null,
  ].filter(Boolean);

  const panel = (
    <AiReadingPanel
      material={material}
      sections={sections}
      loading={detail.isPending}
      error={detail.isError ? detail.error.message : null}
      onRetry={() => detail.refetch()}
      pdf={pdf}
      onShowPage={showPage}
      onClose={mobile ? undefined : () => setPanelOpen(false)}
      withHeader={!mobile}
    />
  );

  return (
    <Stack gap="lg" data-testid="material-viewer">
      {/* Header */}
      <Box>
        <Button
          component={Link}
          to={back}
          variant="subtle"
          color="gray"
          c="dimmed"
          fw={500}
          px={8}
          ml={-8}
          mb="sm"
          leftSection={<IconChevronLeft size={16} aria-hidden="true" />}
          maw="100%"
          styles={{ label: { minWidth: 0 } }}
          data-testid="viewer-back"
        >
          <Text span inherit truncate="end">
            {room.name} · Materials
          </Text>
        </Button>

        <Group align="flex-start" gap="md" wrap="nowrap">
          <ThemeIcon size={mobile ? 40 : 48} radius="md" variant="light" color={color} aria-hidden="true" style={{ flexShrink: 0 }}>
            <KindIcon size={mobile ? 22 : 26} stroke={1.7} />
          </ThemeIcon>
          <Stack gap={6} flex={1} miw={0}>
            <Title order={1} fz={{ base: "1.375rem", sm: "1.75rem" }} style={{ overflowWrap: "anywhere" }} data-testid="viewer-title">
              {material.title}
            </Title>
            <Group gap={8} wrap="wrap" style={{ rowGap: 4 }}>
              <MaterialStatusBadge status={material.status} />
              <Text size="sm" c="dimmed">
                {facts.join(" · ")}
              </Text>
              {aiSummary && (
                <Tooltip label="The AI looked at the pages themselves, so diagrams, tables and handwriting count too." withArrow multiline maw={260}>
                  <Group gap={4} wrap="nowrap" c="violet" component="span" style={{ display: "inline-flex" }} data-testid="viewer-ai-summary">
                    <IconSparkles size={14} aria-hidden="true" />
                    <Text span size="sm" fw={500}>
                      {aiSummary}
                    </Text>
                  </Group>
                </Tooltip>
              )}
            </Group>
            <Text size="xs" c="dimmed">
              Added by {material.uploaderName ?? "a former member"} · {timeAgo(material.createdAt)}
            </Text>
          </Stack>
        </Group>

        <Group gap="xs" mt="md" wrap="nowrap">
          <Button
            variant={panelOpen ? "light" : "default"}
            leftSection={<IconSparkles size={16} />}
            onClick={() => setPanelOpen(open => !open)}
            aria-expanded={panelOpen}
            data-testid="ai-panel-toggle"
            style={{ flexShrink: 1, minWidth: 0 }}
            styles={{ label: { minWidth: 0 } }}
          >
            <Text span inherit truncate="end">
              How the AI reads this file
            </Text>
          </Button>
          {mobile ? (
            file.data ? (
              <ActionIcon component="a" href={file.data.url} download={downloadName(material)} variant="default" size={40} aria-label="Download" data-testid="material-download">
                <IconDownload size={18} />
              </ActionIcon>
            ) : (
              <ActionIcon variant="default" size={40} aria-label="Download" loading={file.isPending} disabled>
                <IconDownload size={18} />
              </ActionIcon>
            )
          ) : (
            download
          )}
          {canManage && (
            <Menu position="bottom-end" width={220}>
              <Menu.Target>
                <ActionIcon variant="default" size={mobile ? 40 : 36} aria-label="More actions" data-testid="viewer-more">
                  <IconDots size={18} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item leftSection={<IconRefresh size={16} />} disabled={!canReread} onClick={() => setConfirm("reread")} data-testid="viewer-reread">
                  Re-read with AI
                </Menu.Item>
                <Menu.Item color="red" leftSection={<IconTrash size={16} />} onClick={() => setConfirm("delete")} data-testid="viewer-delete">
                  Delete
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          )}
        </Group>
      </Box>

      {/* Status */}
      {progress && (
        <Paper withBorder p="md" radius="lg" role="status" aria-live="polite" data-testid="reading-progress">
          <Group justify="space-between" gap="sm" mb={8} wrap="nowrap">
            <Group gap={8} wrap="nowrap" miw={0}>
              <Loader size={14} aria-hidden="true" />
              <Text size="sm" fw={600} truncate data-testid="reading-progress-label">
                {progress.label}
              </Text>
            </Group>
            {progress.value !== null && (
              <Text size="sm" c="dimmed" style={{ fontVariantNumeric: "tabular-nums" }}>
                {progress.value}%
              </Text>
            )}
          </Group>
          <Progress value={progress.value ?? 100} animated={progress.value === null} striped={progress.value === null} size="sm" aria-label="Reading progress" />
          <Text size="xs" c="dimmed" mt={8}>
            The AI reads every {unit}, including diagrams and tables. You can look through the file meanwhile, or leave; it keeps going.
          </Text>
        </Paper>
      )}
      {material.status === "failed" && (
        <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} title="The AI couldn't read this file" radius="lg">
          <Text size="sm">{material.error ?? "Something went wrong while reading it."}</Text>
          {canManage ? (
            <Button mt="sm" variant="default" leftSection={<IconRefresh size={16} />} onClick={() => setConfirm("reread")}>
              Re-read
            </Button>
          ) : (
            <Text size="xs" c="dimmed" mt={6}>
              {material.uploaderName ?? "The person who added it"} or the room owner can try again.
            </Text>
          )}
        </Alert>
      )}
      {material.notice && material.status === "ready" && (
        <Alert color="gray" variant="light" icon={<IconInfoCircle size={18} />} radius="lg" data-testid="material-notice">
          <Text size="sm">{material.notice}</Text>
        </Alert>
      )}

      {/* The file itself, with the AI panel beside it on wide screens */}
      <Group align="flex-start" gap="lg" wrap="nowrap">
        <Box flex={1} miw={0}>
          {file.isError ? (
            <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} title="Couldn't load the file" radius="lg">
              <Text size="sm" mb="sm">
                {file.error.message}
              </Text>
              <Button variant="default" onClick={() => file.refetch()}>
                Try again
              </Button>
            </Alert>
          ) : material.kind === "pptx" ? (
            <SlidesPreview material={material} sections={sections} loading={detail.isPending} downloadAction={download} />
          ) : !file.data ? (
            <PreviewSkeleton />
          ) : (
            <Suspense fallback={<PreviewSkeleton />}>
              {material.kind === "pdf" ? (
                <PdfPreview url={file.data.url} initialPage={initialPage} handleRef={viewer} onDocument={setPdf} downloadAction={download} />
              ) : material.kind === "docx" ? (
                <DocxPreview blob={file.data.blob} downloadAction={download} />
              ) : material.kind === "image" ? (
                <ImagePreview url={file.data.url} title={material.title} />
              ) : (
                <TextPreview blob={file.data.blob} markdown={material.mimeType === "text/markdown" || /\.(md|markdown)$/i.test(material.title)} />
              )}
            </Suspense>
          )}
        </Box>

        {!mobile && panelOpen && (
          <Paper withBorder radius="lg" p="md" w={420} className={classes.sidePanel} style={{ flexShrink: 0 }}>
            {panel}
          </Paper>
        )}
      </Group>

      {mobile && (
        <Drawer
          opened={panelOpen}
          onClose={() => setPanelOpen(false)}
          position="bottom"
          size="88%"
          title={
            <Group gap={8} wrap="nowrap">
              <IconSparkles size={18} color="var(--mantine-primary-color-filled)" aria-hidden="true" />
              <Text fw={650}>How the AI reads this file</Text>
            </Group>
          }
          styles={{ content: { borderTopLeftRadius: 16, borderTopRightRadius: 16, display: "flex", flexDirection: "column" }, body: { flex: 1, minHeight: 0, paddingTop: 0 } }}
          closeButtonProps={{ size: "lg", "aria-label": "Close panel" }}
        >
          {panel}
        </Drawer>
      )}

      <Modal opened={confirm === "reread"} onClose={() => setConfirm(null)} title="Re-read this file with AI?">
        <Stack gap="md">
          <Text size="sm">
            The AI will read every {unit} of "{material.title}" again, including diagrams and tables, and replace what it read before. A long file can take a
            few minutes. Quizzes you've already made stay as they are.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button leftSection={<IconRefresh size={16} />} loading={retry.isPending} onClick={reread} data-testid="confirm-reread">
              Re-read
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={confirm === "delete"} onClose={() => setConfirm(null)} title="Delete this file?">
        <Stack gap="md">
          {remove.isError && (
            <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert">
              {remove.error.message}
            </Alert>
          )}
          <Text size="sm">
            "{material.title}" and everything the AI read from it will be removed for everyone in the room. Quizzes already made from it stay.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              color="red"
              loading={remove.isPending}
              data-testid="confirm-delete"
              onClick={async () => {
                // mutateAsync, not mutate callbacks: the list refresh unmounts this viewer before they'd run.
                try {
                  await remove.mutateAsync(material.id);
                } catch {
                  return; // shown in the dialog
                }
                navigate(back, { replace: true });
                notify(`Deleted "${material.title}"`);
              }}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

function PreviewSkeleton() {
  return (
    <Stack gap="md" aria-busy="true" aria-label="Loading preview">
      <Skeleton h={44} radius="md" />
      <Skeleton h={520} radius="md" />
    </Stack>
  );
}
