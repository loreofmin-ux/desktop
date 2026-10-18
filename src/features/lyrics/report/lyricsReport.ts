import type { SyncedLine } from "../engine/lyricsParser";
import type { LyricsProviderOption } from "../store/lyricsStore";

export type LyricsReportKind = "wrong_words" | "out_of_sync";

// local: kept on this device only; sent: accepted by the server; failed: the send was refused
export type LyricsReportStatus = "local" | "sent" | "failed";

export type LyricsReportOrigin = "drawer" | "fullscreen";

export interface LyricsReportWord {
  text: string;
  startMs: number;
  endMs: number;
}

export interface LyricsReportLine {
  index: number;
  text: string;
  // timings as delivered by the provider, before the user's offset is applied
  startMs: number | null;
  endMs: number | null;
  words?: LyricsReportWord[];
  // "clicked": the user right-clicked this line; "active": the line being sung at report time
  picked: "clicked" | "active";
}

export interface LyricsReport {
  id: string;
  createdAt: string;
  kind: LyricsReportKind;
  status: LyricsReportStatus;
  origin: LyricsReportOrigin;
  note?: string;
  track: {
    id: string;
    title: string;
    artists: string;
    durationMs: number;
    coverUrl?: string;
    album?: string;
  };
  // song position when the report was sent, in the track's own time
  positionMs: number;
  offsetMs: number;
  line: LyricsReportLine | null;
  context: {
    before: string[];
    after: string[];
  };
  lyrics: {
    provider: string | null;
    format: string | null;
    syncLevel: string | null;
    quality: number;
    lineCount: number;
    contentHash: string | null;
  };
  client: {
    appVersion: string;
    locale: string;
  };
}

export interface LyricsReportTrack {
  id: string;
  title: string;
  artists: string;
  durationMs: number;
  coverUrl?: string;
  album?: { title: string } | null;
}

export interface LyricsReportLyricsState {
  currentLyricsTrackId: string | null;
  rawLyrics: string | null;
  rawFormat: string | null;
  plainLyrics: string | null;
  baseSyncedLines: SyncedLine[];
  activeProvider: string | null;
  availableProviders: LyricsProviderOption[];
  lyricsQuality: number;
  offsetMs: number;
  activeLineIndex: number | null;
}

export interface LyricsReportTarget {
  // index in the lines the view rendered; null means "whatever is being sung now"
  lineIndex: number | null;
  // text the user actually saw on screen for that line
  lineText?: string | null;
}

export interface BuildLyricsReportInput {
  kind: LyricsReportKind;
  origin: LyricsReportOrigin;
  target: LyricsReportTarget;
  track: LyricsReportTrack;
  positionMs: number;
  lyrics: LyricsReportLyricsState;
  appVersion: string;
  locale: string;
  now?: Date;
  id?: string;
}

const CONTEXT_LINES = 2;

// FNV-1a, enough to tell two versions of the same lyrics apart without storing them
export function hashLyricsContent(content: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function createReportId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `lr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function stripLineTags(text: string): string {
  return text.replace(/^\s*<[^>]+>\s*/, "").trim();
}

function isSynced(lines: SyncedLine[]): boolean {
  return lines.some((line) => line.timeMs > 0);
}

// index of the line being sung at positionMs in provider time
export function findLineAtPosition(lines: SyncedLine[], positionMs: number): number | null {
  let found: number | null = null;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].timeMs <= positionMs) {
      found = i;
    } else {
      break;
    }
  }
  return found;
}

function lineEndMs(lines: SyncedLine[], index: number): number | null {
  const line = lines[index];
  const words = line.words ?? [];
  if (words.length > 0) return words[words.length - 1].endMs;
  if (line.durationMs && line.durationMs > 0) return line.timeMs + line.durationMs;
  const next = lines[index + 1];
  return next ? next.timeMs : null;
}

function plainLines(plain: string | null): string[] {
  return (plain ?? "").split("\n").map((l) => stripLineTags(l));
}

export function buildLyricsReport(input: BuildLyricsReportInput): LyricsReport {
  const { lyrics, target, track } = input;
  const matchesTrack = lyrics.currentLyricsTrackId === track.id;
  const synced = matchesTrack ? lyrics.baseSyncedLines : [];
  const timed = isSynced(synced);
  // synced lines carry the user's offset in the view, so the song position maps back by removing it
  const providerPositionMs = Math.max(0, input.positionMs - lyrics.offsetMs);

  let line: LyricsReportLine | null = null;
  let texts: string[] = [];

  if (synced.length > 0) {
    texts = synced.map((l) => stripLineTags(l.text ?? ""));
    let index: number | null = target.lineIndex;
    let picked: LyricsReportLine["picked"] = "clicked";
    if (index === null || index < 0 || index >= synced.length) {
      picked = "active";
      index = timed
        ? findLineAtPosition(synced, providerPositionMs)
        : lyrics.activeLineIndex !== null && lyrics.activeLineIndex < synced.length
          ? lyrics.activeLineIndex
          : null;
    }
    if (index !== null) {
      const source = synced[index];
      const words = (source.words ?? [])
        .filter((w) => w.text.trim().length > 0)
        .map((w) => ({ text: w.text, startMs: w.timeMs, endMs: w.endMs }));
      line = {
        index,
        text: target.lineText?.trim() || texts[index],
        startMs: timed ? source.timeMs : null,
        endMs: timed ? lineEndMs(synced, index) : null,
        ...(words.length > 0 && timed ? { words } : {}),
        picked,
      };
    }
  } else if (matchesTrack) {
    texts = plainLines(lyrics.plainLyrics);
    const index = target.lineIndex;
    if (index !== null && index >= 0 && index < texts.length) {
      line = {
        index,
        text: target.lineText?.trim() || texts[index],
        startMs: null,
        endMs: null,
        picked: "clicked",
      };
    }
  }

  const before: string[] = [];
  const after: string[] = [];
  if (line) {
    for (let i = line.index - 1; i >= 0 && before.length < CONTEXT_LINES; i--) {
      if (texts[i]) before.unshift(texts[i]);
    }
    for (let i = line.index + 1; i < texts.length && after.length < CONTEXT_LINES; i++) {
      if (texts[i]) after.push(texts[i]);
    }
  }

  const providerOption = lyrics.availableProviders.find(
    (p) => p.provider === lyrics.activeProvider,
  );

  return {
    id: input.id ?? createReportId(),
    createdAt: (input.now ?? new Date()).toISOString(),
    kind: input.kind,
    status: "local",
    origin: input.origin,
    track: {
      id: track.id,
      title: track.title,
      artists: track.artists,
      durationMs: track.durationMs,
      ...(track.coverUrl ? { coverUrl: track.coverUrl } : {}),
      ...(track.album?.title ? { album: track.album.title } : {}),
    },
    positionMs: Math.max(0, Math.round(input.positionMs)),
    offsetMs: lyrics.offsetMs,
    line,
    context: { before, after },
    lyrics: {
      provider: matchesTrack ? lyrics.activeProvider : null,
      format: matchesTrack ? lyrics.rawFormat : null,
      syncLevel: matchesTrack ? (providerOption?.syncLevel ?? null) : null,
      quality: matchesTrack ? lyrics.lyricsQuality : 0,
      lineCount: texts.length,
      contentHash:
        matchesTrack && lyrics.rawLyrics ? hashLyricsContent(lyrics.rawLyrics) : null,
    },
    client: {
      appVersion: input.appVersion,
      locale: input.locale,
    },
  };
}

// two reports of the same line and kind a few seconds apart are one double click
export const DUPLICATE_WINDOW_MS = 10_000;

export function isDuplicateReport(previous: LyricsReport | undefined, next: LyricsReport): boolean {
  if (!previous) return false;
  if (previous.track.id !== next.track.id || previous.kind !== next.kind) return false;
  if ((previous.line?.index ?? null) !== (next.line?.index ?? null)) return false;
  const elapsed = Date.parse(next.createdAt) - Date.parse(previous.createdAt);
  return elapsed >= 0 && elapsed < DUPLICATE_WINDOW_MS;
}

export function formatReportTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  const tenths = Math.floor((Math.max(0, ms) % 1000) / 100);
  return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

// braccato renders each line as .blyrics--line with its index in data-line-number
export function braccatoLineIndexFromTarget(target: EventTarget | null): number | null {
  const el = target as Element | null;
  if (!el || typeof el.closest !== "function") return null;
  const lineEl = el.closest<HTMLElement>(".blyrics--line");
  const raw = lineEl?.dataset.lineNumber;
  if (raw === undefined || raw === "") return null;
  const index = Number(raw);
  return Number.isInteger(index) && index >= 0 ? index : null;
}
