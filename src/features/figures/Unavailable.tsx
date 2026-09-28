import { Center, Stack, Text } from "@mantine/core";
import { IconPhotoOff } from "@tabler/icons-react";

/** Fills a figure frame when its file can't be loaded. */
export function Unavailable() {
  return (
    <Center h="100%" bg="var(--mantine-color-gray-1)">
      <Stack gap={4} align="center" c="dimmed">
        <IconPhotoOff size={28} stroke={1.5} aria-hidden="true" />
        <Text size="xs">Picture unavailable</Text>
      </Stack>
    </Center>
  );
}
