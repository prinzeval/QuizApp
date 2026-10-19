import type { Room } from "livekit-client";
import { notify } from "../../notify.ts";
import { deviceErrorMessage, type CallDevice } from "./callUtils.ts";

/** Shows why a mic / camera / screen share couldn't start (if there's anything worth saying). */
export function reportDeviceError(device: CallDevice, error: unknown): void {
  const message = deviceErrorMessage(device, error instanceof Error ? error.name : undefined);
  if (message) notify(message, "error");
}

/** Turns a device on (or off), or explains why it couldn't and carries on without it. */
export async function setDevice(room: Room, device: CallDevice, on: boolean): Promise<boolean> {
  try {
    const local = room.localParticipant;
    if (device === "microphone") await local.setMicrophoneEnabled(on);
    else if (device === "camera") await local.setCameraEnabled(on);
    else await local.setScreenShareEnabled(on, { audio: true });
    return true;
  } catch (error) {
    reportDeviceError(device, error);
    return false;
  }
}
