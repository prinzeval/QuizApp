import type { Room } from "livekit-client";

/**
 * How loud other people are, as a gain (1 = normal).
 *
 * Phones play browser calls quietly on the loudspeaker: while the mic is on
 * they switch to "voice call" audio, and a web page can't pick speaker vs
 * earpiece the way the phone app can. So on phones, call audio is played
 * through Web Audio with a limiter (see createBoostedAudio), which lets us
 * boost it up to 300% without loud voices crackling; phones start at 160%.
 * Computers keep normal playback (their echo cancellation expects it) and go
 * up to 100%. Remembered per browser.
 */

const PREF_KEY = "smartquiz.callVolume";
export const PHONE_MAX = 3;
export const DESKTOP_MAX = 1;
/** The slider's range on this device. */
export const volumeRange = () => ({ min: 0.5, max: isPhoneLike() ? PHONE_MAX : DESKTOP_MAX });
export const DESKTOP_VOLUME = 1;
export const PHONE_VOLUME = 1.6;

export const clampVolume = (value: number) => {
  const { min, max } = volumeRange();
  return Math.min(max, Math.max(min, value));
};

/** Touch-first device: its loudspeaker is the quiet one. */
export function isPhoneLike(): boolean {
  try {
    return window.matchMedia("(pointer: coarse)").matches && window.matchMedia("(max-width: 1024px)").matches;
  } catch {
    return false;
  }
}

export function savedCallVolume(): number {
  try {
    const raw = Number(localStorage.getItem(PREF_KEY));
    if (raw > 0) return clampVolume(raw);
  } catch {
    /* storage blocked: use the default */
  }
  return isPhoneLike() ? PHONE_VOLUME : DESKTOP_VOLUME;
}

export function saveCallVolume(value: number): void {
  try {
    localStorage.setItem(PREF_KEY, String(clampVolume(value)));
  } catch {
    /* storage blocked: the choice just won't be remembered */
  }
}

/** Sets everyone else's voice (and shared-screen audio) in the call to this volume. */
export function applyCallVolume(room: Room, value: number): void {
  const volume = clampVolume(value);
  room.remoteParticipants.forEach(participant => participant.setVolume(volume));
}

/** "160%" */
export const volumeLabel = (value: number) => `${Math.round(clampVolume(value) * 100)}%`;

/**
 * An AudioContext whose output runs through a limiter, for phone calls. LiveKit
 * plays each voice as source → gain (our volume) → `context.destination`; here
 * `destination` is a compressor set up as a limiter, so boosted voices get
 * louder but peaks are capped smoothly instead of clipping.
 */
export function createBoostedAudio(): AudioContext | null {
  if (typeof AudioContext === "undefined") return null;
  const context = new AudioContext({ latencyHint: "interactive" });
  const output = context.destination;
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.knee.value = 6;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.2;
  limiter.connect(output);
  Object.defineProperty(context, "destination", { value: limiter, configurable: true });
  return context;
}
