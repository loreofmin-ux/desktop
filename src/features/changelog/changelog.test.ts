import { describe, it, expect, beforeEach } from "vitest";
import {
  type ChangelogEntry,
  LAST_SEEN_STORAGE_KEY,
  PREVIEW_STORAGE_KEY,
  compareVersions,
  decideOnLaunch,
  getEntriesBetween,
  resolveText,
} from "./lib/changelog";
import { CHANGELOG } from "./data/changelog";
import { useChangelogStore } from "./store/changelogStore";

const entry = (version: string): ChangelogEntry => ({
  version,
  changes: [{ type: "new", text: { en: `en ${version}`, ru: `ru ${version}` } }],
});

const SAMPLE = [entry("0.1.36"), entry("0.1.38"), entry("0.1.37"), entry("0.2.0")];

describe("compareVersions", () => {
  it("compares numerically, not as strings", () => {
    expect(compareVersions("0.1.10", "0.1.9")).toBe(1);
    expect(compareVersions("0.1.9", "0.1.10")).toBe(-1);
    expect(compareVersions("v0.1.35", "0.1.35")).toBe(0);
    expect(compareVersions("0.2", "0.2.0")).toBe(0);
    expect(compareVersions("0.1.36-beta.1", "0.1.36")).toBe(0);
  });
});

describe("getEntriesBetween", () => {
  it("returns entries after from and up to to, newest first", () => {
    const versions = getEntriesBetween(SAMPLE, "0.1.36", "0.1.38").map((e) => e.version);
    expect(versions).toEqual(["0.1.38", "0.1.37"]);
  });

  it("returns everything up to to when from is null", () => {
    const versions = getEntriesBetween(SAMPLE, null, "0.1.37").map((e) => e.version);
    expect(versions).toEqual(["0.1.37", "0.1.36"]);
  });
});

describe("resolveText", () => {
  it("falls back to english when the locale is missing", () => {
    expect(resolveText(SAMPLE[0].changes[0], "ru")).toBe("ru 0.1.36");
    expect(resolveText(SAMPLE[0].changes[0], "es")).toBe("en 0.1.36");
  });
});

describe("decideOnLaunch", () => {
  it("stays silent on a fresh install and records the version", () => {
    expect(decideOnLaunch(SAMPLE, null, "0.1.37", false)).toEqual({
      entries: [],
      markSeen: "0.1.37",
    });
  });

  it("shows only the current release for an install that predates the changelog", () => {
    const decision = decideOnLaunch(SAMPLE, null, "0.1.37", true);
    expect(decision.entries.map((e) => e.version)).toEqual(["0.1.37"]);
    expect(decision.markSeen).toBeNull();
  });

  it("shows every release missed since the last seen version", () => {
    const decision = decideOnLaunch(SAMPLE, "0.1.35", "0.1.38", true);
    expect(decision.entries.map((e) => e.version)).toEqual(["0.1.38", "0.1.37", "0.1.36"]);
  });

  it("does nothing when the version did not change", () => {
    expect(decideOnLaunch(SAMPLE, "0.1.37", "0.1.37", true)).toEqual({
      entries: [],
      markSeen: null,
    });
  });

  it("records a downgrade without showing anything", () => {
    expect(decideOnLaunch(SAMPLE, "0.1.38", "0.1.36", true)).toEqual({
      entries: [],
      markSeen: "0.1.36",
    });
  });

  it("records an update that has no changelog entry", () => {
    expect(decideOnLaunch(SAMPLE, "0.2.0", "0.2.1", true)).toEqual({
      entries: [],
      markSeen: "0.2.1",
    });
  });
});

describe("changelogStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useChangelogStore.getState().reset();
  });

  it("opens after an update and remembers it once closed", () => {
    localStorage.setItem(LAST_SEEN_STORAGE_KEY, "0.1.36");
    useChangelogStore.getState().checkOnLaunch("0.1.38", SAMPLE);

    let state = useChangelogStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.mode).toBe("update");
    expect(state.entries.map((e) => e.version)).toEqual(["0.1.38", "0.1.37"]);
    // not marked as seen until the popup is closed
    expect(localStorage.getItem(LAST_SEEN_STORAGE_KEY)).toBe("0.1.36");

    state.close();
    expect(useChangelogStore.getState().isOpen).toBe(false);
    expect(localStorage.getItem(LAST_SEEN_STORAGE_KEY)).toBe("0.1.38");

    useChangelogStore.getState().reset();
    useChangelogStore.getState().checkOnLaunch("0.1.38", SAMPLE);
    state = useChangelogStore.getState();
    expect(state.isOpen).toBe(false);
  });

  it("checks only once per session", () => {
    localStorage.setItem(LAST_SEEN_STORAGE_KEY, "0.1.36");
    const store = useChangelogStore.getState();
    store.checkOnLaunch("0.1.37", SAMPLE);
    store.close();
    localStorage.setItem(LAST_SEEN_STORAGE_KEY, "0.1.36");
    useChangelogStore.getState().checkOnLaunch("0.1.37", SAMPLE);
    expect(useChangelogStore.getState().isOpen).toBe(false);
  });

  it("does not open on a fresh install", () => {
    useChangelogStore.getState().checkOnLaunch("0.1.37", SAMPLE);
    expect(useChangelogStore.getState().isOpen).toBe(false);
    expect(localStorage.getItem(LAST_SEEN_STORAGE_KEY)).toBe("0.1.37");
  });

  it("opens the full history from settings without touching the last seen version", () => {
    localStorage.setItem(LAST_SEEN_STORAGE_KEY, "0.1.36");
    useChangelogStore.getState().openHistory("0.1.38", SAMPLE);

    const state = useChangelogStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.mode).toBe("history");
    expect(state.entries.map((e) => e.version)).toEqual(["0.1.38", "0.1.37", "0.1.36"]);

    state.close();
    expect(localStorage.getItem(LAST_SEEN_STORAGE_KEY)).toBe("0.1.36");
  });
});

describe("changelog preview flag", () => {
  beforeEach(() => {
    localStorage.clear();
    useChangelogStore.getState().reset();
  });

  it("shows the latest entry once without changing the last seen version", () => {
    localStorage.setItem(LAST_SEEN_STORAGE_KEY, "0.1.35");
    localStorage.setItem(PREVIEW_STORAGE_KEY, "1");
    useChangelogStore.getState().checkOnLaunch("0.1.35", SAMPLE);

    const state = useChangelogStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.mode).toBe("update");
    expect(state.version).toBe("0.2.0");
    expect(state.entries.map((e) => e.version)).toEqual(["0.2.0"]);
    expect(localStorage.getItem(PREVIEW_STORAGE_KEY)).toBeNull();

    state.close();
    expect(localStorage.getItem(LAST_SEEN_STORAGE_KEY)).toBe("0.1.35");
  });
});

describe("shipped changelog", () => {
  it("has unique versions, english text and known change types", () => {
    const versions = CHANGELOG.map((e) => e.version);
    expect(new Set(versions).size).toBe(versions.length);
    for (const e of CHANGELOG) {
      expect(e.version).toMatch(/^\d+\.\d+\.\d+$/);
      if (e.date) expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.changes.length).toBeGreaterThan(0);
      for (const item of e.changes) {
        expect(["new", "improved", "fixed"]).toContain(item.type);
        expect(item.text.en.trim()).not.toBe("");
      }
    }
  });
});
