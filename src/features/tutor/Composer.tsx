import type { Ref } from "react";
import { ActionIcon, Group, Paper, Text, Textarea, Tooltip } from "@mantine/core";
import { IconArrowUp, IconPlayerStopFilled } from "@tabler/icons-react";

export const MAX_CHARS = 4000;
const WARN_AT = 3500;

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop?: () => void;
  /** An answer is streaming: show Stop instead of Send. */
  busy: boolean;
  /** Something else is in flight (e.g. creating the chat). */
  pending?: boolean;
  ref?: Ref<HTMLTextAreaElement>;
}

/** Message box pinned to the bottom of the chat: Enter sends, Shift+Enter adds a line. */
export function Composer({ value, onChange, onSubmit, onStop, busy, pending, ref }: ComposerProps) {
  const length = value.length;
  const tooLong = length > MAX_CHARS;
  const canSend = !busy && !pending && value.trim().length > 0 && !tooLong;

  return (
    <Paper withBorder radius="xl" shadow="xs" pl="md" pr={6} py={6} style={{ borderColor: tooLong ? "var(--mantine-color-red-6)" : undefined }}>
      <Group gap="xs" align="flex-end" wrap="nowrap">
        <Textarea
          ref={ref}
          flex={1}
          variant="unstyled"
          autosize
          minRows={1}
          maxRows={8}
          value={value}
          onChange={event => onChange(event.currentTarget.value)}
          onKeyDown={event => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              if (canSend) onSubmit();
            }
          }}
          placeholder="Ask about your notes…"
          aria-label="Message the tutor"
          enterKeyHint="send"
          data-testid="tutor-input"
          styles={{ input: { fontSize: 16, lineHeight: 1.5, paddingBlock: 8 } }}
        />
        {busy ? (
          <Tooltip label="Stop answering" withArrow>
            <ActionIcon size={40} radius="xl" variant="default" onClick={onStop} aria-label="Stop answering" data-testid="tutor-stop">
              <IconPlayerStopFilled size={16} />
            </ActionIcon>
          </Tooltip>
        ) : (
          <ActionIcon
            size={40}
            radius="xl"
            onClick={onSubmit}
            disabled={!canSend}
            loading={pending}
            aria-label="Send message"
            data-testid="tutor-send"
          >
            <IconArrowUp size={20} stroke={2.2} />
          </ActionIcon>
        )}
      </Group>
      {length > WARN_AT && (
        <Text size="xs" c={tooLong ? "red" : "dimmed"} ta="right" pr="xs" pb={2} aria-live="polite">
          {tooLong
            ? `${(length - MAX_CHARS).toLocaleString()} characters over the limit`
            : `${length.toLocaleString()} / ${MAX_CHARS.toLocaleString()}`}
        </Text>
      )}
    </Paper>
  );
}
