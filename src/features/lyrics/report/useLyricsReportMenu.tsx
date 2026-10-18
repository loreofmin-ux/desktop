import { useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Flag1Line, TimeLine, FileInfoLine } from "@mingcute/react";
import DropdownMenu, { type DropdownMenuItem } from "@/shared/ui/DropdownMenu";
import { useToast } from "@/shared/ui";
import { useTranslation } from "@/languages";
import { APP_VERSION } from "@/shared/config/version";
import { useLyricsStore } from "../store/lyricsStore";
import {
  buildLyricsReport,
  formatReportTime,
  type LyricsReport,
  type LyricsReportKind,
  type LyricsReportOrigin,
  type LyricsReportTarget,
  type LyricsReportTrack,
} from "./lyricsReport";
import { useLyricsReportStore } from "./lyricsReportStore";
import { sendLyricsReport } from "./lyricsReportTransport";
import { LyricsReportsDialog } from "./LyricsReportsDialog";

// React and native mouse events both fit, the braccato view listens natively
type MenuOpenEvent = Pick<MouseEvent, "clientX" | "clientY" | "preventDefault" | "stopPropagation">;

export interface UseLyricsReportMenuOptions {
  origin: LyricsReportOrigin;
  track: LyricsReportTrack | null;
  // read at click time so the report carries the exact moment, not the last render's
  getPositionMs: () => number;
  onPlayMoment?: (report: LyricsReport) => void;
}

export function readAudioPositionMs(fallbackMs: number): number {
  if (typeof document === "undefined") return fallbackMs;
  const audio = document.getElementById("liner-audio") as HTMLAudioElement | null;
  if (audio && Number.isFinite(audio.currentTime) && audio.currentTime > 0) {
    return Math.round(audio.currentTime * 1000);
  }
  return fallbackMs;
}

export function useLyricsReportMenu({
  origin,
  track,
  getPositionMs,
  onPlayMoment,
}: UseLyricsReportMenuOptions) {
  const { t, locale } = useTranslation();
  const { toast } = useToast();
  const reportCount = useLyricsReportStore((s) => s.reports.length);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const targetRef = useRef<LyricsReportTarget>({ lineIndex: null });
  // the position is frozen when the menu opens: that is the moment the user heard the mistake
  const positionAtOpenRef = useRef(0);

  const submit = useCallback(
    (kind: LyricsReportKind, target: LyricsReportTarget, positionMs: number) => {
      if (!track) return;
      const report = buildLyricsReport({
        kind,
        origin,
        target,
        track,
        positionMs,
        lyrics: useLyricsStore.getState(),
        appVersion: APP_VERSION,
        locale,
      });

      const store = useLyricsReportStore.getState();
      if (!store.addReport(report)) {
        toast(t("lyrics_report.already_reported"), "info");
        return;
      }

      const where = report.line?.text
        ? `"${report.line.text}" · ${formatReportTime(report.positionMs)}`
        : formatReportTime(report.positionMs);
      toast(t("lyrics_report.saved"), "checkmark", {
        description: where,
        action: {
          label: t("lyrics_report.undo"),
          onClick: () => useLyricsReportStore.getState().removeReport(report.id),
        },
      });

      void sendLyricsReport(report).then((status) => {
        if (status !== "local") {
          useLyricsReportStore.getState().setStatus(report.id, status);
        }
      });
    },
    [origin, track, locale, toast, t],
  );

  const openMenu = useCallback(
    (e: MenuOpenEvent, target: LyricsReportTarget) => {
      if (!track) return;
      e.preventDefault();
      e.stopPropagation();
      targetRef.current = target;
      positionAtOpenRef.current = getPositionMs();
      setMenuPosition({ x: e.clientX, y: e.clientY });
    },
    [track, getPositionMs],
  );

  const items = useMemo<DropdownMenuItem[]>(
    () => [
      {
        id: "report-wrong-words",
        label: t("lyrics_report.wrong_words"),
        icon: <Flag1Line size={15} />,
        onClick: () => submit("wrong_words", targetRef.current, positionAtOpenRef.current),
      },
      {
        id: "report-out-of-sync",
        label: t("lyrics_report.out_of_sync"),
        icon: <TimeLine size={15} />,
        onClick: () => submit("out_of_sync", targetRef.current, positionAtOpenRef.current),
      },
      {
        id: "report-view",
        label:
          reportCount > 0
            ? t("lyrics_report.view_reports_count", { count: reportCount })
            : t("lyrics_report.view_reports"),
        icon: <FileInfoLine size={15} />,
        onClick: () => setDialogOpen(true),
      },
    ],
    [t, submit, reportCount],
  );

  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) setMenuPosition(null);
  }, []);

  const element =
    typeof document === "undefined"
      ? null
      : createPortal(
          <>
            <DropdownMenu
              trigger={null}
              items={items}
              open={menuPosition !== null}
              onOpenChange={handleOpenChange}
              position={menuPosition}
            />
            <LyricsReportsDialog
              open={dialogOpen}
              onOpenChange={setDialogOpen}
              onPlayMoment={onPlayMoment}
            />
          </>,
          document.body,
        );

  return { openMenu, element };
}
