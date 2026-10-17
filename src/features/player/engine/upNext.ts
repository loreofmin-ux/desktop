import type { Track } from "@/shared/types";
import type { PlayerStatus, RepeatMode } from "../store/playerStore";

// how long before the end of a track the next one is announced
export const UP_NEXT_LEAD_MS = 15_000;
// shorter tracks would show the banner for most of their length
const UP_NEXT_MIN_DURATION_MS = 30_000;

export interface UpNextInput {
  status: PlayerStatus;
  queue: Track[];
  currentIndex: number;
  repeat: RepeatMode;
  positionMs: number;
  durationMs: number;
  playbackRate: number;
}

// mirrors the track playerEngine picks when the current one ends on its own
export function getNextTrack(
  input: Pick<UpNextInput, "queue" | "currentIndex" | "repeat">,
): Track | null {
  const { queue, currentIndex, repeat } = input;
  if (queue.length === 0 || currentIndex < 0) return null;
  if (repeat === "one") return null;

  const nextIndex =
    currentIndex + 1 < queue.length ? currentIndex + 1 : repeat === "all" ? 0 : -1;
  if (nextIndex < 0 || nextIndex === currentIndex) return null;
  return queue[nextIndex] ?? null;
}

export function getUpNextTrack(input: UpNextInput): Track | null {
  if (input.status !== "playing" && input.status !== "paused") return null;
  if (input.durationMs < UP_NEXT_MIN_DURATION_MS) return null;

  const rate = input.playbackRate > 0 ? input.playbackRate : 1;
  const remainingMs = (input.durationMs - input.positionMs) / rate;
  if (remainingMs <= 0 || remainingMs > UP_NEXT_LEAD_MS) return null;

  return getNextTrack(input);
}
