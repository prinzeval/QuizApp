import { notifications } from "@mantine/notifications";

type Tone = "success" | "error" | "info";

const COLORS: Record<Tone, string> = { success: "teal", error: "red", info: "clay" };

/** A short toast in the corner. Errors stay a little longer. */
export function notify(message: string, tone: Tone = "success"): void {
  notifications.show({ message, color: COLORS[tone], autoClose: tone === "error" ? 6000 : 4000, withBorder: true });
}
