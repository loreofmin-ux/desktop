import { describe, it, expect, vi, beforeEach } from "vitest";

const seek = vi.fn();
const playTrack = vi.fn();
vi.mock("./playerEngine", () => ({
  playerEngine: {
    seek: (...a: unknown[]) => seek(...a),
    playTrack: (...a: unknown[]) => playTrack(...a),
  },
}));

import { usePlayerStore } from "../store/playerStore";
import { playTrackAtPosition, playLyricsReportMoment, REPORT_LEAD_IN_MS } from "./playAtPosition";

const track = { id: "t1", title: "T", artists: "A", coverUrl: "", durationMs: 100_000, playCount: 0 };

describe("playTrackAtPosition", () => {
  beforeEach(() => {
    seek.mockReset();
    playTrack.mockReset();
    playTrack.mockResolvedValue(undefined);
    usePlayerStore.setState({ currentTrack: null, status: "idle" });
  });

  it("seeks directly when the track is already loaded", () => {
    usePlayerStore.setState({ currentTrack: track, status: "paused" });
    playTrackAtPosition(track, 42_000);
    expect(seek).toHaveBeenCalledWith(42_000, true);
    expect(playTrack).not.toHaveBeenCalled();
  });

  it("starts the track then seeks once it plays", () => {
    playTrackAtPosition(track, 42_000);
    expect(playTrack).toHaveBeenCalledTimes(1);
    expect(seek).not.toHaveBeenCalled();
    usePlayerStore.setState({ currentTrack: track, status: "loading" });
    expect(seek).not.toHaveBeenCalled();
    usePlayerStore.setState({ status: "playing" });
    expect(seek).toHaveBeenCalledWith(42_000, true);
    // later status changes do not seek again
    usePlayerStore.setState({ status: "paused" });
    usePlayerStore.setState({ status: "playing" });
    expect(seek).toHaveBeenCalledTimes(1);
  });

  it("gives up when the track fails to load", () => {
    playTrackAtPosition(track, 42_000);
    usePlayerStore.setState({ currentTrack: track, status: "error" });
    usePlayerStore.setState({ status: "playing" });
    expect(seek).not.toHaveBeenCalled();
  });

  it("starts a report a little before the reported moment, never below zero", () => {
    usePlayerStore.setState({ currentTrack: track, status: "playing" });
    playLyricsReportMoment({ positionMs: 10_000, track });
    expect(seek).toHaveBeenLastCalledWith(10_000 - REPORT_LEAD_IN_MS, true);
    playLyricsReportMoment({ positionMs: 500, track });
    expect(seek).toHaveBeenLastCalledWith(0, true);
  });
});
