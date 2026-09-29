import { Avatar, type AvatarProps } from "@mantine/core";
import { initials, roomColor } from "../lib/format.ts";
import { roomTone } from "../theme.ts";

/** Coloured initials for a room; the colour is stable per room id. */
export function RoomAvatar({ room, size = "md" }: { room: { id: string; name: string }; size?: AvatarProps["size"] }) {
  return (
    <Avatar size={size} radius="md" color={roomTone(roomColor(room.id))} variant="light" aria-hidden="true" fw={700}>
      {initials(room.name)}
    </Avatar>
  );
}
