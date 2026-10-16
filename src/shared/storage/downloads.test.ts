import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { linerDb } from "./linerDb";

const track = (id: string, title = id) => ({
  id,
  title,
  artists: "Artist",
  durationMs: 1000,
  coverUrl: "",
  playCount: 0,
});

describe("linerDb.getDownloadedTracks", () => {
  beforeEach(async () => {
    await linerDb.clearAll();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns nothing when no audio is cached", async () => {
    await linerDb.putTrack(track("a"));
    expect(await linerDb.getDownloadedTracks()).toEqual([]);
  });

  it("lists only tracks with both metadata and audio, most recently played first", async () => {
    const blob = new Blob(["x"], { type: "audio/ogg" });
    vi.setSystemTime(1_000);
    await linerDb.putTrack(track("old", "Old"));
    await linerDb.putAudio("old", blob, "audio/ogg");
    vi.setSystemTime(2_000);
    await linerDb.putTrack(track("new", "New"));
    await linerDb.putAudio("new", blob, "audio/ogg");
    // queued but never downloaded
    await linerDb.putTrack(track("queued"));
    // audio without metadata cannot be shown
    await linerDb.putAudio("orphan", blob, "audio/ogg");

    const list = await linerDb.getDownloadedTracks();
    expect(list.map((t) => t.id)).toEqual(["new", "old"]);
    expect(list[0].title).toBe("New");
  });

  it("drops a track once its audio is evicted", async () => {
    const blob = new Blob(["x"], { type: "audio/ogg" });
    await linerDb.putTrack(track("a"));
    await linerDb.putAudio("a", blob, "audio/ogg");
    await linerDb.deleteAudio("a");
    expect(await linerDb.getDownloadedTracks()).toEqual([]);
  });
});
