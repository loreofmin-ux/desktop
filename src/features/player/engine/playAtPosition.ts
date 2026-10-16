import type { Track } from "@/shared/types";
import { playerEngine } from "./playerEngine";
import { usePlayerStore } from "../store/playerStore";

const START_TIMEOUT_MS = 15_000;

// Plays the track from positionMs, starting it first when another track is loaded.
export function playTrackAtPosition(track: Track, positionMs: number): void {
  const target = Math.max(0, Math.round(positionMs));
  const store = usePlayerStore.getState();
  if (store.currentTrack?.id === track.id && store.status !== "error") {
    playerEngine.seek(target, true);
    return;
  }

  let done = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const unsubscribe = usePlayerStore.subscribe((state) => {
    if (done) return;
    if (state.currentTrack?.id !== track.id) return;
    if (state.status === "playing" || state.status === "paused") {
      finish();
      playerEngine.seek(target, true);
    } else if (state.status === "error") {
      finish();
    }
  });

  function finish() {
    done = true;
    unsubscribe();
    if (timer) clearTimeout(timer);
  }

  timer = setTimeout(finish, START_TIMEOUT_MS);
  void playerEngine.playTrack(track).catch(finish);
}

// lead-in so the reported words are heard from the start of the phrase
export const REPORT_LEAD_IN_MS = 2_000;

export function playLyricsReportMoment(report: {
  positionMs: number;
  track: { id: string; title: string; artists: string; durationMs: number; coverUrl?: string };
}): void {
  playTrackAtPosition(
    {
      id: report.track.id,
      title: report.track.title,
      artists: report.track.artists,
      coverUrl: report.track.coverUrl ?? "",
      durationMs: report.track.durationMs,
      playCount: 0,
    },
    report.positionMs - REPORT_LEAD_IN_MS,
  );
}
