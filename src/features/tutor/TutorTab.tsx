import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ActionIcon,
  Box,
  Button,
  Center,
  Drawer,
  EmptyState,
  Group,
  Loader,
  Modal,
  Paper,
  Stack,
  Text,
  Tooltip,
  VisuallyHidden,
} from "@mantine/core";
import { IconAlertCircle, IconMenu2, IconPlus } from "@tabler/icons-react";
import type { Room } from "../../lib/api.ts";
import type { TutorConversation } from "../../lib/learningApi.ts";
import { useConversation, useConversations, useCreateConversation, useDeleteConversation } from "../../hooks/learning.ts";
import { queryKeys } from "../../hooks/queryKeys.ts";
import { useIsMobile } from "../../hooks/useIsMobile.ts";
import { notify } from "../../notify.ts";
import { ChatSession } from "./ChatSession.tsx";
import { ConversationList } from "./ConversationList.tsx";
import { Welcome } from "./Welcome.tsx";

/**
 * Sizes the chat to the viewport so the composer stays pinned at the bottom.
 * On phones the page scrolls the room header away and keeps the tab bar in view.
 */
function usePaneHeight(mobile: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState<number | null>(null);
  const scrollTarget = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const docTop = (node: Element) => node.getBoundingClientRect().top + window.scrollY;
    const tabList = el.closest('[role="tabpanel"]')?.parentElement?.querySelector('[role="tablist"]');
    if (mobile && tabList) {
      const header = parseFloat(getComputedStyle(el).getPropertyValue("--app-shell-header-height")) || 56;
      setOffset(header + (docTop(el) - docTop(tabList)) + 12);
      scrollTarget.current = docTop(tabList) - header;
    } else {
      scrollTarget.current = null;
      setOffset(docTop(el) + 28);
    }
  }, [mobile]);

  // Once the pane has its full height (so the page is tall enough), scroll the room header away.
  useLayoutEffect(() => {
    if (offset === null || scrollTarget.current === null) return;
    window.scrollTo({ top: scrollTarget.current, behavior: "instant" });
    scrollTarget.current = null;
  }, [offset]);

  const height = offset === null ? 560 : `max(${mobile ? 440 : 520}px, calc(100dvh - ${offset}px))`;
  return { ref, height };
}

export function TutorTab({ room }: { room: Room }) {
  const roomId = room.id;
  const mobile = useIsMobile();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("chat");

  const conversations = useConversations(roomId);
  const createConversation = useCreateConversation(roomId);
  const deleteConversation = useDeleteConversation(roomId);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deleting, setDeleting] = useState<TutorConversation | null>(null);
  // The first message of a chat created from the welcome screen, sent once it opens.
  const [pending, setPending] = useState<{ conversationId: string; text: string } | null>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const { ref: paneRef, height } = usePaneHeight(mobile);

  const select = useCallback(
    (id: string | null) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (id) next.set("chat", id);
          else next.delete("chat");
          return next;
        },
        { replace: true },
      );
      setDrawerOpen(false);
    },
    [setSearchParams],
  );

  const newChat = () => {
    select(null);
    // Let the welcome screen mount, then put the cursor in the box (desktop only; phones would pop the keyboard).
    if (!mobile) requestAnimationFrame(() => composer.current?.focus());
  };

  const start = async (text: string) => {
    try {
      const { conversation } = await createConversation.mutateAsync();
      queryClient.setQueryData(queryKeys.conversation(roomId, conversation.id), { conversation, messages: [] });
      setPending({ conversationId: conversation.id, text });
      select(conversation.id);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Couldn't start a chat.", "error");
      throw error;
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const { id } = deleting;
    try {
      await deleteConversation.mutateAsync(id);
      queryClient.removeQueries({ queryKey: queryKeys.conversation(roomId, id), exact: true });
      if (id === selectedId) select(null);
      setDeleting(null);
      notify("Chat deleted");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Couldn't delete this chat.", "error");
    }
  };

  const list = conversations.data?.conversations;
  const title = selectedId ? (list?.find(c => c.id === selectedId)?.title ?? "Chat") : "New chat";
  const onInitialPromptSent = useCallback(() => setPending(null), []);

  const listProps = {
    conversations: list,
    loading: conversations.isPending,
    selectedId,
    onSelect: (id: string) => select(id),
    onNew: newChat,
    onDelete: setDeleting,
  };

  return (
    <>
      <Paper ref={paneRef} withBorder radius="lg" h={height} display="flex" style={{ overflow: "hidden" }} data-testid="tutor-tab">
        {!mobile && (
          <Box w={264} style={{ flexShrink: 0, borderRight: "1px solid var(--mantine-color-default-border)" }} bg="var(--app-sidebar)">
            <ConversationList {...listProps} />
          </Box>
        )}

        <Stack gap={0} flex={1} miw={0}>
          <Group
            gap="xs"
            wrap="nowrap"
            px={mobile ? 6 : "lg"}
            h={mobile ? 52 : 48}
            style={{ flexShrink: 0, borderBottom: "1px solid var(--mantine-color-default-border)" }}
          >
            {mobile && (
              <Button
                variant="subtle"
                color="gray"
                px="xs"
                leftSection={<IconMenu2 size={18} />}
                onClick={() => setDrawerOpen(true)}
                aria-label={`Open chats${list?.length ? ` (${list.length})` : ""}`}
                data-testid="tutor-open-chats"
              >
                Chats
              </Button>
            )}
            <Text fw={600} size="sm" truncate flex={1} miw={0} ta={mobile ? "center" : undefined}>
              {title}
            </Text>
            {mobile && (
              <Tooltip label="New chat" withArrow>
                <ActionIcon variant="subtle" color="gray" size={40} onClick={newChat} aria-label="New chat" data-testid="tutor-new-chat">
                  <IconPlus size={20} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>

          {selectedId ? (
            <OpenChat
              key={selectedId}
              roomId={roomId}
              conversationId={selectedId}
              initialPrompt={pending?.conversationId === selectedId ? pending.text : undefined}
              onInitialPromptSent={onInitialPromptSent}
              onNewChat={newChat}
            />
          ) : (
            <Welcome roomId={roomId} roomName={room.name} onStart={start} starting={createConversation.isPending} composerRef={composer} />
          )}
        </Stack>
      </Paper>

      <Drawer
        opened={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Chats"
        size="85%"
        padding={0}
        styles={{ header: { paddingInline: "var(--mantine-spacing-md)" }, body: { height: "calc(100% - 60px)" } }}
      >
        <ConversationList {...listProps} withHeading={false} />
      </Drawer>

      <Modal opened={!!deleting} onClose={() => setDeleting(null)} title="Delete this chat?">
        <Stack gap="md">
          <Text size="sm">
            <strong>{deleting?.title}</strong> and all its messages will be deleted. This can't be undone.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button color="red" loading={deleteConversation.isPending} onClick={confirmDelete} data-testid="tutor-confirm-delete">
              Delete chat
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

interface OpenChatProps {
  roomId: string;
  conversationId: string;
  initialPrompt?: string;
  onInitialPromptSent: () => void;
  onNewChat: () => void;
}

/** Loads a conversation's history, then hands it to the live chat. */
function OpenChat({ roomId, conversationId, initialPrompt, onInitialPromptSent, onNewChat }: OpenChatProps) {
  const query = useConversation(roomId, conversationId);

  if (query.isPending) {
    return (
      <Center flex={1} role="status">
        <Loader size="sm" aria-hidden="true" />
        <VisuallyHidden>Loading chat…</VisuallyHidden>
      </Center>
    );
  }

  if (query.isError) {
    return (
      <Center flex={1} p="md">
        <EmptyState icon={<IconAlertCircle size={22} />} title="Couldn't open this chat" description={query.error.message}>
          <EmptyState.Actions>
            <Button variant="default" onClick={onNewChat}>
              Start a new chat
            </Button>
          </EmptyState.Actions>
        </EmptyState>
      </Center>
    );
  }

  return (
    <ChatSession
      roomId={roomId}
      conversationId={conversationId}
      initialMessages={query.data.messages}
      initialPrompt={initialPrompt}
      onInitialPromptSent={onInitialPromptSent}
    />
  );
}
