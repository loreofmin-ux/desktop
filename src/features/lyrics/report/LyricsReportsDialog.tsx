import { useState } from "react";
import { PlayFill, Copy2Line, Delete2Line, Download2Line } from "@mingcute/react";
import { Dialog, Button } from "@/shared/ui";
import { useTranslation } from "@/languages";
import { formatReportTime, type LyricsReport } from "./lyricsReport";
import { useLyricsReportStore } from "./lyricsReportStore";

const font = { fontFamily: "var(--font-inter), sans-serif" };

export interface LyricsReportsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPlayMoment?: (report: LyricsReport) => void;
}

function copyText(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
}

function downloadJson(reports: LyricsReport[]) {
  const blob = new Blob([JSON.stringify(reports, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `liner-lyrics-reports-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function NoteField({ report }: { report: LyricsReport }) {
  const { t } = useTranslation();
  const [value, setValue] = useState(report.note ?? "");
  return (
    <input
      type="text"
      value={value}
      maxLength={500}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => useLyricsReportStore.getState().setNote(report.id, value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      placeholder={t("lyrics_report.note_placeholder")}
      className="w-full h-[30px] px-[10px] rounded-lg bg-border-alpha-14 border border-border-primary/60 text-text-primary text-[12.5px] outline-none focus:border-text-tertiary"
      style={font}
    />
  );
}

function ReportCard({
  report,
  onPlayMoment,
}: {
  report: LyricsReport;
  onPlayMoment?: (report: LyricsReport) => void;
}) {
  const { t } = useTranslation();
  const created = new Date(report.createdAt);
  const timing =
    report.line?.startMs !== null && report.line?.startMs !== undefined
      ? `${formatReportTime(report.line.startMs)}${
          report.line.endMs !== null ? ` – ${formatReportTime(report.line.endMs)}` : ""
        }`
      : null;
  const details = [
    report.lyrics.provider,
    report.lyrics.syncLevel ?? report.lyrics.format,
    report.offsetMs !== 0 ? `offset ${report.offsetMs > 0 ? "+" : ""}${report.offsetMs} ms` : null,
  ].filter(Boolean);

  return (
    <div
      data-testid="lyrics-report-card"
      className="flex flex-col gap-[8px] rounded-xl bg-bg-panel border border-border-primary/60 dark:border-transparent dark:bg-white/[0.035] p-[12px]"
      style={font}
    >
      <div className="flex items-start justify-between gap-[8px]">
        <div className="flex flex-col min-w-0">
          <span className="text-text-primary text-[13px] font-[600] truncate">
            {report.track.title}
          </span>
          <span className="text-text-tertiary text-[11.5px] truncate">{report.track.artists}</span>
        </div>
        <div className="flex items-center gap-[4px] shrink-0">
          <span className="text-[10px] font-[600] px-[6px] py-[1px] rounded bg-border-alpha-14 text-text-secondary">
            {t(`lyrics_report.kind_${report.kind}`)}
          </span>
          <span className="text-[10px] font-[600] px-[6px] py-[1px] rounded bg-border-alpha-14 text-text-tertiary">
            {t(`lyrics_report.status_${report.status}`)}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-[10px] gap-y-[2px] text-[11.5px] text-text-tertiary">
        <span className="text-text-primary font-[600] font-mono">
          {t("lyrics_report.reported_at", { time: formatReportTime(report.positionMs) })}
        </span>
        {timing && <span className="font-mono">{t("lyrics_report.line_timing", { time: timing })}</span>}
        {details.length > 0 && <span>{details.join(" · ")}</span>}
        <span>{created.toLocaleString()}</span>
      </div>

      <div className="flex flex-col gap-[2px] rounded-lg bg-border-alpha-14 px-[10px] py-[8px] text-[12.5px] leading-snug">
        {report.context.before.map((line, i) => (
          <span key={`b${i}`} className="text-text-tertiary">
            {line}
          </span>
        ))}
        <span className="text-text-primary font-[600]">
          {report.line?.text || t("lyrics_report.no_line")}
        </span>
        {report.context.after.map((line, i) => (
          <span key={`a${i}`} className="text-text-tertiary">
            {line}
          </span>
        ))}
      </div>

      <NoteField report={report} />

      <div className="flex items-center gap-[6px]">
        {onPlayMoment && (
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={() => onPlayMoment(report)}
            className="flex items-center gap-[5px]"
          >
            <PlayFill size={12} />
            <span>{t("lyrics_report.play_moment")}</span>
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => copyText(JSON.stringify(report, null, 2))}
          className="flex items-center gap-[5px]"
        >
          <Copy2Line size={13} />
          <span>{t("lyrics_report.copy_json")}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          aria-label={t("lyrics_report.delete")}
          title={t("lyrics_report.delete")}
          onClick={() => useLyricsReportStore.getState().removeReport(report.id)}
          className="ml-auto flex items-center"
        >
          <Delete2Line size={13} />
        </Button>
      </div>
    </div>
  );
}

export function LyricsReportsDialog({ open, onOpenChange, onPlayMoment }: LyricsReportsDialogProps) {
  const { t } = useTranslation();
  const reports = useLyricsReportStore((s) => s.reports);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} maxWidth={520}>
      <div className="flex flex-col gap-[12px] px-[20px] pb-[20px] min-h-0" style={font}>
        <div className="flex flex-col gap-[4px]">
          <h3 className="text-text-primary text-[16px] font-[600] tracking-[-0.01em] m-0">
            {t("lyrics_report.dialog_title")}
          </h3>
          <p className="text-text-secondary text-[13px] leading-relaxed m-0">
            {t("lyrics_report.dialog_desc")}
          </p>
        </div>

        <div className="flex flex-col gap-[8px] overflow-y-auto min-h-0 max-h-[55vh] pr-[2px]">
          {reports.length === 0 ? (
            <p className="text-text-tertiary text-[13px] m-0 py-[16px] text-center">
              {t("lyrics_report.empty")}
            </p>
          ) : (
            reports.map((report) => (
              <ReportCard key={report.id} report={report} onPlayMoment={onPlayMoment} />
            ))
          )}
        </div>

        <div className="flex items-center gap-[8px] pt-[4px]">
          <Button
            variant="secondary"
            type="button"
            disabled={reports.length === 0}
            onClick={() => downloadJson(reports)}
            className="flex items-center gap-[6px]"
          >
            <Download2Line size={15} />
            <span>{t("lyrics_report.export")}</span>
          </Button>
          <Button
            variant="ghost"
            type="button"
            disabled={reports.length === 0}
            onClick={() => copyText(JSON.stringify(reports, null, 2))}
          >
            {t("lyrics_report.copy_all")}
          </Button>
          <Button
            variant="ghost"
            type="button"
            disabled={reports.length === 0}
            onClick={() => useLyricsReportStore.getState().clearReports()}
            className="ml-auto"
          >
            {t("lyrics_report.clear")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
