import type { Locale } from "@/languages";

export type ChangeType = "new" | "improved" | "fixed";

export interface ChangelogItem {
  type: ChangeType;
  text: { en: string } & Partial<Record<Locale, string>>;
}

export interface ChangelogEntry {
  version: string;
  // ISO date, YYYY-MM-DD
  date?: string;
  changes: ChangelogItem[];
}

export const LAST_SEEN_STORAGE_KEY = "liner_changelog_last_seen_v1";

// keys written by an install that ran before the changelog existed
const EXISTING_INSTALL_KEYS = [
  "liner_player_session_v2",
  "liner_customization_v1",
  "liner_overlay_settings_v1",
  "liner_locale",
];

function parseVersion(version: string): number[] {
  return version
    .replace(/^v/i, "")
    .split("-")[0]
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
}

export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

export function sortEntries(entries: ChangelogEntry[]): ChangelogEntry[] {
  return [...entries].sort((a, b) => compareVersions(b.version, a.version));
}

// entries newer than `from` and up to `to`, newest first
export function getEntriesBetween(
  entries: ChangelogEntry[],
  from: string | null,
  to: string,
): ChangelogEntry[] {
  return sortEntries(entries).filter(
    (entry) =>
      compareVersions(entry.version, to) <= 0 &&
      (from === null || compareVersions(entry.version, from) > 0),
  );
}

export function getEntriesUpTo(entries: ChangelogEntry[], to: string): ChangelogEntry[] {
  return getEntriesBetween(entries, null, to);
}

export function resolveText(item: ChangelogItem, locale: Locale): string {
  return item.text[locale] || item.text.en;
}

export interface LaunchDecision {
  // entries to show in the popup, empty when nothing should open
  entries: ChangelogEntry[];
  // version to store as seen right away, null to keep the stored value
  markSeen: string | null;
}

export function decideOnLaunch(
  entries: ChangelogEntry[],
  lastSeen: string | null,
  current: string,
  isExistingInstall: boolean,
): LaunchDecision {
  if (lastSeen === null) {
    // fresh install: nothing to announce
    if (!isExistingInstall) return { entries: [], markSeen: current };
    // update from a build without the changelog: show only this release
    const own = entries.filter((entry) => compareVersions(entry.version, current) === 0);
    return own.length > 0 ? { entries: own, markSeen: null } : { entries: [], markSeen: current };
  }

  if (compareVersions(current, lastSeen) <= 0) {
    // same version or downgrade
    return { entries: [], markSeen: compareVersions(current, lastSeen) < 0 ? current : null };
  }

  const pending = getEntriesBetween(entries, lastSeen, current);
  return pending.length > 0 ? { entries: pending, markSeen: null } : { entries: [], markSeen: current };
}

export function readLastSeen(): string | null {
  try {
    return localStorage.getItem(LAST_SEEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeLastSeen(version: string): void {
  try {
    localStorage.setItem(LAST_SEEN_STORAGE_KEY, version);
  } catch {}
}

export function hasExistingInstall(): boolean {
  try {
    return EXISTING_INSTALL_KEYS.some((key) => localStorage.getItem(key) !== null);
  } catch {
    return false;
  }
}
