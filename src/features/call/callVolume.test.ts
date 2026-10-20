import { afterEach, describe, expect, it } from "vitest";
import { clampVolume, DESKTOP_VOLUME, PHONE_VOLUME, saveCallVolume, savedCallVolume, volumeLabel, volumeRange } from "./callVolume.ts";

// Tests run in Node: stand-ins for the browser's localStorage and matchMedia.
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
let phone = false;
globalThis.window = { matchMedia: (query: string) => ({ matches: phone && /coarse|max-width/.test(query) }) } as unknown as Window & typeof globalThis;

describe("call volume", () => {
  afterEach(() => {
    store.clear();
    phone = false;
  });

  it("starts louder on phones, whose loudspeaker plays calls quietly", () => {
    expect(savedCallVolume()).toBe(DESKTOP_VOLUME);
    phone = true;
    expect(savedCallVolume()).toBe(PHONE_VOLUME);
    expect(PHONE_VOLUME).toBeGreaterThan(1);
  });

  it("remembers your choice: up to 300% on phones, 100% on computers", () => {
    phone = true;
    saveCallVolume(2.2);
    expect(savedCallVolume()).toBe(2.2);
    saveCallVolume(9);
    expect(savedCallVolume()).toBe(3);
    expect(clampVolume(0.1)).toBe(0.5);
    phone = false;
    // A computer plays calls normally (its echo cancellation expects that), so no boost.
    expect(savedCallVolume()).toBe(1);
    expect(volumeRange().max).toBe(1);
  });

  it("shows as a percentage", () => {
    phone = true;
    expect(volumeLabel(1.6)).toBe("160%");
    expect(volumeLabel(1)).toBe("100%");
  });
});
