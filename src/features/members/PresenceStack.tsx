import { Avatar, Group, Text, Tooltip } from "@mantine/core";
import type { PresenceUser } from "../../lib/learningApi.ts";
import { initials } from "../../lib/format.ts";

/** "Here now": the people currently viewing this room (live, via the socket). */
export function PresenceStack({ present }: { present: PresenceUser[] }) {
  if (present.length === 0) return null;
  const shown = present.slice(0, 4);
  const names = present.map(user => user.name).join(", ");

  return (
    <Tooltip label={`Here now: ${names}`} withArrow multiline maw={260}>
      <Group gap={6} wrap="nowrap" data-testid="presence" aria-label={`Here now: ${names}`}>
        <span
          aria-hidden="true"
          style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--mantine-color-teal-6)", boxShadow: "0 0 0 3px var(--mantine-color-teal-light)" }}
        />
        <Avatar.Group spacing={6}>
          {shown.map(user => (
            <Avatar key={user.id} src={user.avatarUrl} size={24} radius="xl" color="clay" alt="">
              {initials(user.name)}
            </Avatar>
          ))}
          {present.length > shown.length && (
            <Avatar size={24} radius="xl">
              +{present.length - shown.length}
            </Avatar>
          )}
        </Avatar.Group>
        <Text size="xs" c="dimmed" visibleFrom="xs">
          here now
        </Text>
      </Group>
    </Tooltip>
  );
}
