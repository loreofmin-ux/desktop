import { describe, it, expect } from "vitest";
import {
  buildLyricsReport,
  braccatoLineIndexFromTarget,
  findLineAtPosition,
  formatReportTime,
  hashLyricsContent,
  isDuplicateReport,
  type BuildLyricsReportInput,
  type LyricsReportLyricsState,
} from "./lyricsReport";
import { parseRawLyrics } from "../engine/lyricsParser";

const LRC = [
  "[00:10.00] I walked into the bar",
  "[00:14.00] Ordered something strong",
  "[00:18.00] The night was long",
  "[00:22.00] And then the song",
  "[00:26.00] Played on and on",
].join("\n");

const track = {
  id: "trk_1",
  title: "Night Song",
  artists: "Some Artist",
  durationMs: 180_000,
  coverUrl: "https://example.com/c.jpg",
  album: { title: "Album" },
};

function lyricsState(overrides: Partial<LyricsReportLyricsState> = {}): LyricsReportLyricsState {
  const parsed = parseRawLyrics(LRC, "lrc");
  return {
    currentLyricsTrackId: "trk_1",
    rawLyrics: LRC,
    rawFormat: "lrc",
    plainLyrics: parsed.plainLyrics,
    baseSyncedLines: parsed.syncedLines,
    activeProvider: "lrclib",
    availableProviders: [],
    lyricsQuality: 72,
    offsetMs: 0,
    activeLineIndex: null,
    ...overrides,
  };
}

function input(overrides: Partial<BuildLyricsReportInput> = {}): BuildLyricsReportInput {
  return {
    kind: "wrong_words",
    origin: "drawer",
    target: { lineIndex: null },
    track,
    positionMs: 15_200,
    lyrics: lyricsState(),
    appVersion: "0.1.35",
    locale: "en",
    now: new Date("2026-10-16T22:00:00.000Z"),
    id: "rep_1",
    ...overrides,
  };
}

describe("buildLyricsReport", () => {
  it("records the clicked line with its provider timing and surrounding lines", () => {
    const report = buildLyricsReport(input({ target: { lineIndex: 0 } }));
    expect(report.line).toMatchObject({
      index: 0,
      text: "I walked into the bar",
      startMs: 10_000,
      endMs: 14_000,
      picked: "clicked",
    });
    expect(report.context.before).toEqual([]);
    expect(report.context.after).toEqual(["Ordered something strong", "The night was long"]);
    expect(report.positionMs).toBe(15_200);
    expect(report.track).toEqual({
      id: "trk_1",
      title: "Night Song",
      artists: "Some Artist",
      durationMs: 180_000,
      coverUrl: "https://example.com/c.jpg",
      album: "Album",
    });
    expect(report.lyrics).toMatchObject({
      provider: "lrclib",
      format: "lrc",
      quality: 72,
      lineCount: 5,
      contentHash: hashLyricsContent(LRC),
    });
    expect(report.status).toBe("local");
    expect(report.createdAt).toBe("2026-10-16T22:00:00.000Z");
    expect(report.client).toEqual({ appVersion: "0.1.35", locale: "en" });
  });

  it("keeps the on-screen text when the view passes it", () => {
    const report = buildLyricsReport(
      input({ target: { lineIndex: 2, lineText: "  The night was long  " } }),
    );
    expect(report.line?.text).toBe("The night was long");
    expect(report.context.before).toEqual(["I walked into the bar", "Ordered something strong"]);
    expect(report.context.after).toEqual(["And then the song", "Played on and on"]);
  });

  it("falls back to the line being sung when no line was clicked", () => {
    const report = buildLyricsReport(input({ positionMs: 19_000 }));
    expect(report.line).toMatchObject({ index: 2, picked: "active", text: "The night was long" });
  });

  it("maps the song position back through the user's offset", () => {
    // with +2s offset the line at 18s is shown at 20s, so at 19s the previous line is still on screen
    const report = buildLyricsReport(
      input({ positionMs: 19_000, lyrics: lyricsState({ offsetMs: 2_000 }) }),
    );
    expect(report.line?.index).toBe(1);
    expect(report.offsetMs).toBe(2_000);
    expect(report.positionMs).toBe(19_000);
  });

  it("has no line before the first lyric", () => {
    const report = buildLyricsReport(input({ positionMs: 3_000 }));
    expect(report.line).toBeNull();
    expect(report.context).toEqual({ before: [], after: [] });
  });

  it("ignores an out of range clicked index and uses the active line", () => {
    const report = buildLyricsReport(input({ target: { lineIndex: 99 }, positionMs: 27_000 }));
    expect(report.line).toMatchObject({ index: 4, picked: "active" });
  });

  it("reports plain lyrics without timing", () => {
    const plain = "First line\n\nThird line\nFourth line";
    const report = buildLyricsReport(
      input({
        target: { lineIndex: 2 },
        lyrics: lyricsState({
          rawLyrics: plain,
          rawFormat: "plain",
          plainLyrics: plain,
          baseSyncedLines: [],
        }),
      }),
    );
    expect(report.line).toEqual({
      index: 2,
      text: "Third line",
      startMs: null,
      endMs: null,
      picked: "clicked",
    });
    expect(report.context.before).toEqual(["First line"]);
    expect(report.context.after).toEqual(["Fourth line"]);
  });

  it("uses the clicked index for unsynced lines", () => {
    const lines = [
      { timeMs: 0, text: "one" },
      { timeMs: 0, text: "two" },
    ];
    const report = buildLyricsReport(
      input({ target: { lineIndex: 1 }, lyrics: lyricsState({ baseSyncedLines: lines }) }),
    );
    expect(report.line).toMatchObject({ index: 1, text: "two", startMs: null, endMs: null });
  });

  it("does not attach lyrics that belong to another track", () => {
    const report = buildLyricsReport(
      input({
        target: { lineIndex: 1 },
        lyrics: lyricsState({ currentLyricsTrackId: "other" }),
      }),
    );
    expect(report.line).toBeNull();
    expect(report.lyrics.provider).toBeNull();
    expect(report.lyrics.contentHash).toBeNull();
  });

  it("keeps word timings for word synced lyrics", () => {
    const lines = [
      {
        timeMs: 1_000,
        text: "Cocktail please",
        words: [
          { timeMs: 1_000, endMs: 1_500, text: "Cocktail " },
          { timeMs: 1_500, endMs: 2_200, text: "please" },
        ],
      },
    ];
    const report = buildLyricsReport(
      input({ target: { lineIndex: 0 }, lyrics: lyricsState({ baseSyncedLines: lines }) }),
    );
    expect(report.line?.endMs).toBe(2_200);
    expect(report.line?.words).toEqual([
      { text: "Cocktail ", startMs: 1_000, endMs: 1_500 },
      { text: "please", startMs: 1_500, endMs: 2_200 },
    ]);
  });

  it("strips layout tags from line text", () => {
    const lines = [
      { timeMs: 1_000, text: "<right,pink> Sung on the right" },
      { timeMs: 2_000, text: "next" },
    ];
    const report = buildLyricsReport(
      input({ target: { lineIndex: 0 }, lyrics: lyricsState({ baseSyncedLines: lines }) }),
    );
    expect(report.line?.text).toBe("Sung on the right");
  });
});

describe("helpers", () => {
  it("hashes deterministically and tells versions apart", () => {
    expect(hashLyricsContent("abc")).toBe(hashLyricsContent("abc"));
    expect(hashLyricsContent("abc")).not.toBe(hashLyricsContent("abd"));
    expect(hashLyricsContent("")).toMatch(/^[0-9a-f]{8}$/);
  });

  it("finds the active line", () => {
    const lines = [
      { timeMs: 1_000, text: "a" },
      { timeMs: 2_000, text: "b" },
    ];
    expect(findLineAtPosition(lines, 500)).toBeNull();
    expect(findLineAtPosition(lines, 1_000)).toBe(0);
    expect(findLineAtPosition(lines, 5_000)).toBe(1);
  });

  it("formats times", () => {
    expect(formatReportTime(0)).toBe("0:00.0");
    expect(formatReportTime(83_450)).toBe("1:23.4");
    expect(formatReportTime(-5)).toBe("0:00.0");
  });

  it("treats a repeat within ten seconds as a duplicate", () => {
    const a = buildLyricsReport(input({ target: { lineIndex: 1 } }));
    const b = buildLyricsReport(
      input({ target: { lineIndex: 1 }, now: new Date("2026-10-16T22:00:05.000Z"), id: "rep_2" }),
    );
    const later = buildLyricsReport(
      input({ target: { lineIndex: 1 }, now: new Date("2026-10-16T22:00:30.000Z"), id: "rep_3" }),
    );
    const otherKind = buildLyricsReport(
      input({ kind: "out_of_sync", target: { lineIndex: 1 }, now: new Date("2026-10-16T22:00:05.000Z") }),
    );
    expect(isDuplicateReport(undefined, a)).toBe(false);
    expect(isDuplicateReport(a, b)).toBe(true);
    expect(isDuplicateReport(a, later)).toBe(false);
    expect(isDuplicateReport(a, otherKind)).toBe(false);
  });

  it("reads the braccato line index from a click target", () => {
    const line = document.createElement("div");
    line.className = "blyrics--line";
    line.dataset.lineNumber = "7";
    const word = document.createElement("span");
    line.appendChild(word);
    expect(braccatoLineIndexFromTarget(word)).toBe(7);
    expect(braccatoLineIndexFromTarget(document.createElement("div"))).toBeNull();
    expect(braccatoLineIndexFromTarget(null)).toBeNull();
    line.dataset.lineNumber = "x";
    expect(braccatoLineIndexFromTarget(word)).toBeNull();
  });
});
