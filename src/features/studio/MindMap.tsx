import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ActionIcon, Anchor, Badge, Box, Button, Drawer, Group, Stack, Text, Title, Tooltip, useComputedColorScheme } from "@mantine/core";
import { IconChevronLeft, IconChevronRight, IconExternalLink, IconLayoutDistributeHorizontal, IconPhoto } from "@tabler/icons-react";
import { useIsMobile } from "../../hooks/useIsMobile.ts";
import type { Figure, MindMapLink, MindMapNode } from "../../lib/learningApi.ts";
import { plural } from "../../lib/format.ts";
import { viewerPath } from "../materials/paths.ts";
import { FigureCrop } from "../figures/FigureCrop.tsx";
import { NODE_WIDTH, descendantsOf, hiddenBy, layoutTree, savedLayout, type Positions } from "./mindMapLayout.ts";

type TopicData = {
  topic: MindMapNode;
  isRoot: boolean;
  childCount: number;
  collapsed: boolean;
  selected: boolean;
  onToggle: (id: string) => void;
};
type TopicNode = Node<TopicData, "topic">;

const pageOf = (location: string | null) => {
  const match = location?.match(/Page\s+(\d+)/i);
  return match ? Number(match[1]) : null;
};

/** One topic: a card with its name; a chevron folds its branch away. */
const TopicCard = memo(function TopicCard({ data }: NodeProps<TopicNode>) {
  const { topic, isRoot, childCount, collapsed, selected, onToggle } = data;
  return (
    <Box
      w={NODE_WIDTH}
      px="sm"
      py={8}
      bdrs="md"
      data-testid="mindmap-node"
      style={{
        border: `${selected ? 2 : 1}px solid ${selected || isRoot ? "var(--mantine-primary-color-filled)" : "var(--mantine-color-default-border)"}`,
        background: isRoot ? "var(--mantine-primary-color-filled)" : "var(--mantine-color-body)",
        color: isRoot ? "var(--mantine-color-white)" : undefined,
        boxShadow: "var(--mantine-shadow-xs)",
        cursor: "pointer",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} isConnectable={false} />
      <Group gap={6} wrap="nowrap" justify="space-between">
        <Text size="sm" fw={isRoot ? 700 : 600} lineClamp={2} style={{ overflowWrap: "anywhere" }}>
          {topic.label}
        </Text>
        <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
          {topic.figureIds.length > 0 && <IconPhoto size={14} aria-label="Has pictures" color={isRoot ? "white" : "var(--mantine-color-teal-6)"} />}
          {childCount > 0 && (
            <ActionIcon
              size="sm"
              variant={isRoot ? "white" : "subtle"}
              color={isRoot ? "clay" : "gray"}
              radius="xl"
              className="nodrag"
              aria-label={collapsed ? `Show ${plural(childCount, "subtopic")}` : "Hide subtopics"}
              onClick={event => {
                event.stopPropagation();
                onToggle(topic.id);
              }}
            >
              {collapsed ? <Text size="10px" fw={700}>{childCount}</Text> : <IconChevronLeft size={14} />}
            </ActionIcon>
          )}
        </Group>
      </Group>
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} isConnectable={false} />
    </Box>
  );
});

const nodeTypes = { topic: TopicCard };

interface MindMapProps {
  itemId: string;
  roomId: string;
  nodes: MindMapNode[];
  links: MindMapLink[];
  figures: Figure[];
}

export function MindMap(props: MindMapProps) {
  return (
    <ReactFlowProvider>
      <MindMapCanvas {...props} />
    </ReactFlowProvider>
  );
}

/**
 * The concept map: drag topics around, zoom and pan, fold branches, and tap a
 * topic to read its summary, open its source pages and see its pictures.
 * Moves and folds are remembered in this browser.
 */
function MindMapCanvas({ itemId, roomId, nodes: topics, links, figures }: MindMapProps) {
  const scheme = useComputedColorScheme("light");
  const mobile = useIsMobile();
  const { fitView } = useReactFlow();
  const saved = useMemo(() => savedLayout.read(itemId), [itemId]);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(saved?.collapsed ?? []));
  const [moved, setMoved] = useState<Positions>(() => saved?.positions ?? {});
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const hidden = useMemo(() => hiddenBy(topics, collapsed), [topics, collapsed]);
  const visible = useMemo(() => topics.filter(topic => !hidden.has(topic.id)), [topics, hidden]);
  const auto = useMemo(() => layoutTree(visible), [visible]);
  const childCounts = useMemo(() => {
    const counts = new Map<string, number>();
    topics.forEach(topic => topic.parentId && counts.set(topic.parentId, (counts.get(topic.parentId) ?? 0) + 1));
    return counts;
  }, [topics]);

  const toggle = useCallback((id: string) => {
    setCollapsed(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const build = useCallback(
    (): TopicNode[] =>
      visible.map(topic => ({
        id: topic.id,
        type: "topic",
        position: moved[topic.id] ?? auto[topic.id],
        data: {
          topic,
          isRoot: topic.parentId === null,
          childCount: childCounts.get(topic.id) ?? 0,
          collapsed: collapsed.has(topic.id),
          selected: topic.id === selectedId,
          onToggle: toggle,
        },
      })),
    [visible, moved, auto, childCounts, collapsed, selectedId, toggle],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<TopicNode>(build());
  useEffect(() => setNodes(build()), [build, setNodes]);

  useEffect(() => savedLayout.write(itemId, { positions: moved, collapsed: [...collapsed] }), [itemId, moved, collapsed]);

  const edges = useMemo((): Edge[] => {
    const shown = new Set(visible.map(topic => topic.id));
    const tree = visible
      .filter(topic => topic.parentId && shown.has(topic.parentId))
      .map(topic => ({ id: `t-${topic.id}`, source: topic.parentId!, target: topic.id, type: "smoothstep", style: { strokeWidth: 1.5 } }));
    const cross = links
      .filter(link => shown.has(link.from) && shown.has(link.to))
      .map((link, index) => ({
        id: `l-${index}`,
        source: link.from,
        target: link.to,
        label: link.label,
        type: "default",
        animated: false,
        style: { strokeDasharray: "5 4", stroke: "var(--mantine-color-violet-5)" },
        labelStyle: { fontSize: 11, fill: "var(--mantine-color-violet-7)" },
        labelBgStyle: { fill: "var(--mantine-color-body)" },
        markerEnd: { type: MarkerType.ArrowClosed, color: "var(--mantine-color-violet-5)" },
      }));
    return [...tree, ...cross];
  }, [visible, links]);

  const selected = topics.find(topic => topic.id === selectedId) ?? null;

  const resetLayout = () => {
    savedLayout.clear(itemId);
    setMoved({});
    setCollapsed(new Set());
    window.setTimeout(() => void fitView({ padding: 0.15, duration: 300 }), 50);
  };

  return (
    <Box h={{ base: "calc(100dvh - 190px)", sm: "calc(100dvh - 210px)" }} mih={420} bdrs="lg" style={{ border: "1px solid var(--mantine-color-default-border)", overflow: "hidden" }} data-testid="mindmap">
      <ReactFlow<TopicNode>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={(_, node) => setMoved(current => ({ ...current, [node.id]: node.position }))}
        onNodeClick={(_, node) => setSelectedId(node.id)}
        onPaneClick={() => setSelectedId(null)}
        nodesConnectable={false}
        edgesFocusable={false}
        colorMode={scheme}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1} />
        <Controls showInteractive={false} position="bottom-left" />
        {!mobile && <MiniMap pannable zoomable position="bottom-right" nodeStrokeWidth={2} />}
        <Panel position="top-right">
          <Tooltip label="Tidy the layout (undo your moves)">
            <Button size="xs" variant="default" leftSection={<IconLayoutDistributeHorizontal size={14} />} onClick={resetLayout}>
              Reset layout
            </Button>
          </Tooltip>
        </Panel>
      </ReactFlow>

      <Drawer
        opened={!!selected}
        onClose={() => setSelectedId(null)}
        position={mobile ? "bottom" : "right"}
        size={mobile ? "70%" : "md"}
        title={selected?.label}
        withOverlay={mobile}
        lockScroll={mobile}
        closeOnClickOutside
      >
        {selected && <TopicDetail roomId={roomId} topic={selected} topics={topics} figures={figures} onOpen={setSelectedId} />}
      </Drawer>
    </Box>
  );
}

function TopicDetail({
  roomId,
  topic,
  topics,
  figures,
  onOpen,
}: {
  roomId: string;
  topic: MindMapNode;
  topics: MindMapNode[];
  figures: Figure[];
  onOpen: (id: string) => void;
}) {
  const parent = topics.find(other => other.id === topic.parentId);
  const children = topics.filter(other => other.parentId === topic.id);
  const pictures = figures.filter(figure => topic.figureIds.includes(figure.id));
  const below = descendantsOf(topics, topic.id).size;

  return (
    <Stack gap="md" data-testid="topic-detail">
      {parent && (
        <Anchor component="button" type="button" size="xs" c="dimmed" onClick={() => onOpen(parent.id)} ta="left">
          <IconChevronLeft size={12} style={{ verticalAlign: -1 }} aria-hidden="true" /> {parent.label}
        </Anchor>
      )}
      <Text size="sm" style={{ overflowWrap: "anywhere" }}>
        {topic.summary}
      </Text>

      {pictures.length > 0 && (
        <Stack gap="xs">
          <Title order={4} size="h6">
            {plural(pictures.length, "picture")}
          </Title>
          {pictures.map(figure => (
            <Box key={figure.id}>
              <FigureCrop roomId={roomId} figure={figure} maxHeight={260} label={figure.title} />
              <Text size="xs" c="dimmed" mt={4}>
                {figure.caption ?? figure.title}
              </Text>
            </Box>
          ))}
        </Stack>
      )}

      {topic.sources.length > 0 && (
        <Stack gap={4}>
          <Title order={4} size="h6">
            From your files
          </Title>
          {topic.sources.map(source => (
            <Anchor key={source.chunkId} component={Link} to={viewerPath(roomId, source.materialId, pageOf(source.location))} size="sm">
              <IconExternalLink size={13} style={{ verticalAlign: -2, marginRight: 4 }} aria-hidden="true" />
              {source.materialTitle}
              {source.location ? ` · ${source.location}` : ""}
            </Anchor>
          ))}
        </Stack>
      )}

      {children.length > 0 && (
        <Stack gap={6}>
          <Title order={4} size="h6">
            Subtopics{below > children.length ? ` (${below} in all)` : ""}
          </Title>
          <Group gap={6}>
            {children.map(child => (
              <Badge
                key={child.id}
                component="button"
                variant="light"
                color="gray"
                tt="none"
                radius="sm"
                size="lg"
                style={{ cursor: "pointer" }}
                rightSection={<IconChevronRight size={12} />}
                onClick={() => onOpen(child.id)}
              >
                {child.label}
              </Badge>
            ))}
          </Group>
        </Stack>
      )}
    </Stack>
  );
}
