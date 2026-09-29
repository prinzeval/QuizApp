import { useState, type Ref } from "react";
import { Alert, Button, Group, List, Paper, Progress, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { Dropzone, type FileRejection } from "@mantine/dropzone";
import { IconAlertCircle, IconCloudUpload, IconUpload, IconX } from "@tabler/icons-react";
import { useUploadMaterials } from "../../hooks/learning.ts";
import { plural } from "../../lib/format.ts";
import { notify } from "../../notify.ts";
import { BookDoodle } from "../../components/Doodles.tsx";
import { ACCEPT, ACCEPT_HINT, MAX_FILE_BYTES, MAX_FILES, describeRejections } from "./fileTypes.ts";

interface UploadProblem {
  title: string;
  lines: string[];
}

/** Upload state shared by the big empty-state dropzone, the compact one and the "Upload" button. */
export function useMaterialUpload(roomId: string) {
  const upload = useUploadMaterials(roomId);
  const [progress, setProgress] = useState<{ fraction: number; count: number } | null>(null);
  const [problem, setProblem] = useState<UploadProblem | null>(null);

  const start = async (files: File[]) => {
    if (files.length === 0 || upload.isPending) return;
    setProblem(null);
    setProgress({ fraction: 0, count: files.length });
    try {
      const { materials } = await upload.mutateAsync({ files, onProgress: fraction => setProgress({ fraction, count: files.length }) });
      notify(materials.length === 1 ? `Uploaded "${materials[0].title}". Reading it now…` : `Uploaded ${materials.length} files. Reading them now…`);
    } catch (error) {
      setProblem({ title: "Upload failed", lines: [error instanceof Error ? error.message : "Something went wrong. Try again."] });
    } finally {
      setProgress(null);
    }
  };

  const reject = (rejections: FileRejection[]) =>
    setProblem({ title: rejections.length === 1 ? "This file can't be added" : "Some files can't be added", lines: describeRejections(rejections) });

  return { start, reject, progress, problem, clearProblem: () => setProblem(null), uploading: upload.isPending };
}

type Upload = ReturnType<typeof useMaterialUpload>;

/** Shared dropzone behaviour: accepted types, limits, and routing results to the upload state. */
function dropzoneProps(upload: Upload) {
  return {
    accept: ACCEPT,
    maxSize: MAX_FILE_BYTES,
    maxFiles: MAX_FILES,
    multiple: true,
    disabled: upload.uploading,
    onDropAny: (accepted: File[], rejections: FileRejection[]) => {
      // Upload what's valid and explain what isn't, in one go.
      if (rejections.length) upload.reject(rejections);
      if (accepted.length && !rejections.some(r => r.errors.some(e => e.code === "too-many-files"))) void upload.start(accepted);
    },
    onDrop: () => {},
    "data-testid": "materials-dropzone",
  } as const;
}

/** The large, friendly dropzone shown while the room has no materials yet. */
export function HeroDropzone({ upload, openRef }: { upload: Upload; openRef: Ref<() => void | undefined> }) {
  return (
    <Dropzone {...dropzoneProps(upload)} openRef={openRef} radius="lg" py={{ base: 40, sm: 56 }} px="md" aria-label="Upload study materials">
      <Stack align="center" gap="sm" ta="center" style={{ pointerEvents: "none" }}>
        <Dropzone.Idle>
          <BookDoodle />
        </Dropzone.Idle>
        <Dropzone.Accept>
          <ThemeIcon size={72} radius="xl" variant="light">
            <IconUpload size={36} />
          </ThemeIcon>
        </Dropzone.Accept>
        <Dropzone.Reject>
          <ThemeIcon size={72} radius="xl" variant="light" color="red">
            <IconX size={36} />
          </ThemeIcon>
        </Dropzone.Reject>
        <Title order={2} mt={4}>
          Add your study materials
        </Title>
        <Text c="dimmed" maw={460}>
          Add lecture slides, notes, handouts or a photo of the whiteboard. We'll read them so you can quiz yourself and ask the tutor about them.
        </Text>
        <Button component="span" leftSection={<IconUpload size={16} />} mt="xs" tabIndex={-1}>
          Choose files
        </Button>
        <Text size="sm" c="dimmed" visibleFrom="sm">
          or drag and drop them here
        </Text>
        <Text size="xs" c="dimmed" maw={360}>
          {ACCEPT_HINT}
        </Text>
      </Stack>
    </Dropzone>
  );
}

/** A slim drop target above the list once there are materials (desktop only; phones use the Upload button). */
export function CompactDropzone({ upload, openRef }: { upload: Upload; openRef: Ref<() => void | undefined> }) {
  return (
    <Dropzone {...dropzoneProps(upload)} openRef={openRef} radius="lg" p="md" visibleFrom="sm" aria-label="Upload study materials">
      <Group justify="center" gap="sm" wrap="nowrap" style={{ pointerEvents: "none" }}>
        <Dropzone.Idle>
          <IconCloudUpload size={22} color="var(--mantine-color-dimmed)" />
        </Dropzone.Idle>
        <Dropzone.Accept>
          <IconUpload size={22} color="var(--mantine-primary-color-filled)" />
        </Dropzone.Accept>
        <Dropzone.Reject>
          <IconX size={22} color="var(--mantine-color-red-6)" />
        </Dropzone.Reject>
        <Text size="sm" c="dimmed">
          Drop more files here, or{" "}
          <Text span fw={600} c="var(--mantine-color-anchor)">
            browse
          </Text>
          <Text span visibleFrom="md" inherit>
            {" "}
            · PDF, DOCX, PPTX, images, text · 50 MB max
          </Text>
        </Text>
      </Group>
    </Dropzone>
  );
}

/** Upload progress and any problems, shown just above the list. */
export function UploadStatus({ upload }: { upload: Upload }) {
  const { progress, problem } = upload;
  return (
    <>
      {progress && (
        <Paper withBorder p="md" role="status" aria-live="polite">
          <Group justify="space-between" gap="sm" mb={8} wrap="nowrap">
            <Text size="sm" fw={600} truncate>
              {progress.fraction >= 1 ? "Checking files…" : `Uploading ${plural(progress.count, "file")}…`}
            </Text>
            <Text size="sm" c="dimmed" style={{ fontVariantNumeric: "tabular-nums" }}>
              {Math.round(progress.fraction * 100)}%
            </Text>
          </Group>
          <Progress value={progress.fraction * 100} animated={progress.fraction >= 1} striped={progress.fraction >= 1} size="sm" aria-label="Upload progress" />
        </Paper>
      )}
      {problem && (
        <Alert
          color="red"
          variant="light"
          icon={<IconAlertCircle size={18} />}
          title={problem.title}
          withCloseButton
          closeButtonLabel="Dismiss"
          onClose={upload.clearProblem}
          role="alert"
          data-testid="upload-error"
        >
          {problem.lines.length === 1 ? (
            <Text size="sm">{problem.lines[0]}</Text>
          ) : (
            <List size="sm" spacing={2}>
              {problem.lines.map(line => (
                <List.Item key={line}>{line}</List.Item>
              ))}
            </List>
          )}
          <Text size="xs" c="dimmed" mt={6}>
            {ACCEPT_HINT}
          </Text>
        </Alert>
      )}
    </>
  );
}
