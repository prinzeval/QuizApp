import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type Ref } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useQueryClient } from "@tanstack/react-query";
import { ActionIcon, Alert, Box, Button, Group, ScrollArea, Stack, Text, VisuallyHidden } from "@mantine/core";
import { IconAlertCircle, IconArrowDown, IconRefresh } from "@tabler/icons-react";
import { useAuth } from "../../auth/AuthContext.tsx";
import { tokenStore } from "../../lib/api.ts";
import { learningApi, type StoredTutorMessage, type TutorConversation } from "../../lib/learningApi.ts";
import { queryKeys } from "../../hooks/queryKeys.ts";
import { Composer } from "./Composer.tsx";
import { AssistantMessage, Typing, UserMessage } from "./Messages.tsx";
import { chatErrorMessage, messageText, type TutorUIMessage } from "./citations.ts";

/** How close to the bottom (px) still counts as "following along". */
const STICKY_PX = 80;

interface ChatFrameProps {
  children: ReactNode;
  composer: ReactNode;
  /** Changes whenever the content grows (new tokens), to keep following the bottom. */
  followKey?: unknown;
  /** Bump to jump to the bottom (e.g. after sending). */
  scrollSignal?: number;
  /** Stick to the newest message (off for the welcome screen, which reads top-down). */
  follow?: boolean;
}

/** Scrollable message column with the composer pinned underneath. */
export function ChatFrame({ children, composer, followKey, scrollSignal, follow = true }: ChatFrameProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const following = useRef(follow);
  const [atBottom, setAtBottom] = useState(true);

  const toBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const el = viewport.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  // Stream in place: only follow the bottom if the reader hasn't scrolled up.
  useLayoutEffect(() => {
    if (following.current) toBottom();
  }, [followKey, toBottom]);

  useLayoutEffect(() => {
    if (!follow) return;
    following.current = true;
    toBottom();
  }, [scrollSignal, follow, toBottom]);

  // Content can also grow without new tokens (Markdown/KaTeX loading, images); keep following it.
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = content.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => following.current && toBottom());
    observer.observe(el);
    return () => observer.disconnect();
  }, [toBottom]);

  return (
    <Stack gap={0} flex={1} mih={0}>
      <Box pos="relative" flex={1} mih={0}>
        <ScrollArea
          h="100%"
          viewportRef={viewport}
          type="auto"
          onScrollPositionChange={() => {
            const el = viewport.current;
            if (!el) return;
            const near = el.scrollHeight - el.scrollTop - el.clientHeight < STICKY_PX;
            if (!follow) return;
            following.current = near;
            setAtBottom(near);
          }}
        >
          <Box ref={content} maw={760} mx="auto" px={{ base: "sm", sm: "xl" }} py={{ base: "md", sm: "xl" }}>
            {children}
          </Box>
        </ScrollArea>
        {!atBottom && (
          <ActionIcon
            variant="default"
            radius="xl"
            size={40}
            pos="absolute"
            bottom={12}
            left="50%"
            style={{ transform: "translateX(-50%)", boxShadow: "var(--mantine-shadow-sm)" }}
            onClick={() => {
              following.current = true;
              toBottom("smooth");
            }}
            aria-label="Jump to latest message"
          >
            <IconArrowDown size={18} />
          </ActionIcon>
        )}
      </Box>
      <Box px={{ base: "sm", sm: "xl" }} pb={{ base: "sm", sm: "md" }} pt={4}>
        <Box maw={760} mx="auto">
          {composer}
          <Text size="xs" c="dimmed" ta="center" mt={6} visibleFrom="xs">
            Answers come from your room's materials. Check the sources for anything important.
          </Text>
        </Box>
      </Box>
    </Stack>
  );
}

interface ChatSessionProps {
  roomId: string;
  conversationId: string;
  initialMessages: StoredTutorMessage[];
  /** Sent once on mount (a suggested prompt, or the first message typed before the chat existed). */
  initialPrompt?: string;
  onInitialPromptSent?: () => void;
  composerRef?: Ref<HTMLTextAreaElement>;
}

/** One open conversation: streams answers from the tutor and keeps the cache in sync. */
export function ChatSession({ roomId, conversationId, initialMessages, initialPrompt, onInitialPromptSent, composerRef }: ChatSessionProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [scrollSignal, setScrollSignal] = useState(0);
  const [answered, setAnswered] = useState(false);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<TutorUIMessage>({
        api: learningApi.chatUrl(roomId, conversationId),
        headers: () => ({ Authorization: `Bearer ${tokenStore.get() ?? ""}` }),
        // The server keeps the history; it only wants the newest message.
        prepareSendMessagesRequest: ({ messages }) => ({ body: { message: messages[messages.length - 1] } }),
      }),
    [roomId, conversationId],
  );

  const { messages, sendMessage, status, stop, error, regenerate } = useChat<TutorUIMessage>({
    id: conversationId,
    messages: initialMessages as TutorUIMessage[],
    transport,
    throttle: 40,
    onFinish: ({ messages: all, isError }) => {
      // Keep the cached copy current so reopening this chat shows the whole thread.
      queryClient.setQueryData<{ conversation: TutorConversation; messages: StoredTutorMessage[] }>(
        queryKeys.conversation(roomId, conversationId),
        old => (old ? { ...old, messages: all as StoredTutorMessage[] } : old),
      );
      // The title comes from the first question, and the order from the latest reply.
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations(roomId), exact: true });
      if (!isError) setAnswered(true);
    },
  });

  const busy = status === "submitted" || status === "streaming";

  const send = useCallback(
    (text: string) => {
      setAnswered(false);
      setScrollSignal(n => n + 1);
      void sendMessage({ text });
    },
    [sendMessage],
  );

  const sentInitial = useRef(false);
  useEffect(() => {
    if (!initialPrompt || sentInitial.current) return;
    // Deferred so a StrictMode remount (whose cleanup stops the chat) can't cancel it.
    const timer = setTimeout(() => {
      sentInitial.current = true;
      send(initialPrompt);
      onInitialPromptSent?.();
    }, 0);
    return () => clearTimeout(timer);
  }, [initialPrompt, onInitialPromptSent, send]);

  const retry = () => {
    setScrollSignal(n => n + 1);
    void regenerate();
  };

  const last = messages[messages.length - 1];
  const lastAssistantId = last?.role === "assistant" ? last.id : null;
  const followKey = last ? `${messages.length}:${messageText(last).length}:${status}` : status;

  return (
    <ChatFrame
      followKey={followKey}
      scrollSignal={scrollSignal}
      composer={
        <Composer
          ref={composerRef}
          value={input}
          onChange={setInput}
          busy={busy}
          onStop={() => void stop()}
          onSubmit={() => {
            const text = input.trim();
            if (!text) return;
            setInput("");
            send(text);
          }}
        />
      }
    >
      <Stack gap="xl" role="log" aria-label="Conversation" aria-busy={busy}>
        {messages.map(message =>
          message.role === "user" ? (
            <UserMessage key={message.id} message={message} name={user?.name ?? "You"} avatarUrl={user?.avatarUrl ?? null} />
          ) : (
            <AssistantMessage
              key={message.id}
              message={message}
              streaming={busy && message.id === lastAssistantId}
              onRegenerate={!busy && message.id === lastAssistantId ? retry : undefined}
            />
          ),
        )}
        {status === "submitted" && last?.role === "user" && <Typing />}
        {error && !busy && (
          <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} title="The tutor couldn't answer" role="alert">
            <Group justify="space-between" gap="sm" align="center">
              <Text size="sm" flex={1} miw={180}>
                {chatErrorMessage(error)}
              </Text>
              <Button size="xs" variant="default" leftSection={<IconRefresh size={14} />} onClick={retry}>
                Try again
              </Button>
            </Group>
          </Alert>
        )}
      </Stack>
      <VisuallyHidden aria-live="polite" aria-atomic="true">
        {busy ? "The tutor is writing an answer…" : answered && last?.role === "assistant" ? `Tutor answered: ${messageText(last)}` : ""}
      </VisuallyHidden>
    </ChatFrame>
  );
}
