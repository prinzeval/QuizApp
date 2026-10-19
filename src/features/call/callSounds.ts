/**
 * Call sounds, synthesised with the Web Audio API: no files to load, nothing
 * to license, and they're soft by design (sine tones with a gentle bell-like
 * decay, like Slack huddles and Meet). Browsers only allow sound after the
 * user has clicked something on the page; until then these quietly do nothing.
 */

export type CallSound =
  | "join" // you joined
  | "leave" // you left on purpose
  | "peerJoin" // someone joined your call
  | "peerLeave" // someone left your call
  | "disconnect" // the call dropped unexpectedly
  | "reconnecting"
  | "reconnected"
  | "mute"
  | "unmute";

const PREF_KEY = "smartquiz.callSounds";
const VOLUME = 0.18;

/** A note: frequency in Hz, start offset and length in seconds, and its loudness (0-1). */
type Note = { freq: number; at: number; length: number; gain?: number };

// Note frequencies (equal temperament, A4 = 440 Hz).
const F4 = 349.23, A4 = 440, B4b = 466.16, C5 = 523.25, D5 = 587.33, E5 = 659.25, F5 = 698.46, G5 = 783.99, A5 = 880, C6 = 1046.5;

const SOUNDS: Record<CallSound, Note[]> = {
  // Bright rising major arpeggio: "you're in".
  join: [
    { freq: C5, at: 0, length: 0.35 },
    { freq: E5, at: 0.09, length: 0.35 },
    { freq: G5, at: 0.18, length: 0.55 },
  ],
  // The same, falling: a calm goodbye.
  leave: [
    { freq: G5, at: 0, length: 0.35 },
    { freq: E5, at: 0.1, length: 0.35 },
    { freq: C5, at: 0.2, length: 0.6 },
  ],
  peerJoin: [
    { freq: E5, at: 0, length: 0.3, gain: 0.8 },
    { freq: A5, at: 0.11, length: 0.45, gain: 0.8 },
  ],
  peerLeave: [
    { freq: A5, at: 0, length: 0.3, gain: 0.7 },
    { freq: E5, at: 0.12, length: 0.45, gain: 0.7 },
  ],
  // Minor and falling, a little longer: clearly "something went wrong".
  disconnect: [
    { freq: D5, at: 0, length: 0.3 },
    { freq: B4b, at: 0.16, length: 0.3 },
    { freq: F4, at: 0.32, length: 0.8 },
  ],
  reconnecting: [{ freq: F5, at: 0, length: 0.25, gain: 0.6 }],
  reconnected: [
    { freq: C5, at: 0, length: 0.25, gain: 0.8 },
    { freq: G5, at: 0.09, length: 0.4, gain: 0.8 },
  ],
  // Tiny ticks: lower for mute, higher for unmute.
  mute: [{ freq: A4, at: 0, length: 0.12, gain: 0.5 }],
  unmute: [{ freq: E5, at: 0, length: 0.12, gain: 0.5 }],
};

// "Ding-dong", repeated while someone else's call is ringing.
const RING: Note[] = [
  { freq: E5, at: 0, length: 0.7 },
  { freq: C5, at: 0.32, length: 0.9 },
  { freq: C6, at: 0, length: 0.5, gain: 0.25 },
];
const RING_EVERY_MS = 1800;
const RING_TIMES = 3;

let context: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined" || !("AudioContext" in window)) return null;
  context ??= new AudioContext();
  // Resumes after the first click; harmless if it's already running.
  if (context.state === "suspended") void context.resume().catch(() => undefined);
  return context;
}

/** Whether call sounds are on (remembered per browser; on by default). */
export function callSoundsEnabled(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setCallSoundsEnabled(on: boolean): void {
  try {
    localStorage.setItem(PREF_KEY, on ? "on" : "off");
  } catch {
    /* storage blocked: the choice just won't be remembered */
  }
}

function playNotes(notes: Note[]): void {
  const ctx = audio();
  if (!ctx || ctx.state !== "running") return;
  const start = ctx.currentTime + 0.01;
  for (const { freq, at, length, gain = 1 } of notes) {
    const peak = VOLUME * gain;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, start + at);
    amp.gain.linearRampToValueAtTime(peak, start + at + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + at + length);
    amp.connect(ctx.destination);

    // A sine plus a quiet octave above gives a soft bell rather than a beep.
    for (const [ratio, level] of [
      [1, 1],
      [2, 0.18],
    ] as const) {
      const osc = ctx.createOscillator();
      const partial = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq * ratio, start + at);
      partial.gain.value = level;
      osc.connect(partial).connect(amp);
      osc.start(start + at);
      osc.stop(start + at + length + 0.05);
    }
  }
}

/** Plays one call sound, if sounds are on. */
export function playCallSound(sound: CallSound): void {
  if (callSoundsEnabled()) playNotes(SOUNDS[sound]);
}

/** Rings a few times for an incoming call. Returns a function that stops it early. */
export function ringIncomingCall(): () => void {
  if (!callSoundsEnabled()) return () => undefined;
  let rung = 0;
  playNotes(RING);
  const timer = window.setInterval(() => {
    rung += 1;
    if (rung >= RING_TIMES) return window.clearInterval(timer);
    playNotes(RING);
  }, RING_EVERY_MS);
  return () => window.clearInterval(timer);
}

/** Every sound's notes, for tests. */
export const CALL_SOUND_NOTES = SOUNDS;
