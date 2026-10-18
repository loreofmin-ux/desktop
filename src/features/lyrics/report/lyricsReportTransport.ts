import { api } from "@/shared/api";
import type { LyricsReportRequest } from "@/shared/contracts/lyrics";
import type { LyricsReport, LyricsReportStatus } from "./lyricsReport";

// The only place a lyrics report leaves the device. The backend has no report route yet, so
// sending stays off and reports are kept locally; set VITE_LYRICS_REPORTS_REMOTE=1 once
// POST /v1/tracks/{id}/lyrics/reports exists.
export function isRemoteLyricsReportingEnabled(): boolean {
  return import.meta.env.VITE_LYRICS_REPORTS_REMOTE === "1";
}

export function toLyricsReportRequest(report: LyricsReport): LyricsReportRequest {
  return {
    reportId: report.id,
    kind: report.kind,
    createdAt: report.createdAt,
    positionMs: report.positionMs,
    offsetMs: report.offsetMs,
    ...(report.note ? { note: report.note } : {}),
    line: report.line
      ? {
          index: report.line.index,
          text: report.line.text,
          startMs: report.line.startMs,
          endMs: report.line.endMs,
          picked: report.line.picked,
        }
      : null,
    context: report.context,
    lyrics: {
      provider: report.lyrics.provider,
      format: report.lyrics.format,
      syncLevel: report.lyrics.syncLevel,
      contentHash: report.lyrics.contentHash,
      lineCount: report.lyrics.lineCount,
    },
    client: report.client,
  };
}

export async function sendLyricsReport(report: LyricsReport): Promise<LyricsReportStatus> {
  if (!isRemoteLyricsReportingEnabled()) return "local";
  try {
    await api.submitLyricsReport(report.track.id, toLyricsReportRequest(report));
    return "sent";
  } catch {
    return "failed";
  }
}
