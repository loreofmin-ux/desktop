import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

vi.mock("@/shared/api", () => ({
  api: { submitLyricsReport: vi.fn() },
}));

import { api } from "@/shared/api";
import { useLyricsReportStore, LYRICS_REPORTS_STORAGE_KEY, MAX_STORED_REPORTS } from "./lyricsReportStore";
import { sendLyricsReport, toLyricsReportRequest } from "./lyricsReportTransport";
import type { LyricsReport } from "./lyricsReport";

function report(id: string, overrides: Partial<LyricsReport> = {}): LyricsReport {
  return {
    id,
    createdAt: "2026-10-16T22:00:00.000Z",
    kind: "wrong_words",
    status: "local",
    origin: "drawer",
    track: { id: "trk_1", title: "T", artists: "A", durationMs: 1000 },
    positionMs: 500,
    offsetMs: 0,
    line: { index: 0, text: "Cocktail", startMs: 0, endMs: 900, picked: "clicked" },
    context: { before: [], after: [] },
    lyrics: {
      provider: "p",
      format: "lrc",
      syncLevel: "line_level",
      quality: 1,
      lineCount: 1,
      contentHash: "00000000",
    },
    client: { appVersion: "0.1.35", locale: "en" },
    ...overrides,
  };
}

describe("lyrics report store", () => {
  beforeEach(() => {
    localStorage.clear();
    useLyricsReportStore.setState({ reports: [] });
  });

  it("stores newest first and persists under its own key", () => {
    const s = useLyricsReportStore.getState();
    expect(s.addReport(report("a"))).toBe(true);
    expect(
      s.addReport(report("b", { createdAt: "2026-10-16T22:05:00.000Z", line: null })),
    ).toBe(true);
    expect(useLyricsReportStore.getState().reports.map((r) => r.id)).toEqual(["b", "a"]);
    const saved = JSON.parse(localStorage.getItem(LYRICS_REPORTS_STORAGE_KEY) || "{}");
    expect(saved.state.reports).toHaveLength(2);
    // the lyrics cache clears every liner_lyrics_ key, reports must not be one of them
    expect(LYRICS_REPORTS_STORAGE_KEY.startsWith("liner_lyrics_")).toBe(false);
  });

  it("rejects a double click on the same line", () => {
    const s = useLyricsReportStore.getState();
    expect(s.addReport(report("a"))).toBe(true);
    expect(s.addReport(report("b", { createdAt: "2026-10-16T22:00:03.000Z" }))).toBe(false);
    expect(useLyricsReportStore.getState().reports).toHaveLength(1);
  });

  it("caps the number of stored reports", () => {
    const s = useLyricsReportStore.getState();
    for (let i = 0; i < MAX_STORED_REPORTS + 5; i++) {
      s.addReport(
        report(`r${i}`, {
          createdAt: new Date(Date.UTC(2026, 9, 16, 0, 0, i * 20)).toISOString(),
        }),
      );
    }
    const { reports } = useLyricsReportStore.getState();
    expect(reports).toHaveLength(MAX_STORED_REPORTS);
    expect(reports[0].id).toBe(`r${MAX_STORED_REPORTS + 4}`);
  });

  it("edits notes, statuses and removes reports", () => {
    const s = useLyricsReportStore.getState();
    s.addReport(report("a"));
    s.setNote("a", "  I hear Bar  ");
    expect(useLyricsReportStore.getState().reports[0].note).toBe("I hear Bar");
    s.setNote("a", "   ");
    expect(useLyricsReportStore.getState().reports[0].note).toBeUndefined();
    s.setStatus("a", "sent");
    expect(useLyricsReportStore.getState().reports[0].status).toBe("sent");
    s.removeReport("a");
    expect(useLyricsReportStore.getState().reports).toEqual([]);
  });

  it("recovers from a corrupted saved value", async () => {
    localStorage.setItem(
      LYRICS_REPORTS_STORAGE_KEY,
      JSON.stringify({ state: { reports: "nope" }, version: 1 }),
    );
    await useLyricsReportStore.persist.rehydrate();
    expect(useLyricsReportStore.getState().reports).toEqual([]);
  });
});

describe("lyrics report transport", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.mocked(api.submitLyricsReport).mockReset();
  });

  it("keeps reports local while the backend route does not exist", async () => {
    expect(await sendLyricsReport(report("a"))).toBe("local");
    expect(api.submitLyricsReport).not.toHaveBeenCalled();
  });

  it("sends when enabled and reports failures", async () => {
    vi.stubEnv("VITE_LYRICS_REPORTS_REMOTE", "1");
    vi.mocked(api.submitLyricsReport).mockResolvedValueOnce({ id: "srv" });
    expect(await sendLyricsReport(report("a"))).toBe("sent");
    expect(api.submitLyricsReport).toHaveBeenCalledWith("trk_1", toLyricsReportRequest(report("a")));

    vi.mocked(api.submitLyricsReport).mockRejectedValueOnce(new Error("404"));
    expect(await sendLyricsReport(report("a"))).toBe("failed");
  });

  it("leaves local only fields out of the request", () => {
    const body = toLyricsReportRequest(report("a", { note: "Bar" }));
    expect(body).not.toHaveProperty("status");
    expect(body).not.toHaveProperty("track");
    expect(body.note).toBe("Bar");
    expect(body.reportId).toBe("a");
  });
});
