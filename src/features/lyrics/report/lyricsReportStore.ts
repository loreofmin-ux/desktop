import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { LyricsReport, LyricsReportStatus } from "./lyricsReport";
import { isDuplicateReport } from "./lyricsReport";

// not under the liner_lyrics_ prefix on purpose: clearing the lyrics cache must keep reports
export const LYRICS_REPORTS_STORAGE_KEY = "liner_lyric_reports_v1";
export const MAX_STORED_REPORTS = 200;

export interface LyricsReportState {
  reports: LyricsReport[];
  // returns false when the report repeats the previous one
  addReport: (report: LyricsReport) => boolean;
  removeReport: (id: string) => void;
  setStatus: (id: string, status: LyricsReportStatus) => void;
  setNote: (id: string, note: string) => void;
  clearReports: () => void;
}

export const useLyricsReportStore = create<LyricsReportState>()(
  persist(
    (set, get) => ({
      reports: [],

      addReport: (report) => {
        const { reports } = get();
        if (isDuplicateReport(reports[0], report)) return false;
        set({ reports: [report, ...reports].slice(0, MAX_STORED_REPORTS) });
        return true;
      },

      removeReport: (id) => {
        set({ reports: get().reports.filter((r) => r.id !== id) });
      },

      setStatus: (id, status) => {
        set({
          reports: get().reports.map((r) => (r.id === id ? { ...r, status } : r)),
        });
      },

      setNote: (id, note) => {
        const trimmed = note.trim();
        set({
          reports: get().reports.map((r) => {
            if (r.id !== id) return r;
            if (!trimmed) {
              const { note: _removed, ...rest } = r;
              return rest;
            }
            return { ...r, note: trimmed.slice(0, 500) };
          }),
        });
      },

      clearReports: () => set({ reports: [] }),
    }),
    {
      name: LYRICS_REPORTS_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ reports: state.reports }),
      merge: (persisted, current) => {
        const saved = (persisted as Partial<LyricsReportState> | undefined)?.reports;
        return {
          ...current,
          reports: Array.isArray(saved) ? saved.slice(0, MAX_STORED_REPORTS) : [],
        };
      },
    },
  ),
);
