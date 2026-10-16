import { create } from "zustand";
import { APP_VERSION } from "@/shared/config/version";
import { CHANGELOG } from "../data/changelog";
import {
  type ChangelogEntry,
  decideOnLaunch,
  getEntriesUpTo,
  hasExistingInstall,
  readLastSeen,
  writeLastSeen,
} from "../lib/changelog";

export type ChangelogMode = "update" | "history";

export interface ChangelogState {
  isOpen: boolean;
  mode: ChangelogMode;
  entries: ChangelogEntry[];
  version: string;
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
  hasChecked: false,

  checkOnLaunch: (currentVersion = APP_VERSION, source = CHANGELOG) => {
    if (get().hasChecked) return;
    const decision = decideOnLaunch(source, readLastSeen(), currentVersion, hasExistingInstall());
    if (decision.markSeen) writeLastSeen(decision.markSeen);
    set({
      hasChecked: true,
      isOpen: decision.entries.length > 0,
      mode: "update",
      entries: decision.entries,
      version: currentVersion,
    });
  },

  openHistory: (currentVersion = APP_VERSION, source = CHANGELOG) => {
    set({
      isOpen: true,
      mode: "history",
      entries: getEntriesUpTo(source, currentVersion),
      version: currentVersion,
    });
  },

  close: () => {
    if (get().mode === "update") writeLastSeen(get().version);
    set({ isOpen: false });
  },

  reset: () => {
    set({ isOpen: false, mode: "update", entries: [], version: APP_VERSION, hasChecked: false });
  },
}));
