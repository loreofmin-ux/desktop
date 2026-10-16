import { create } from "zustand";
import { APP_VERSION } from "@/shared/config/version";
import { CHANGELOG } from "../data/changelog";
import {
  type ChangelogEntry,
  decideOnLaunch,
  getEntriesUpTo,
  hasExistingInstall,
  readLastSeen,
  sortEntries,
  takePreviewFlag,
  writeLastSeen,
} from "../lib/changelog";

export type ChangelogMode = "update" | "history";

export interface ChangelogState {
  isOpen: boolean;
  mode: ChangelogMode;
  entries: ChangelogEntry[];
  version: string;
  // opened by the preview flag, closing it does not mark anything as seen
  isPreview: boolean;
  hasChecked: boolean;

  // actions
  checkOnLaunch: (currentVersion?: string, source?: ChangelogEntry[]) => void;
  openHistory: (currentVersion?: string, source?: ChangelogEntry[]) => void;
  close: () => void;
  reset: () => void;
}

export const useChangelogStore = create<ChangelogState>((set, get) => ({
  isOpen: false,
  mode: "update",
  entries: [],
  version: APP_VERSION,
  isPreview: false,
  hasChecked: false,

  checkOnLaunch: (currentVersion = APP_VERSION, source = CHANGELOG) => {
    if (get().hasChecked) return;
    if (takePreviewFlag()) {
      const latest = sortEntries(source).slice(0, 1);
      set({
        hasChecked: true,
        isOpen: latest.length > 0,
        mode: "update",
        entries: latest,
        version: latest[0]?.version ?? currentVersion,
        isPreview: true,
      });
      return;
    }
    const decision = decideOnLaunch(source, readLastSeen(), currentVersion, hasExistingInstall());
    if (decision.markSeen) writeLastSeen(decision.markSeen);
    set({
      hasChecked: true,
      isOpen: decision.entries.length > 0,
      mode: "update",
      entries: decision.entries,
      version: currentVersion,
      isPreview: false,
    });
  },

  openHistory: (currentVersion = APP_VERSION, source = CHANGELOG) => {
    set({
      isOpen: true,
      mode: "history",
      entries: getEntriesUpTo(source, currentVersion),
      version: currentVersion,
      isPreview: false,
    });
  },

  close: () => {
    if (get().mode === "update" && !get().isPreview) writeLastSeen(get().version);
    set({ isOpen: false });
  },

  reset: () => {
    set({ isOpen: false, mode: "update", entries: [], version: APP_VERSION, isPreview: false, hasChecked: false });
  },
}));
