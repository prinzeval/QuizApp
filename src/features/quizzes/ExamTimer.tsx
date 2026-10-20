import { useEffect, useRef, useState } from "react";
import { Group, Text, VisuallyHidden } from "@mantine/core";
import { IconClock } from "@tabler/icons-react";
import { WARNING_MS, countdownLabel, formatCountdown, remainingMs } from "./quizTime.ts";

interface ExamTimerProps {
  deadlineAt: string;
  /** A few seconds before the end: send anything still waiting to be saved. */
  onAlmostUp?: () => void;
  /** Once, when the countdown reaches zero. */
  onExpire: () => void;
}

const ALMOST_UP_MS = 3000;

/** The exam countdown: mm:ss, a warning colour for the last 2 minutes, and a spoken "1 minute left". */
export function ExamTimer({ deadlineAt, onAlmostUp, onExpire }: ExamTimerProps) {
  const [left, setLeft] = useState(() => remainingMs(deadlineAt, Date.now()));
  const [announcement, setAnnouncement] = useState("");
  const fired = useRef({ minute: false, almost: false, expired: false });
  const callbacks = useRef({ onAlmostUp, onExpire });
  callbacks.current = { onAlmostUp, onExpire };

  useEffect(() => {
    fired.current = { minute: false, almost: false, expired: false };
    const startedWith = remainingMs(deadlineAt, Date.now());
    // Opened with under a minute to go: say so once, the same way.
    if (startedWith > 0 && startedWith <= 60_000) {
      fired.current.minute = true;
      setAnnouncement("Less than 1 minute left");
    }
    const tick = () => {
      const ms = remainingMs(deadlineAt, Date.now());
      setLeft(ms);
      if (!fired.current.minute && ms <= 60_000 && ms > 0) {
        fired.current.minute = true;
        setAnnouncement("1 minute left");
      }
      if (!fired.current.almost && ms <= ALMOST_UP_MS) {
        fired.current.almost = true;
        callbacks.current.onAlmostUp?.();
      }
      if (!fired.current.expired && ms <= 0) {
        fired.current.expired = true;
        setAnnouncement("Time's up");
        callbacks.current.onExpire();
      }
    };
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [deadlineAt]);

  const warning = left <= WARNING_MS;
  return (
    <>
      <Group
        gap={4}
        wrap="nowrap"
        role="timer"
        aria-label={countdownLabel(left)}
        data-testid="exam-timer"
        data-warning={warning || undefined}
        px={8}
        py={2}
        style={{
          flexShrink: 0,
          borderRadius: "var(--mantine-radius-xl)",
          background: warning ? "var(--mantine-color-red-light)" : "var(--mantine-color-default-hover)",
          color: warning ? "var(--mantine-color-red-light-color)" : "var(--mantine-color-text)",
          transition: "background-color 200ms ease, color 200ms ease",
        }}
      >
        <IconClock size={14} aria-hidden="true" />
        <Text size="sm" fw={700} c="inherit" style={{ fontVariantNumeric: "tabular-nums" }} aria-hidden="true">
          {formatCountdown(left)}
        </Text>
      </Group>
      <VisuallyHidden role="status" aria-live="assertive">
        {announcement}
      </VisuallyHidden>
    </>
  );
}
