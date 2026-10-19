import { Box } from "@mantine/core";
import { useIsMobile } from "../../hooks/useIsMobile.ts";
import { useCall } from "./callContext.ts";

/** Height of the phone call bar (without the safe area). */
export const MOBILE_BAR_HEIGHT = 64;

/** Roughly the desktop dock's height with one row of tiles, and the pill's. */
const DOCK_ROOM = 260;
const PILL_ROOM = 72;

/**
 * Extra scroll room at the bottom of the page while you're in a call, so the
 * floating dock / pill / phone bar never sits on top of the last buttons (e.g. a quiz's).
 */
export function CallSpacer() {
  const { active, view } = useCall();
  const mobile = useIsMobile();
  if (!active || view === "full") return null;
  const height = mobile ? `calc(${MOBILE_BAR_HEIGHT + 16}px + env(safe-area-inset-bottom))` : view === "pill" ? PILL_ROOM : DOCK_ROOM;
  return <Box aria-hidden="true" h={height} />;
}
