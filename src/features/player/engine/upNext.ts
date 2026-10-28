import type { Track } from "@/shared/types";
import type { PlayerStatus, RepeatMode } from "../store/playerStore";
import { isRadioContext } from "./radioMode";

export const UP_NEXT_LEAD_MS = 15_000;
const UP_NEXT_MIN_DURATION_MS = 30_000;

export interface UpNextInput {
  status: PlayerStatus;
  queue: Track[];
  currentIndex: number;
  repeat: RepeatMode;
  playbackContext: string | null;
  positionMs: number;
  durationMs: number;
  playbackRate: number;
}

type NextTrackInput = Pick<
  UpNextInput,
  "queue" | "currentIndex" | "repeat" | "playbackContext"
>;

export function getNextTrack(input: NextTrackInput): Track | null {
  const { queue, currentIndex, repeat, playbackContext } = input;
  if (queue.length === 0 || currentIndex < 0) return null;
  if (repeat === "one") return null;

  if (currentIndex + 1 < queue.length) return queue[currentIndex + 1] ?? null;
  if (repeat !== "all" || isRadioContext(playbackContext)) return null;
  if (currentIndex === 0) return null;
  return queue[0] ?? null;
}

export function getUpNextTrack(input: UpNextInput): Track | null {
  if (input.status !== "playing" && input.status !== "paused") return null;
  if (input.durationMs < UP_NEXT_MIN_DURATION_MS) return null;

  const rate = input.playbackRate > 0 ? input.playbackRate : 1;
  const remainingMs = (input.durationMs - input.positionMs) / rate;
  if (remainingMs <= 0 || remainingMs > UP_NEXT_LEAD_MS) return null;

  return getNextTrack(input);
}
