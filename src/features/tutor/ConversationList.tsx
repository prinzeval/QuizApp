import { ActionIcon, Box, Button, NavLink, ScrollArea, Skeleton, Stack, Text, Tooltip } from "@mantine/core";
import { IconMessageCircle, IconPlus, IconTrash } from "@tabler/icons-react";
import type { TutorConversation } from "../../lib/learningApi.ts";
import { timeAgo } from "../../lib/format.ts";
import { useIsMobile } from "../../hooks/useIsMobile.ts";

interface ConversationListProps {
  conversations: TutorConversation[] | undefined;
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (conversation: TutorConversation) => void;
  /** The drawer has its own title bar, so the list doesn't need a heading there. */
  withHeading?: boolean;
}

export function ConversationList({ conversations, loading, selectedId, onSelect, onNew, onDelete, withHeading = true }: ConversationListProps) {
  const mobile = useIsMobile();

  return (
    <Stack gap={0} h="100%" miw={0}>
      <Box p="sm" pb="xs">
        <Button fullWidth variant="default" justify="flex-start" leftSection={<IconPlus size={16} />} onClick={onNew} data-testid="tutor-new-chat">
          New chat
        </Button>
      </Box>
      {withHeading && (
        <Text size="xs" fw={600} c="dimmed" tt="uppercase" px="md" pt="xs" pb={4} style={{ letterSpacing: "0.04em" }}>
          Chats
        </Text>
      )}
      <ScrollArea flex={1} mih={0} px="xs" pb="sm" type="auto">
        {loading && (
          <Stack gap={10} p="xs" aria-label="Loading chats">
            <Skeleton h={36} />
            <Skeleton h={36} />
            <Skeleton h={36} />
          </Stack>
        )}
        {conversations?.length === 0 && (
          <Stack align="center" gap={4} py="xl" px="md">
            <IconMessageCircle size={22} stroke={1.6} color="var(--mantine-color-dimmed)" aria-hidden="true" />
            <Text size="sm" c="dimmed" ta="center">
              Your chats will show up here.
            </Text>
          </Stack>
        )}
        <Stack gap={2} component="ul" m={0} p={0} style={{ listStyle: "none" }} aria-label="Chats">
          {conversations?.map(conversation => {
            const active = conversation.id === selectedId;
            const when = conversation.updatedAt ?? conversation.createdAt;
            return (
              <Box component="li" key={conversation.id} pos="relative" data-testid="tutor-conversation">
                <NavLink
                  component="button"
                  type="button"
                  active={active}
                  aria-current={active ? "page" : undefined}
                  onClick={() => onSelect(conversation.id)}
                  label={conversation.title}
                  description={when ? timeAgo(when) : undefined}
                  pr={48}
                  py={8}
                  styles={{
                    root: { borderRadius: "var(--mantine-radius-md)", minHeight: 44 },
                    label: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: active ? 600 : 500 },
                  }}
                />
                <Tooltip label="Delete chat" withArrow position="right" disabled={mobile}>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size={mobile ? 40 : 30}
                    pos="absolute"
                    right={4}
                    top="50%"
                    style={{ transform: "translateY(-50%)" }}
                    onClick={() => onDelete(conversation)}
                    aria-label={`Delete chat "${conversation.title}"`}
                    data-testid="tutor-delete-conversation"
                  >
                    <IconTrash size={15} />
                  </ActionIcon>
                </Tooltip>
              </Box>
            );
          })}
        </Stack>
      </ScrollArea>
    </Stack>
  );
}
