import { describe, it, expect } from "vitest";
import { cachedRecordToTrack } from "./useDownloadedTracks";

describe("cachedRecordToTrack", () => {
  it("maps a cached record to a playable track", () => {
    const track = cachedRecordToTrack({
      id: "t1",
      title: "Song",
      artists: "Artist",
      albumId: "al1",
      albumTitle: "Album",
      coverUrl: "https://covers.example/c.jpg",
      durationMs: 1234,
      savedAt: 1,
    });
    expect(track).toEqual({
      id: "t1",
      title: "Song",
      artists: "Artist",
      coverUrl: "https://covers.example/c.jpg",
      durationMs: 1234,
      playCount: 0,
      album: { id: "al1", title: "Album" },
    });
  });

  it("fills missing optional fields", () => {
    const track = cachedRecordToTrack({
      id: "t2",
      title: "Song",
      artists: "Artist",
      durationMs: 0,
      savedAt: 1,
    });
    expect(track.coverUrl).toBe("");
    expect(track.album).toBeUndefined();
  });
});
