import { describe, it, expect } from "vitest";
import type { Track } from "@/shared/types";
import {
  getNextTrack,
  getUpNextTrack,
  UP_NEXT_LEAD_MS,
  type UpNextInput,
} from "./upNext";
import { RADIO_CONTEXT_PREFIX } from "./radioMode";

function track(id: string): Track {
  return {
    id,
    title: `Track ${id}`,
    artists: "Artist",
    coverUrl: "",
    durationMs: 180_000,
    playCount: 0,
  };
}

const queue = [track("a"), track("b"), track("c")];

function input(overrides: Partial<UpNextInput> = {}): UpNextInput {
  return {
    status: "playing",
    queue,
    currentIndex: 0,
    repeat: "off",
    playbackContext: null,
    positionMs: 180_000 - 10_000,
    durationMs: 180_000,
    playbackRate: 1,
    ...overrides,
  };
}

describe("getNextTrack", () => {
  it("returns the following track in the queue", () => {
    expect(getNextTrack(input())?.id).toBe("b");
  });

  it("returns nothing at the end of the queue without repeat", () => {
    expect(getNextTrack(input({ currentIndex: 2 }))).toBeNull();
  });

  it("wraps to the first track when repeat is on", () => {
    expect(getNextTrack(input({ currentIndex: 2, repeat: "all" }))?.id).toBe(
      "a",
    );
  });

  it("does not wrap a radio queue", () => {
    const radio = `${RADIO_CONTEXT_PREFIX}a`;
    expect(
      getNextTrack(
        input({ currentIndex: 2, repeat: "all", playbackContext: radio }),
      ),
    ).toBeNull();
    expect(getNextTrack(input({ playbackContext: radio }))?.id).toBe("b");
  });

  it("returns nothing when the current track repeats", () => {
    expect(getNextTrack(input({ repeat: "one" }))).toBeNull();
  });

  it("returns nothing when repeat would replay the only track", () => {
    expect(
      getNextTrack(input({ queue: [track("a")], repeat: "all" })),
    ).toBeNull();
  });

  it("returns nothing for an empty queue", () => {
    expect(getNextTrack(input({ queue: [], currentIndex: -1 }))).toBeNull();
  });
});

describe("getUpNextTrack", () => {
  it("announces the next track in the last seconds of the current one", () => {
    expect(getUpNextTrack(input())?.id).toBe("b");
    expect(
      getUpNextTrack(input({ positionMs: 180_000 - UP_NEXT_LEAD_MS }))?.id,
    ).toBe("b");
  });

  it("stays hidden earlier in the track", () => {
    expect(
      getUpNextTrack(input({ positionMs: 180_000 - UP_NEXT_LEAD_MS - 1 })),
    ).toBeNull();
    expect(getUpNextTrack(input({ positionMs: 0 }))).toBeNull();
  });

  it("stays hidden once the track has reached its end", () => {
    expect(getUpNextTrack(input({ positionMs: 180_000 }))).toBeNull();
  });

  it("stays hidden for short tracks and unknown durations", () => {
    expect(
      getUpNextTrack(input({ durationMs: 20_000, positionMs: 15_000 })),
    ).toBeNull();
    expect(getUpNextTrack(input({ durationMs: 0, positionMs: 0 }))).toBeNull();
  });

  it("counts the remaining time at the current playback speed", () => {
    const at25sLeft = { positionMs: 180_000 - 25_000 };
    expect(getUpNextTrack(input(at25sLeft))).toBeNull();
    expect(getUpNextTrack(input({ ...at25sLeft, playbackRate: 2 }))?.id).toBe(
      "b",
    );
  });

  it("still shows while paused, but not while loading or idle", () => {
    expect(getUpNextTrack(input({ status: "paused" }))?.id).toBe("b");
    expect(getUpNextTrack(input({ status: "loading" }))).toBeNull();
    expect(getUpNextTrack(input({ status: "idle" }))).toBeNull();
  });
});
