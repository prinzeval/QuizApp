import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import {
  ActionIcon,
  Alert,
  Anchor,
  Box,
  Button,
  Center,
  CloseButton,
  Divider,
  Group,
  Loader,
  Menu,
  Modal,
  Stack,
  Text,
  Textarea,
  ThemeIcon,
  UnstyledButton,
  VisuallyHidden,
} from "@mantine/core";
import {
  IconAlertCircle,
  IconArrowBackUp,
  IconArrowDown,
  IconCopy,
  IconDots,
  IconMessages,
  IconPencil,
  IconSend2,
  IconTrash,
} from "@tabler/icons-react";
import { useAuth } from "../../auth/AuthContext.tsx";
import { UserAvatar } from "../../components/UserAvatar.tsx";
import { useRooms } from "../../hooks/rooms.ts";
import { useIsMobile } from "../../hooks/useIsMobile.ts";
import { MESSAGE_MAX, type ChatMessage } from "../../lib/chatApi.ts";
import { notify } from "../../notify.ts";
import {
  canDelete,
  canEdit,
  dayLabel,
  firstUnreadId,
  flattenPages,
  groupMessages,
  latestFromOthers,
  linkify,
  outgoingToItem,
  pendingToShow,
  showCounter,
  timeLabel,
  typingText,
  type ChatItem,
  type MessageGroup,
} from "./chatUtils.ts";
import { useChatLive, useChatMessages, useDeleteMessage, useEditMessage, useMarkChatRead, useSendMessage } from "./useChat.ts";
import classes from "./Chat.module.css";

interface ChatPanelProps {
  roomId: string;
  /** For the composer's placeholder. */
  roomName?: string;
  /** Room owners can delete anyone's message. Looked up from your room list when not given. */
  isOwner?: boolean;
  /** Focus the composer when the panel opens (the call's chat sheet). */
  autoFocus?: boolean;
}

/** Within this distance of the bottom, new messages keep the view pinned to the end. */
const STICK_PX = 80;
/** Start loading older messages this close to the top. */
const LOAD_OLDER_PX = 240;

/**
 * Room chat: history (older pages load as you scroll up), live messages,
 * replies, edits, deletes, typing and read state. Fills its parent's height.
 */
export function ChatPanel({ roomId, roomName, isOwner: isOwnerProp, autoFocus = false }: ChatPanelProps) {
  const { user } = useAuth();
  const myId = user?.id;
  const rooms = useRooms();
  const isOwner = isOwnerProp ?? rooms.data?.find(room => room.id === roomId)?.role === "owner";

  const query = useChatMessages(roomId);
  const { typing, sendTyping, stoppedTyping } = useChatLive(roomId, myId);
  const { outgoing, send, retry, discard } = useSendMessage(roomId);
  const editMessage = useEditMessage(roomId);
  const deleteMessage = useDeleteMessage(roomId);

  const messages = useMemo(() => flattenPages(query.data?.pages), [query.data]);
  const items = useMemo<ChatItem[]>(() => {
    if (!user) return messages;
    const pending = pendingToShow(messages, outgoing, myId).map(item => outgoingToItem(item, user, roomId));
    return pending.length ? [...messages, ...pending] : messages;
  }, [messages, outgoing, user, myId, roomId]);

  // Where the "New" line goes: fixed from when the chat opened, so it doesn't jump as we mark things read.
  const [unreadFrom, setUnreadFrom] = useState<string | null | undefined>(undefined);
  // Set during render (not in an effect) so the very first scroll can land on it.
  const firstPage = query.data?.pages[0];
  if (unreadFrom === undefined && firstPage) setUnreadFrom(firstUnreadId(messages, firstPage.lastReadAt, myId));

  const days = useMemo(() => groupMessages(items, unreadFrom ?? null), [items, unreadFrom]);
  const latestOther = latestFromOthers(messages, myId)?.id ?? null;
  useMarkChatRead(roomId, latestOther, query.isSuccess);

  // Re-render once a minute so "Edit" disappears when its 15 minutes are up.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  /* ---------------------------------------------------------- scrolling */
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const olderAnchor = useRef<{ height: number; top: number } | null>(null);
  const edges = useRef<{ first: string | null; last: string | null }>({ first: null, last: null });
  const [unseen, setUnseen] = useState(0);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  const loadOlder = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !hasNextPage || isFetchingNextPage) return;
    olderAnchor.current = { height: el.scrollHeight, top: el.scrollTop };
    void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    atBottom.current = true;
    setUnseen(0);
  }, []);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_PX;
    if (atBottom.current) setUnseen(0);
    if (el.scrollTop < LOAD_OLDER_PX) loadOlder();
  };

  useLayoutEffect(() => {
    const el = scrollRef.current;
    const first = items[0]?.id ?? null;
    const last = items.at(-1)?.id ?? null;
    const previous = edges.current;
    edges.current = { first, last };
    if (!el || !last) return;

    // Older page arrived above: keep what you were looking at in place.
    if (olderAnchor.current && first !== previous.first) {
      el.scrollTop = olderAnchor.current.top + (el.scrollHeight - olderAnchor.current.height);
      olderAnchor.current = null;
      return;
    }
    if (last === previous.last) return;

    // First load: open at the "New" line if there is one, else at the end.
    if (previous.last === null) {
      const line = unreadFrom ? el.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(unreadFrom)}"]`) : null;
      if (line) {
        el.scrollTop = Math.max(0, line.offsetTop - 48);
        atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_PX;
      } else scrollToBottom();
      return;
    }

    const newest = items.at(-1)!;
    const mine = newest.userId === myId;
    if (atBottom.current || mine) scrollToBottom(!mine);
    else setUnseen(count => count + 1);
  }, [items, myId, unreadFrom, scrollToBottom]);

  // A short first page that doesn't fill the panel can't be scrolled up: load more straight away.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && query.isSuccess && hasNextPage && !isFetchingNextPage && el.scrollHeight <= el.clientHeight + 8) loadOlder();
  }, [query.isSuccess, hasNextPage, isFetchingNextPage, items.length, loadOlder]);

  /* --------------------------------------------------------- composing */
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ChatItem | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);

  useEffect(() => {
    if (autoFocus) composerRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  const startReply = useCallback((message: ChatMessage) => {
    setReplyTo(message);
    setEditingId(null);
    requestAnimationFrame(() => composerRef.current?.focus());
  }, []);

  const jumpTo = useCallback((messageId: string) => {
    const target = scrollRef.current?.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(messageId)}"]`);
    if (!target) {
      notify("That message is further back. Scroll up to load it.", "info");
      return;
    }
    target.scrollIntoView({ block: "center", behavior: "smooth" });
    setHighlight(messageId);
    window.setTimeout(() => setHighlight(current => (current === messageId ? null : current)), 1900);
  }, []);

  const saveEdit = useCallback(
    async (message: ChatItem, body: string) => {
      if (body === message.body) {
        setEditingId(null);
        return;
      }
      try {
        await editMessage.mutateAsync({ messageId: message.id, body });
        setEditingId(null);
      } catch (error) {
        notify(error instanceof Error ? error.message : "Couldn't save your edit.", "error");
      }
    },
    [editMessage],
  );

  const actions: MessageActions = useMemo(
    () => ({ reply: startReply, edit: setEditingId, remove: setConfirmDelete, retry, discard, jumpTo, saveEdit, cancelEdit: () => setEditingId(null) }),
    [startReply, retry, discard, jumpTo, saveEdit],
  );

  /* ------------------------------------------------------------- render */
  let content;
  if (query.isPending) {
    content = (
      <Center h="100%" role="status">
        <Loader size="sm" aria-hidden="true" />
        <VisuallyHidden>Loading messages…</VisuallyHidden>
      </Center>
    );
  } else if (query.isError) {
    content = (
      <Center h="100%" p="md">
        <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} title="Couldn't load the chat" maw={420}>
          <Text size="sm">{query.error.message}</Text>
          <Button size="xs" variant="light" color="red" mt="xs" onClick={() => void query.refetch()}>
            Try again
          </Button>
        </Alert>
      </Center>
    );
  } else if (items.length === 0) {
    content = (
      <Center h="100%" p="lg">
        <Stack align="center" gap={6} ta="center" maw={300}>
          <ThemeIcon size={48} radius="xl" variant="light">
            <IconMessages size={26} stroke={1.6} />
          </ThemeIcon>
          <Text fw={600} mt={4}>
            No messages yet
          </Text>
          <Text size="sm" c="dimmed">
            Ask a question, share a link, or plan the next study session. Everyone in the room can see it.
          </Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Stack h="100%" mih={0} gap={0} data-testid="chat-panel">
      <Box pos="relative" flex={1} mih={0}>
        <Box ref={scrollRef} h="100%" pos="relative" className={classes.scroller} onScroll={onScroll} px={{ base: "sm", sm: "md" }} pt="sm" pb={4}>
          {content ?? (
            <>
              <Center mih={36} mb="xs">
                {isFetchingNextPage ? (
                  <Loader size="xs" aria-label="Loading earlier messages" />
                ) : hasNextPage ? (
                  <Button variant="subtle" size="xs" color="gray" onClick={loadOlder}>
                    Load earlier messages
                  </Button>
                ) : (
                  <Text size="xs" c="dimmed">
                    This is the start of the room's chat.
                  </Text>
                )}
              </Center>
              <div role="log" aria-live="polite" aria-relevant="additions" aria-label="Room chat" aria-busy={isFetchingNextPage}>
                {days.map(day => (
                  <section key={day.key} aria-label={dayLabel(day.date)}>
                    <Divider my="sm" labelPosition="center" label={<Text size="xs" fw={600} c="dimmed">{dayLabel(day.date)}</Text>} />
                    {day.groups.map(group => (
                      <Box key={group.key}>
                        {unreadFrom && group.items[0].id === unreadFrom && (
                          <Divider my="xs" color="var(--mantine-color-red-4)" labelPosition="right" label={<Text size="xs" fw={700} c="red.7">New</Text>} />
                        )}
                        <MessageGroupView
                          group={group}
                          myId={myId}
                          isOwner={isOwner}
                          now={now}
                          editingId={editingId}
                          highlight={highlight}
                          actions={actions}
                          saving={editMessage.isPending}
                        />
                      </Box>
                    ))}
                  </section>
                ))}
              </div>
            </>
          )}
        </Box>
        {unseen > 0 && (
          <Button
            className={classes.pill}
            size="xs"
            radius="xl"
            rightSection={<IconArrowDown size={14} />}
            onClick={() => scrollToBottom(true)}
            data-testid="new-messages-pill"
            style={{ boxShadow: "var(--mantine-shadow-md)" }}
          >
            {unseen === 1 ? "New message" : `${unseen} new messages`}
          </Button>
        )}
      </Box>

      <Text size="xs" c="dimmed" px={{ base: "sm", sm: "md" }} h={20} lh="20px" truncate data-testid="typing">
        {typingText(typing)}
      </Text>

      <Composer
        inputRef={composerRef}
        roomName={roomName}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        disabled={!user}
        onTyping={sendTyping}
        onSend={body => {
          send(body, replyTo);
          setReplyTo(null);
          stoppedTyping();
          atBottom.current = true;
        }}
      />

      <Modal opened={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete this message?">
        <Stack gap="md">
          <Text size="sm">It will show as "Message deleted" for everyone in the room. This can't be undone.</Text>
          {confirmDelete?.body && (
            <Text size="sm" c="dimmed" lineClamp={3} className={classes.body} style={{ borderLeft: "3px solid var(--mantine-color-default-border)", paddingLeft: 8 }}>
              {confirmDelete.body}
            </Text>
          )}
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => setConfirmDelete(null)} data-autofocus>
              Cancel
            </Button>
            <Button
              color="red"
              loading={deleteMessage.isPending}
              data-testid="confirm-delete-message"
              onClick={() =>
                confirmDelete &&
                deleteMessage.mutate(confirmDelete, {
                  onSuccess: () => setConfirmDelete(null),
                  onError: error => notify(error.message, "error"),
                })
              }
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

interface MessageActions {
  reply: (message: ChatMessage) => void;
  edit: (messageId: string) => void;
  remove: (message: ChatItem) => void;
  retry: (localId: string) => void;
  discard: (localId: string) => void;
  jumpTo: (messageId: string) => void;
  saveEdit: (message: ChatItem, body: string) => Promise<void>;
  cancelEdit: () => void;
}

interface GroupProps {
  group: MessageGroup;
  myId: string | undefined;
  isOwner: boolean;
  now: number;
  editingId: string | null;
  highlight: string | null;
  actions: MessageActions;
  saving: boolean;
}

/** One person's run of messages: avatar and name once, then each message. */
const MessageGroupView = memo(function MessageGroupView({ group, myId, isOwner, now, editingId, highlight, actions, saving }: GroupProps) {
  const mine = !!myId && group.userId === myId;
  const name = mine ? "You" : group.userName;
  return (
    <Group align="flex-start" gap="sm" wrap="nowrap" mt={6} data-testid="message-group">
      <Box pt={4} style={{ flexShrink: 0 }}>
        <UserAvatar name={group.userName} url={group.avatarUrl} size={32} />
      </Box>
      <Stack gap={0} flex={1} miw={0}>
        <Group gap={8} wrap="nowrap" align="baseline">
          <Text size="sm" fw={600} truncate>
            {name}
          </Text>
          <Text size="xs" c="dimmed" style={{ flexShrink: 0 }} component="time" dateTime={group.items[0].createdAt}>
            {timeLabel(group.items[0].createdAt)}
          </Text>
        </Group>
        {group.items.map((item, i) => (
          <MessageRow
            key={item.id}
            item={item}
            speaker={i === 0 ? null : name}
            canEdit={canEdit(item, myId, now)}
            canDelete={canDelete(item, myId, isOwner)}
            editing={editingId === item.id}
            highlighted={highlight === item.id}
            actions={actions}
            saving={saving}
          />
        ))}
      </Stack>
    </Group>
  );
});

interface RowProps {
  item: ChatItem;
  /** For screen readers on follow-up messages (the name is only printed once per run). */
  speaker: string | null;
  canEdit: boolean;
  canDelete: boolean;
  editing: boolean;
  highlighted: boolean;
  actions: MessageActions;
  saving: boolean;
}

function MessageRow({ item, speaker, canEdit, canDelete, editing, highlighted, actions, saving }: RowProps) {
  const mobile = useIsMobile();
  const pending = item.status === "sending";
  const failed = item.status === "failed";

  return (
    <Box
      className={`${classes.row} ${highlighted ? classes.highlight : ""}`}
      data-message-id={item.id}
      data-testid="message"
      data-status={item.status}
      title={timeLabel(item.createdAt)}
      style={{ opacity: pending ? 0.6 : 1 }}
    >
      <Group gap={4} wrap="nowrap" align="flex-start">
        <Box flex={1} miw={0} py={2}>
          {speaker && <VisuallyHidden>{speaker}, {timeLabel(item.createdAt)}:</VisuallyHidden>}
          {item.replyTo && !item.deleted && <ReplyQuote reply={item.replyTo} onJump={actions.jumpTo} />}
          {item.deleted ? (
            <Text size="sm" c="dimmed" fs="italic">
              Message deleted
            </Text>
          ) : editing ? (
            <EditBox item={item} saving={saving} onSave={body => void actions.saveEdit(item, body)} onCancel={actions.cancelEdit} />
          ) : (
            <Text size="sm" className={classes.body}>
              <MessageText text={item.body} />
              {item.editedAt && (
                <Text span size="xs" c="dimmed" ml={6} title={`Edited ${timeLabel(item.editedAt)}`}>
                  (edited)
                </Text>
              )}
            </Text>
          )}
          {pending && (
            <Text size="xs" c="dimmed" role="status">
              Sending…
            </Text>
          )}
          {failed && (
            <Group gap={8} mt={2} role="alert">
              <Text size="xs" c="red.7">
                Not sent.
              </Text>
              <Anchor component="button" type="button" size="xs" fw={600} onClick={() => actions.retry(item.id)}>
                Retry
              </Anchor>
              <Anchor component="button" type="button" size="xs" c="dimmed" onClick={() => actions.discard(item.id)}>
                Discard
              </Anchor>
            </Group>
          )}
        </Box>
        {!item.deleted && !item.status && !editing && (
          <Menu position="bottom-end" withinPortal shadow="md">
            <Menu.Target>
              <ActionIcon
                variant="subtle"
                color="gray"
                size={mobile ? 30 : 24}
                my={-3}
                className={classes.actions}
                aria-label="Message actions"
                data-testid="message-menu"
              >
                <IconDots size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<IconArrowBackUp size={16} />} onClick={() => actions.reply(item)}>
                Reply
              </Menu.Item>
              <Menu.Item
                leftSection={<IconCopy size={16} />}
                onClick={() =>
                  navigator.clipboard?.writeText(item.body).then(
                    () => notify("Copied"),
                    () => notify("Couldn't copy that.", "error"),
                  )
                }
              >
                Copy text
              </Menu.Item>
              {canEdit && (
                <Menu.Item leftSection={<IconPencil size={16} />} onClick={() => actions.edit(item.id)} data-testid="edit-message">
                  Edit
                </Menu.Item>
              )}
              {canDelete && (
                <Menu.Item color="red" leftSection={<IconTrash size={16} />} onClick={() => actions.remove(item)} data-testid="delete-message">
                  Delete
                </Menu.Item>
              )}
            </Menu.Dropdown>
          </Menu>
        )}
      </Group>
    </Box>
  );
}

/** Plain text with web links made clickable. Never parsed as HTML or markdown. */
function MessageText({ text }: { text: string }) {
  const parts = useMemo(() => linkify(text), [text]);
  return (
    <>
      {parts.map((part, i) =>
        part.kind === "link" ? (
          <Anchor key={i} href={part.href} target="_blank" rel="noopener noreferrer nofollow" inherit style={{ overflowWrap: "anywhere" }}>
            {part.text}
          </Anchor>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

function ReplyQuote({ reply, onJump }: { reply: NonNullable<ChatMessage["replyTo"]>; onJump: (id: string) => void }) {
  return (
    <UnstyledButton className={classes.quote} onClick={() => onJump(reply.id)} aria-label={`Reply to ${reply.userName}: ${reply.body || "Message deleted"}. Show it`}>
      <Text size="xs" fw={600} c="dimmed" truncate>
        {reply.userName}
      </Text>
      <Text size="xs" c="dimmed" lineClamp={2} fs={reply.body ? undefined : "italic"} className={classes.body}>
        {reply.body || "Message deleted"}
      </Text>
    </UnstyledButton>
  );
}

function EditBox({ item, saving, onSave, onCancel }: { item: ChatItem; saving: boolean; onSave: (body: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(item.body);
  const trimmed = value.trim();
  const tooLong = trimmed.length > MESSAGE_MAX;
  const save = () => {
    if (!trimmed || tooLong) return;
    onSave(trimmed);
  };
  return (
    <Stack gap={6} py={4}>
      <Textarea
        value={value}
        onChange={event => setValue(event.currentTarget.value)}
        autosize
        minRows={1}
        maxRows={8}
        autoFocus
        aria-label="Edit message"
        error={tooLong ? `${trimmed.length.toLocaleString()} / ${MESSAGE_MAX.toLocaleString()} characters` : undefined}
        onFocus={event => event.currentTarget.setSelectionRange(event.currentTarget.value.length, event.currentTarget.value.length)}
        onKeyDown={event => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onCancel();
          } else if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            save();
          }
        }}
      />
      <Group gap="xs">
        <Button size="compact-sm" onClick={save} loading={saving} disabled={!trimmed || tooLong} data-testid="save-edit">
          Save
        </Button>
        <Button size="compact-sm" variant="default" onClick={onCancel}>
          Cancel
        </Button>
        <Text size="xs" c="dimmed" visibleFrom="sm">
          Enter to save · Esc to cancel
        </Text>
      </Group>
    </Stack>
  );
}

interface ComposerProps {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  roomName?: string;
  replyTo: ChatMessage | null;
  onCancelReply: () => void;
  disabled: boolean;
  onTyping: () => void;
  onSend: (body: string) => void;
}

function Composer({ inputRef, roomName, replyTo, onCancelReply, disabled, onTyping, onSend }: ComposerProps) {
  const [value, setValue] = useState("");
  const trimmed = value.trim();
  const tooLong = trimmed.length > MESSAGE_MAX;
  const canSend = !!trimmed && !tooLong && !disabled;

  const submit = () => {
    if (!canSend) return;
    onSend(trimmed);
    setValue("");
    inputRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    } else if (event.key === "Escape" && replyTo) {
      event.preventDefault();
      event.stopPropagation();
      onCancelReply();
    }
  };

  return (
    <Box px={{ base: "sm", sm: "md" }} pb="sm" pt={4} style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}>
      {replyTo && (
        <Group gap="xs" wrap="nowrap" pt={6} pb={2} data-testid="replying-to">
          <IconArrowBackUp size={16} color="var(--mantine-color-dimmed)" aria-hidden="true" style={{ flexShrink: 0 }} />
          <Text size="xs" c="dimmed" flex={1} miw={0} truncate>
            Replying to{" "}
            <Text span inherit fw={600}>
              {replyTo.userName}
            </Text>
            : {replyTo.body}
          </Text>
          <CloseButton size="sm" aria-label="Cancel reply" onClick={onCancelReply} />
        </Group>
      )}
      <Group gap="xs" wrap="nowrap" align="flex-end" pt={6}>
        <Textarea
          ref={inputRef}
          flex={1}
          value={value}
          onChange={event => {
            setValue(event.currentTarget.value);
            if (event.currentTarget.value.trim()) onTyping();
          }}
          onKeyDown={onKeyDown}
          autosize
          minRows={1}
          maxRows={6}
          radius="lg"
          placeholder={roomName ? `Message ${roomName}` : "Write a message"}
          aria-label="Message the room"
          enterKeyHint="send"
          disabled={disabled}
          data-testid="chat-input"
          styles={{ input: { fontSize: 16 } }}
        />
        <ActionIcon size={42} radius="xl" onClick={submit} disabled={!canSend} aria-label="Send message" data-testid="chat-send">
          <IconSend2 size={20} />
        </ActionIcon>
      </Group>
      {showCounter(trimmed.length, MESSAGE_MAX) && (
        <Text size="xs" ta="right" mt={4} c={tooLong ? "red.7" : "dimmed"} aria-live="polite">
          {trimmed.length.toLocaleString()} / {MESSAGE_MAX.toLocaleString()}
          {tooLong ? " · too long to send" : ""}
        </Text>
      )}
    </Box>
  );
}
