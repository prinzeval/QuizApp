import { lazy, Suspense, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { Box, Button, Group, Skeleton, Stack, UnstyledButton } from "@mantine/core";
import { IconArrowUpRight, IconExternalLink } from "@tabler/icons-react";
import { useMaterials } from "../../hooks/learning.ts";
import { pdfPageOf } from "./viewer/passages.ts";
import { viewerPath } from "./paths.ts";

// pdf.js loads only when a PDF page thumbnail is actually shown.
const MaterialPageThumbnail = lazy(() => import("./viewer/PageThumbnail.tsx"));

const THUMB = 84;

interface SourcePreviewProps {
  materialId: string;
  location: string | null;
  /** The passage text, shown beside the page thumbnail. */
  children: ReactNode;
  /** Open the file in a new tab (e.g. mid-quiz, so the quiz keeps its place). */
  newTab?: boolean;
  /** Room from the route unless given. */
  roomId?: string;
}

/**
 * Where a passage came from: for PDFs a thumbnail of the actual page, and a link that
 * opens the file (at that page). Used by tutor citations and quiz sources.
 */
export function SourcePreview({ materialId, location, children, newTab = false, roomId: roomIdProp }: SourcePreviewProps) {
  const params = useParams();
  const roomId = roomIdProp ?? params.roomId ?? "";
  const materials = useMaterials(roomId);
  const material = materials.data?.materials.find(m => m.id === materialId);
  const page = pdfPageOf(material?.kind, location);
  const exists = !materials.isSuccess || !!material;
  const href = viewerPath(roomId, materialId, page);
  const linkProps = newTab ? { target: "_blank", rel: "noopener" } : {};

  return (
    <Stack gap="sm">
      <Group gap="sm" align="flex-start" wrap="nowrap">
        {page !== null && (
          <UnstyledButton component={Link} to={href} {...linkProps} aria-label={`Open page ${page}`} style={{ flexShrink: 0, borderRadius: 6 }} data-testid="source-thumbnail">
            <Suspense fallback={<Skeleton w={THUMB} h={Math.round(THUMB * 1.3)} radius={6} />}>
              <MaterialPageThumbnail roomId={roomId} materialId={materialId} page={page} width={THUMB} />
            </Suspense>
          </UnstyledButton>
        )}
        <Box flex={1} miw={0}>
          {children}
        </Box>
      </Group>
      {/* Wait for the material list so the label doesn't flip from "Open file" to "Open page 3". */}
      {exists && roomId && !materials.isPending && (
        <Button
          component={Link}
          to={href}
          {...linkProps}
          size="xs"
          variant="light"
          radius="xl"
          rightSection={newTab ? <IconExternalLink size={14} aria-hidden="true" /> : <IconArrowUpRight size={14} aria-hidden="true" />}
          style={{ alignSelf: "flex-start" }}
          data-testid="source-open"
        >
          {page !== null ? `Open page ${page}` : "Open file"}
        </Button>
      )}
    </Stack>
  );
}
