import { lazy, memo, Suspense, useCallback, useMemo } from "react";
import { ActionIcon, Box, CopyButton, Group, Loader, Paper, Stack, Text, ThemeIcon, Tooltip } from "@mantine/core";
import { IconCheck, IconCopy, IconRefresh, IconSparkles } from "@tabler/icons-react";
import { UserAvatar } from "../../components/UserAvatar.tsx";
import { useIsMobile } from "../../hooks/useIsMobile.ts";
import { CitationChip, SourcesRow } from "./Citation.tsx";
import { citedTags, messageSources, messageText, type TutorUIMessage } from "./citations.ts";

// Markdown + KaTeX are heavy; load them with the first answer.
const Markdown = lazy(() => import("./Markdown.tsx").then(module => ({ default: module.Markdown })));

export function TutorAvatar() {
  return (
    <ThemeIcon size={32} radius="xl" variant="light" aria-hidden="true" style={{ flexShrink: 0 }}>
      <IconSparkles size={18} stroke={1.8} />
    </ThemeIcon>
  );
}

export const UserMessage = memo(function UserMessage({
  message,
  name,
  avatarUrl,
}: {
  message: TutorUIMessage;
  name: string;
  avatarUrl: string | null;
}) {
  return (
    <Group justify="flex-end" align="flex-start" gap="sm" wrap="nowrap" data-testid="tutor-message-user">
      <Paper bg="var(--mantine-primary-color-light)" px="md" py={10} radius="lg" maw="min(85%, 560px)" style={{ borderTopRightRadius: 6 }}>
        <Text fz={{ base: 15, sm: 16 }} lh={1.55} style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
          {messageText(message)}
        </Text>
      </Paper>
      <Box visibleFrom="xs">
        <UserAvatar name={name} url={avatarUrl} size={32} />
      </Box>
    </Group>
  );
});

/** Three bouncing dots while the tutor is thinking. */
export function Typing() {
  return (
    <Group gap="sm" align="center" wrap="nowrap" data-testid="tutor-typing">
      <TutorAvatar />
      <Loader type="dots" size="sm" color="gray" aria-hidden="true" />
    </Group>
  );
}

interface AssistantMessageProps {
  message: TutorUIMessage;
  streaming: boolean;
  /** Only the latest answer can be regenerated. */
  onRegenerate?: () => void;
}

export const AssistantMessage = memo(function AssistantMessage({ message, streaming, onRegenerate }: AssistantMessageProps) {
  const mobile = useIsMobile();
  const text = messageText(message);
  const sources = messageSources(message);
  const byTag = useMemo(() => new Map(sources.map(source => [source.tag, source])), [sources]);
  const cited = useMemo(() => citedTags(text).flatMap(tag => byTag.get(tag) ?? []), [text, byTag]);
  const renderCitation = useCallback((tag: string) => <CitationChip key={tag} tag={tag} source={byTag.get(tag)} />, [byTag]);
  const actionSize = mobile ? 40 : 30;

  return (
    <Group align="flex-start" gap="sm" wrap="nowrap" data-testid="tutor-message-assistant">
      <TutorAvatar />
      <Stack gap="xs" flex={1} miw={0} pt={4}>
        {text ? (
          <Suspense fallback={<Text style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{text}</Text>}>
            <Markdown text={text} renderCitation={renderCitation} />
          </Suspense>
        ) : (
          <Loader type="dots" size="sm" color="gray" aria-hidden="true" mt={4} />
        )}
        {!streaming && text && (
          <>
            <SourcesRow sources={cited} />
            <Group gap={2} ml={-6}>
              <CopyButton value={text} timeout={1600}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? "Copied" : "Copy answer"} withArrow>
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      size={actionSize}
                      onClick={copy}
                      aria-label={copied ? "Copied" : "Copy answer"}
                      data-testid="tutor-copy"
                    >
                      {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                    </ActionIcon>
                  </Tooltip>
                )}
              </CopyButton>
              {onRegenerate && (
                <Tooltip label="Regenerate answer" withArrow>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size={actionSize}
                    onClick={onRegenerate}
                    aria-label="Regenerate answer"
                    data-testid="tutor-regenerate"
                  >
                    <IconRefresh size={16} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
          </>
        )}
      </Stack>
    </Group>
  );
});
