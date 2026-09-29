import { Avatar, type AvatarProps } from "@mantine/core";
import { initials } from "../lib/format.ts";

/** Profile photo, or the person's initials when there isn't one (Mantine falls back if it fails to load). */
export function UserAvatar({ name, url, size = "md" }: { name: string; url: string | null; size?: AvatarProps["size"] }) {
  return (
    <Avatar src={url} alt="" size={size} radius="100%" color="clay" variant="light" aria-hidden="true" imageProps={{ draggable: false }}>
      {initials(name)}
    </Avatar>
  );
}
