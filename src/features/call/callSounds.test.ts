import { afterEach, describe, expect, it } from "vitest";
import { CALL_SOUND_NOTES, callSoundsEnabled, setCallSoundsEnabled } from "./callSounds.ts";

// Tests run in Node: a tiny in-memory stand-in for the browser's localStorage.
const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: key => store.get(key) ?? null,
  setItem: (key, value) => void store.set(key, String(value)),
  removeItem: key => void store.delete(key),
  clear: () => store.clear(),
  key: index => [...store.keys()][index] ?? null,
  get length() {
    return store.size;
  },
} as Storage;

describe("call sounds", () => {
  afterEach(() => store.clear());

  it("are on by default and remember being turned off", () => {
    expect(callSoundsEnabled()).toBe(true);
    setCallSoundsEnabled(false);
    expect(callSoundsEnabled()).toBe(false);
    setCallSoundsEnabled(true);
    expect(callSoundsEnabled()).toBe(true);
  });

  it("rise when you join and fall when you leave or drop", () => {
    const pitches = (name: keyof typeof CALL_SOUND_NOTES) => CALL_SOUND_NOTES[name].map(note => note.freq);
    const rising = (values: number[]) => values.every((value, index) => index === 0 || value > values[index - 1]);
    const falling = (values: number[]) => values.every((value, index) => index === 0 || value < values[index - 1]);
    expect(rising(pitches("join"))).toBe(true);
    expect(rising(pitches("peerJoin"))).toBe(true);
    expect(falling(pitches("leave"))).toBe(true);
    expect(falling(pitches("peerLeave"))).toBe(true);
    expect(falling(pitches("disconnect"))).toBe(true);
    // The drop sound ends lower and lasts longer than a normal leave, so you can tell them apart.
    const end = (name: keyof typeof CALL_SOUND_NOTES) => Math.max(...CALL_SOUND_NOTES[name].map(note => note.at + note.length));
    expect(pitches("disconnect").at(-1)!).toBeLessThan(pitches("leave").at(-1)!);
    expect(end("disconnect")).toBeGreaterThan(end("leave"));
  });
});
