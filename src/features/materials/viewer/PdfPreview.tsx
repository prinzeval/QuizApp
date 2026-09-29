import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from "react";
import { ActionIcon, Alert, Box, Button, Group, Menu, Paper, Skeleton, Stack, Text, TextInput, Tooltip } from "@mantine/core";
import { useElementSize, useWindowEvent } from "@mantine/hooks";
import { IconAlertCircle, IconChevronDown, IconChevronLeft, IconChevronRight, IconZoomIn, IconZoomOut } from "@tabler/icons-react";
import { useIsMobile } from "../../../hooks/useIsMobile.ts";
import { Document, Page, pdfOptions, pixelRatio, type PDFDocumentProxy } from "./pdf.ts";
import classes from "./Viewer.module.css";

/** Zoom is relative to "fit to width" (1). */
const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
const PAGE_GAP = 16;
/** Widest a page gets at "fit", so a page on a big monitor stays readable. */
const MAX_FIT_WIDTH = 1100;
/** Browsers struggle with canvases much wider than this. */
const MAX_CANVAS = 4096;

export interface PdfViewerHandle {
  /** Scrolls a page into view (and briefly highlights it). */
  goTo: (page: number, options?: { highlight?: boolean }) => void;
}

interface PdfPreviewProps {
  url: string;
  /** From `?page=N`: jump there once the document is laid out. */
  initialPage: number | null;
  handleRef?: Ref<PdfViewerHandle>;
  onDocument?: (pdf: PDFDocumentProxy) => void;
  downloadAction: React.ReactNode;
}

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

export default function PdfPreview({ url, initialPage, handleRef, onDocument, downloadAction }: PdfPreviewProps) {
  const mobile = useIsMobile();
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [ratios, setRatios] = useState<number[]>([]);
  const [laidOut, setLaidOut] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [current, setCurrent] = useState(1);
  const [visible, setVisible] = useState<Set<number>>(() => new Set([1, 2]));
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const { ref: columnRef, width: columnWidth } = useElementSize<HTMLDivElement>();
  const toolbarRef = useRef<HTMLDivElement>(null);
  const slots = useRef<(HTMLDivElement | null)[]>([]);
  const pendingInitial = useRef(initialPage);
  const highlightTimer = useRef<number>(undefined);

  const numPages = pdf?.numPages ?? 0;
  const fitWidth = Math.max(200, Math.min(columnWidth, MAX_FIT_WIDTH));
  const pageWidth = Math.round(fitWidth * zoom);
  const ratioOf = (page: number) => ratios[page - 1] ?? ratios[0] ?? 1.294;

  /* ---- layout: learn every page's shape up front so the scrollbar is right from the start */
  const onLoadSuccess = useCallback(
    (document: PDFDocumentProxy) => {
      setPdf(document);
      onDocument?.(document);
      const ratioOfPage = async (page: number) => {
        const viewport = (await document.getPage(page)).getViewport({ scale: 1 });
        return viewport.height / viewport.width;
      };
      void (async () => {
        try {
          setRatios([await ratioOfPage(1)]);
          setRatios(await Promise.all(Array.from({ length: document.numPages }, (_, index) => ratioOfPage(index + 1))));
        } catch {
          // Pages without a readable size keep the first page's shape.
        }
        setLaidOut(true);
      })();
    },
    [onDocument],
  );

  /* ---- navigation */
  const stickyOffset = () => {
    const toolbar = toolbarRef.current;
    if (!toolbar) return 0;
    return (parseFloat(getComputedStyle(toolbar).top) || 0) + toolbar.offsetHeight;
  };

  const scrollToPage = useCallback((page: number, fraction = 0, smooth = false) => {
    const slot = slots.current[page - 1];
    if (!slot) return;
    const rect = slot.getBoundingClientRect();
    const top = window.scrollY + rect.top + rect.height * fraction - stickyOffset() - (fraction ? 0 : 8);
    window.scrollTo({ top: Math.max(0, top), behavior: smooth ? "smooth" : "auto" });
  }, []);

  const goTo = useCallback(
    (page: number, options: { highlight?: boolean } = {}) => {
      if (!numPages) {
        pendingInitial.current = page;
        return;
      }
      const target = Math.min(Math.max(1, Math.round(page)), numPages);
      setCurrent(target);
      scrollToPage(target);
      if (options.highlight) {
        window.clearTimeout(highlightTimer.current);
        setHighlighted(target);
        highlightTimer.current = window.setTimeout(() => setHighlighted(null), 2000);
      }
    },
    [numPages, scrollToPage],
  );

  useImperativeHandle(handleRef, () => ({ goTo }), [goTo]);
  useEffect(() => () => window.clearTimeout(highlightTimer.current), []);

  // ?page=N once every page has its real height (so we land exactly there).
  useEffect(() => {
    if (!laidOut || !pendingInitial.current || !columnWidth) return;
    const page = pendingInitial.current;
    pendingInitial.current = null;
    requestAnimationFrame(() => goTo(page, { highlight: true }));
  }, [laidOut, columnWidth, goTo]);

  /* ---- which pages to render: the ones on screen, plus a screen above and below */
  const hasColumn = columnWidth > 0;
  useEffect(() => {
    if (!numPages || !hasColumn) return;
    const observer = new IntersectionObserver(
      entries =>
        setVisible(previous => {
          const next = new Set(previous);
          for (const entry of entries) {
            const page = Number((entry.target as HTMLElement).dataset.page);
            if (entry.isIntersecting) next.add(page);
            else next.delete(page);
          }
          return next;
        }),
      { rootMargin: "120% 0px" },
    );
    slots.current.slice(0, numPages).forEach(slot => slot && observer.observe(slot));
    return () => observer.disconnect();
  }, [numPages, hasColumn]);

  /* ---- current page follows scrolling */
  useEffect(() => {
    if (!numPages) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = stickyOffset() + window.innerHeight * 0.25;
      // Pages are stacked top to bottom: binary search for the last one starting above the line.
      let low = 0;
      let high = numPages - 1;
      while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        const top = slots.current[mid]?.getBoundingClientRect().top ?? Infinity;
        if (top <= line) low = mid;
        else high = mid - 1;
      }
      setCurrent(low + 1);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [numPages]);

  /* ---- zoom keeps your place */
  const anchor = useRef<{ page: number; fraction: number } | null>(null);
  const changeZoom = (next: number) => {
    const slot = slots.current[current - 1];
    if (slot) {
      const rect = slot.getBoundingClientRect();
      anchor.current = { page: current, fraction: Math.min(Math.max((stickyOffset() - rect.top) / rect.height, 0), 1) };
    }
    setZoom(next);
  };
  useLayoutEffect(() => {
    if (!anchor.current) return;
    const { page, fraction } = anchor.current;
    anchor.current = null;
    scrollToPage(page, fraction);
  }, [pageWidth, scrollToPage]);

  const zoomIndex = ZOOMS.indexOf(zoom);
  const zoomOut = () => zoomIndex > 0 && changeZoom(ZOOMS[zoomIndex - 1]);
  const zoomIn = () => zoomIndex < ZOOMS.length - 1 && changeZoom(ZOOMS[zoomIndex + 1]);

  /* ---- keyboard: ← → PgUp PgDn move a page at a time */
  useWindowEvent("keydown", event => {
    if (!numPages || isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
    if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
    if (event.key === "ArrowRight" || event.key === "PageDown") {
      event.preventDefault();
      goTo(current + 1);
    } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
      event.preventDefault();
      goTo(current - 1);
    }
  });

  return (
    <Stack gap={0} data-testid="pdf-preview">
      <Toolbar
        ref={toolbarRef}
        current={current}
        numPages={numPages}
        zoom={zoom}
        compact={mobile}
        onGoTo={page => goTo(page)}
        onZoom={changeZoom}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        canZoomIn={zoomIndex < ZOOMS.length - 1}
        canZoomOut={zoomIndex > 0}
      />

      <Box ref={columnRef} className={classes.pdfColumn} pt="md">
        <Document
          file={url}
          options={pdfOptions}
          suspense={false}
          onLoadSuccess={onLoadSuccess}
          onItemClick={({ pageNumber }) => goTo(pageNumber, { highlight: true })}
          externalLinkTarget="_blank"
          externalLinkRel="noopener noreferrer"
          loading={<PagesSkeleton width={fitWidth} />}
          error={
            <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} title="This PDF couldn't be shown here">
              <Text size="sm" mb="sm">
                It may be damaged or password-protected. You can still download the original.
              </Text>
              {downloadAction}
            </Alert>
          }
        >
          {columnWidth > 0 && (
            <Stack gap={PAGE_GAP} align={pageWidth > columnWidth ? "flex-start" : "center"} pb="md">
              {Array.from({ length: numPages }, (_, index) => {
                const page = index + 1;
                const height = Math.round(pageWidth * ratioOf(page));
                return (
                  <div
                    key={page}
                    ref={element => {
                      slots.current[index] = element;
                    }}
                    data-page={page}
                    data-testid="pdf-page"
                    className={classes.pdfPage}
                    data-highlighted={highlighted === page || undefined}
                    style={{ width: pageWidth, height }}
                    aria-label={`Page ${page} of ${numPages}`}
                    role="region"
                  >
                    {visible.has(page) ? (
                      <Page
                        pageNumber={page}
                        width={pageWidth}
                        devicePixelRatio={Math.min(pixelRatio(), MAX_CANVAS / pageWidth)}
                        suspense={false}
                        renderTextLayer
                        renderAnnotationLayer
                        canvasBackground="white"
                        loading={<Skeleton w={pageWidth} h={height} radius={0} />}
                        error={<PageError page={page} />}
                      />
                    ) : (
                      <PagePlaceholder page={page} />
                    )}
                  </div>
                );
              })}
            </Stack>
          )}
        </Document>
      </Box>
    </Stack>
  );
}

interface ToolbarProps {
  ref: Ref<HTMLDivElement>;
  current: number;
  numPages: number;
  zoom: number;
  compact: boolean;
  onGoTo: (page: number) => void;
  onZoom: (zoom: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  canZoomIn: boolean;
  canZoomOut: boolean;
}

const zoomLabel = (zoom: number) => (zoom === 1 ? "Fit" : `${Math.round(zoom * 100)}%`);

function Toolbar({ ref, current, numPages, zoom, compact, onGoTo, onZoom, onZoomIn, onZoomOut, canZoomIn, canZoomOut }: ToolbarProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const size = compact ? 40 : 34;
  const commit = () => {
    const page = Number(draft);
    if (draft !== null && Number.isFinite(page) && page >= 1) onGoTo(page);
    setDraft(null);
  };

  return (
    <Paper ref={ref} className={classes.toolbar} withBorder radius="md" px={compact ? 4 : "xs"} py={4} data-testid="pdf-toolbar">
      <Group justify="space-between" wrap="nowrap" gap={4}>
        <Group gap={compact ? 0 : 4} wrap="nowrap">
          <Tooltip label="Previous page (←)" withArrow disabled={compact}>
            <ActionIcon variant="subtle" color="gray" size={size} onClick={() => onGoTo(current - 1)} disabled={current <= 1 || !numPages} aria-label="Previous page">
              <IconChevronLeft size={18} />
            </ActionIcon>
          </Tooltip>
          <Group gap={6} wrap="nowrap">
            <Text size="sm" c="dimmed" visibleFrom="xs">
              Page
            </Text>
            <TextInput
              value={draft ?? String(current)}
              onChange={event => setDraft(event.currentTarget.value.replace(/\D/g, ""))}
              onFocus={event => {
                setDraft(String(current));
                event.currentTarget.select();
              }}
              onBlur={commit}
              onKeyDown={event => {
                if (event.key === "Enter") {
                  commit();
                  event.currentTarget.blur();
                } else if (event.key === "Escape") {
                  setDraft(null);
                  event.currentTarget.blur();
                }
              }}
              inputMode="numeric"
              aria-label={`Page number, 1 to ${numPages || "…"}`}
              size="sm"
              w={compact ? 48 : 52}
              styles={{ input: { textAlign: "center", paddingInline: 4, fontVariantNumeric: "tabular-nums" } }}
              disabled={!numPages}
              data-testid="pdf-page-input"
            />
            <Text size="sm" c="dimmed" style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }} data-testid="pdf-page-count">
              of {numPages || "…"}
            </Text>
          </Group>
          <Tooltip label="Next page (→)" withArrow disabled={compact}>
            <ActionIcon variant="subtle" color="gray" size={size} onClick={() => onGoTo(current + 1)} disabled={current >= numPages} aria-label="Next page">
              <IconChevronRight size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>

        <Group gap={compact ? 0 : 4} wrap="nowrap">
          <Tooltip label="Zoom out" withArrow disabled={compact}>
            <ActionIcon variant="subtle" color="gray" size={size} onClick={onZoomOut} disabled={!canZoomOut} aria-label="Zoom out">
              <IconZoomOut size={18} />
            </ActionIcon>
          </Tooltip>
          <Menu position="bottom-end" width={140} withinPortal>
            <Menu.Target>
              <Button
                variant="subtle"
                color="gray"
                size="compact-sm"
                h={size}
                px={6}
                miw={compact ? 52 : 64}
                rightSection={compact ? null : <IconChevronDown size={14} />}
                aria-label={`Zoom: ${zoomLabel(zoom)}`}
                data-testid="pdf-zoom"
                styles={{ label: { fontVariantNumeric: "tabular-nums" } }}
              >
                {zoomLabel(zoom)}
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              {ZOOMS.map(value => (
                <Menu.Item key={value} onClick={() => onZoom(value)} fw={value === zoom ? 700 : undefined}>
                  {value === 1 ? "Fit to width" : `${Math.round(value * 100)}%`}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
          <Tooltip label="Zoom in" withArrow disabled={compact}>
            <ActionIcon variant="subtle" color="gray" size={size} onClick={onZoomIn} disabled={!canZoomIn} aria-label="Zoom in">
              <IconZoomIn size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
    </Paper>
  );
}

function PagePlaceholder({ page }: { page: number }) {
  return (
    <Group h="100%" justify="center" align="center">
      <Text size="sm" c="gray.5">
        {page}
      </Text>
    </Group>
  );
}

function PageError({ page }: { page: number }) {
  return (
    <Stack h="100%" justify="center" align="center" gap={4} p="md">
      <IconAlertCircle size={20} color="var(--mantine-color-gray-6)" />
      <Text size="sm" c="gray.7">
        Page {page} couldn't be drawn.
      </Text>
    </Stack>
  );
}

function PagesSkeleton({ width }: { width: number }) {
  return (
    <Stack align="center" gap={PAGE_GAP} aria-busy="true" aria-label="Loading PDF">
      <Skeleton w={width} h={Math.round(width * 1.29)} radius="sm" />
      <Skeleton w={width} h={120} radius="sm" />
    </Stack>
  );
}
