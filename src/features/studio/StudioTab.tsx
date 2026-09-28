import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ActionIcon,
  Alert,
  Button,
  EmptyState,
  Group,
  Loader,
  Menu,
  Modal,
  Paper,
  Progress,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { IconAlertCircle, IconAlertTriangle, IconChevronRight, IconDots, IconRefresh, IconSparkles, IconTrash } from "@tabler/icons-react";
import { useAuth } from "../../auth/AuthContext.tsx";
import { FormModal } from "../../components/FormModal.tsx";
import { useCreateStudioItem, useDeleteStudioItem, useMaterials, useRetryStudioItem, useStudioItems } from "../../hooks/learning.ts";
import type { Room } from "../../lib/api.ts";
import type { StudioItem, StudioKind } from "../../lib/learningApi.ts";
import { plural, timeAgo } from "../../lib/format.ts";
import { notify } from "../../notify.ts";
import { MaterialPicker } from "../materials/MaterialPicker.tsx";
import { NewQuizForm } from "../quizzes/NewQuizForm.tsx";
import { QUIZ_TOOL, STUDIO_TOOLS } from "./studioKinds.ts";
import classes from "./Studio.module.css";

/**
 * Studio: study tools made from the room's files, only when someone asks for
 * one (nothing runs on upload). Everything made is listed for the whole room.
 */
export function StudioTab({ room }: { room: Room }) {
  const { user } = useAuth();
  const items = useStudioItems(room.id);
  const retry = useRetryStudioItem(room.id);
  const [, setSearchParams] = useSearchParams();
  const [making, setMaking] = useState<StudioKind | null>(null);
  const [quizzing, setQuizzing] = useState(false);
  const [deleting, setDeleting] = useState<StudioItem | null>(null);

  const list = items.data?.items ?? [];
  const canManage = (item: StudioItem) => room.role === "owner" || (!!user && item.createdBy === user.id);
  const goToMaterials = () => {
    setMaking(null);
    setQuizzing(false);
    setSearchParams({ tab: "materials" }, { replace: true });
  };

  return (
    <>
      <div>
        <Title order={2}>Studio</Title>
        <Text size="sm" c="dimmed" mt={2} mb="lg">
          Turn this room's files into study tools. Nothing is made until you ask.
        </Text>
      </div>

      <SimpleGrid cols={{ base: 1, xs: 2, md: 3 }} spacing="sm" mb="xl">
        {(Object.keys(STUDIO_TOOLS) as StudioKind[]).map(kind => {
          const tool = STUDIO_TOOLS[kind];
          return <Tile key={kind} {...tool} testId={`studio-tile-${kind}`} onClick={() => setMaking(kind)} />;
        })}
        <Tile {...QUIZ_TOOL} testId="studio-tile-quiz" onClick={() => setQuizzing(true)} />
      </SimpleGrid>

      <Title order={3} size="h4" mb="sm">
        Made in this room
      </Title>

      {items.isPending ? (
        <Stack gap="xs" aria-busy="true" aria-label="Loading">
          {[0, 1].map(i => (
            <Skeleton key={i} h={64} radius="md" />
          ))}
        </Stack>
      ) : items.isError ? (
        <EmptyState title="Couldn't load Studio" description={items.error.message} py={40} bd="1px dashed var(--mantine-color-default-border)" bdrs="lg">
          <EmptyState.Actions>
            <Button variant="default" onClick={() => items.refetch()}>
              Try again
            </Button>
          </EmptyState.Actions>
        </EmptyState>
      ) : list.length === 0 ? (
        <Paper p="xl" radius="lg" bd="1px dashed var(--mantine-color-default-border)" ta="center" data-testid="studio-empty">
          <Text c="dimmed" size="sm">
            Nothing yet. Pick a tool above: image cards and mind maps show up here for everyone in the room.
          </Text>
        </Paper>
      ) : (
        <Paper withBorder radius="lg" component="ul" p={0} m={0} style={{ listStyle: "none", overflow: "hidden" }}>
          {list.map((item, index) => (
            <ItemRow
              key={item.id}
              item={item}
              roomId={room.id}
              first={index === 0}
              isMine={!!user && item.createdBy === user.id}
              canManage={canManage(item)}
              retrying={retry.isPending && retry.variables === item.id}
              onRetry={() =>
                retry.mutate(item.id, {
                  onSuccess: () => notify("Trying again…", "info"),
                  onError: error => notify(error.message, "error"),
                })
              }
              onDelete={() => setDeleting(item)}
            />
          ))}
        </Paper>
      )}

      <FormModal opened={!!making} onClose={() => setMaking(null)} title={making ? STUDIO_TOOLS[making].label : ""} size="lg">
        {making && <MakeForm roomId={room.id} kind={making} onDone={() => setMaking(null)} onGoToMaterials={goToMaterials} />}
      </FormModal>

      <FormModal opened={quizzing} onClose={() => setQuizzing(false)} title="New quiz" size="lg">
        {quizzing && (
          <NewQuizForm
            roomId={room.id}
            onCancel={() => setQuizzing(false)}
            onCreated={() => {
              setQuizzing(false);
              notify("Generating your quiz…", "info");
              setSearchParams({ tab: "quizzes" }, { replace: true });
            }}
            onGoToMaterials={goToMaterials}
          />
        )}
      </FormModal>

      <Modal opened={!!deleting} onClose={() => setDeleting(null)} title="Delete this?">
        {deleting && <DeleteItem roomId={room.id} item={deleting} onDone={() => setDeleting(null)} />}
      </Modal>
    </>
  );
}

function Tile({
  label,
  description,
  icon: Icon,
  color,
  testId,
  onClick,
}: {
  label: string;
  description: string;
  icon: typeof IconSparkles;
  color: string;
  testId: string;
  onClick: () => void;
}) {
  return (
    <UnstyledButton className={classes.tile} onClick={onClick} data-testid={testId}>
      <ThemeIcon variant="light" color={color} size={40} radius="md" style={{ flexShrink: 0 }}>
        <Icon size={22} stroke={1.7} />
      </ThemeIcon>
      <div style={{ minWidth: 0 }}>
        <Text fw={600} size="sm">
          {label}
        </Text>
        <Text size="xs" c="dimmed" lineClamp={2}>
          {description}
        </Text>
      </div>
    </UnstyledButton>
  );
}

function ItemRow({
  item,
  roomId,
  first,
  isMine,
  canManage,
  retrying,
  onRetry,
  onDelete,
}: {
  item: StudioItem;
  roomId: string;
  first: boolean;
  isMine: boolean;
  canManage: boolean;
  retrying: boolean;
  onRetry: () => void;
  onDelete: () => void;
}) {
  const tool = STUDIO_TOOLS[item.kind];
  const Icon = tool.icon;
  const sources = item.materials.length === 1 ? item.materials[0].title : plural(item.materials.length, "source");
  const size = item.kind === "image_cards" ? plural(item.size, "picture") : plural(item.size, "topic");
  const progress = item.progress && item.progress.total > 0 ? item.progress : null;

  const body = (
    <Group gap="sm" wrap="nowrap" px="md" py="sm" miw={0} flex={1}>
      <ThemeIcon variant="light" color={item.status === "failed" ? "red" : tool.color} size={40} radius="md" style={{ flexShrink: 0 }}>
        {item.status === "generating" ? <Loader size={18} color={tool.color} /> : item.status === "failed" ? <IconAlertTriangle size={20} /> : <Icon size={20} stroke={1.7} />}
      </ThemeIcon>
      <Stack gap={2} miw={0} flex={1}>
        <Text fw={600} size="sm" lineClamp={1} style={{ overflowWrap: "anywhere" }} data-testid="studio-item-title">
          {item.title}
        </Text>
        {item.status === "generating" ? (
          <Stack gap={4} role="status">
            <Text size="xs" c="dimmed">
              {item.kind === "image_cards"
                ? progress
                  ? `Looking for pictures… ${progress.done} of ${progress.total} checked`
                  : "Looking for pictures…"
                : "Mapping the topics…"}
            </Text>
            {progress && <Progress value={(100 * progress.done) / progress.total} size="xs" color={tool.color} maw={260} aria-hidden="true" />}
          </Stack>
        ) : item.status === "failed" ? (
          <Text size="xs" c="red" lineClamp={2}>
            {item.error ?? "Something went wrong."}
          </Text>
        ) : (
          <Text size="xs" c="dimmed" lineClamp={1}>
            {tool.label} · {size} · {sources} · {isMine ? "You" : item.creatorName ?? "Someone"}, {timeAgo(item.createdAt)}
          </Text>
        )}
      </Stack>
      {item.status === "ready" && <IconChevronRight size={18} color="var(--mantine-color-dimmed)" style={{ flexShrink: 0 }} aria-hidden="true" />}
    </Group>
  );

  return (
    <Group
      component="li"
      gap={0}
      wrap="nowrap"
      className={classes.row}
      style={{ borderTop: first ? undefined : "1px solid var(--mantine-color-default-border)" }}
      data-testid="studio-item"
      data-status={item.status}
      data-kind={item.kind}
    >
      {item.status === "ready" ? (
        <UnstyledButton component={Link} to={`/rooms/${roomId}/studio/${item.id}`} miw={0} flex={1} display="flex" aria-label={`Open ${tool.label}: ${item.title}`}>
          {body}
        </UnstyledButton>
      ) : (
        body
      )}
      {item.status === "failed" && canManage && (
        <Button variant="light" size="xs" leftSection={<IconRefresh size={14} />} loading={retrying} onClick={onRetry} mr="xs" style={{ flexShrink: 0 }}>
          Try again
        </Button>
      )}
      {canManage && (
        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <ActionIcon variant="subtle" color="gray" size={40} mr="xs" aria-label={`More actions for ${item.title}`} style={{ flexShrink: 0 }}>
              <IconDots size={18} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item color="red" leftSection={<IconTrash size={16} />} onClick={onDelete}>
              Delete
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      )}
    </Group>
  );
}

function MakeForm({ roomId, kind, onDone, onGoToMaterials }: { roomId: string; kind: StudioKind; onDone: () => void; onGoToMaterials: () => void }) {
  const tool = STUDIO_TOOLS[kind];
  const materials = useMaterials(roomId);
  const create = useCreateStudioItem(roomId);
  const [scope, setScope] = useState<"all" | "pick">("all");
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | undefined>();
  const noneReady = materials.isSuccess && !materials.data.materials.some(m => m.status === "ready");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (scope === "pick" && picked.length === 0) return setPickError("Choose at least one file, or use all of them");
    setPickError(undefined);
    try {
      await create.mutateAsync({ kind, materialIds: scope === "pick" ? picked : [] });
      notify(kind === "image_cards" ? "Looking for pictures…" : "Making your mind map…", "info");
      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't start. Please try again.");
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <Stack gap="lg">
        {error && (
          <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert">
            {error}
          </Alert>
        )}
        <Text size="sm">{tool.description}</Text>
        <MaterialPicker
          materials={materials}
          scope={scope}
          onScopeChange={setScope}
          picked={picked}
          onPickedChange={setPicked}
          error={pickError}
          description="Made only from these files."
          onGoToMaterials={onGoToMaterials}
        />
        <Text size="xs" c="dimmed">
          {tool.note}
        </Text>
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onDone}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={create.isPending}
            disabled={!materials.isSuccess || noneReady}
            leftSection={<IconSparkles size={16} />}
            data-testid="studio-make"
          >
            {tool.action}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

function DeleteItem({ roomId, item, onDone }: { roomId: string; item: StudioItem; onDone: () => void }) {
  const remove = useDeleteStudioItem(roomId);
  return (
    <Stack gap="md">
      {remove.isError && (
        <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert">
          {remove.error.message}
        </Alert>
      )}
      <Text size="sm">
        <strong>{item.title}</strong> will be deleted for everyone in the room.
        {item.kind === "image_cards" ? " The pictures stay with their files, so making cards again is instant." : ""}
      </Text>
      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onDone}>
          Cancel
        </Button>
        <Button
          color="red"
          loading={remove.isPending}
          onClick={async () => {
            await remove.mutateAsync(item.id);
            onDone();
            notify("Deleted");
          }}
        >
          Delete
        </Button>
      </Group>
    </Stack>
  );
}
