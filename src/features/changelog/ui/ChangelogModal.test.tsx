import React, { act } from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRoot, Root } from "react-dom/client";
import { I18nProvider } from "@/languages";
import ChangelogModal from "./ChangelogModal";
import { useChangelogStore } from "../store/changelogStore";
import type { ChangelogEntry } from "../lib/changelog";

// @ts-expect-error - act support flag in vitest browserless DOM environment
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("framer-motion", () => {
  const cache: Record<string, any> = {};
  return {
    AnimatePresence: ({ children }: any) => <>{children}</>,
    motion: new Proxy({}, {
      get: (_target, prop: string) => {
        if (!cache[prop]) {
          cache[prop] = React.forwardRef(({ children, className, style, ...props }: any, ref: any) => {
            const cleanProps = { ...props };
            delete cleanProps.initial;
            delete cleanProps.animate;
            delete cleanProps.exit;
            delete cleanProps.transition;
            return React.createElement(prop, { ref, className, style, ...cleanProps }, children);
          });
        }
        return cache[prop];
      },
    }),
  };
});

const SAMPLE: ChangelogEntry[] = [
  {
    version: "0.1.37",
    date: "2026-10-20",
    changes: [
      { type: "new", text: { en: "Offline playlist", ru: "Офлайн плейлист" } },
      { type: "fixed", text: { en: "Overlay after Alt+Tab" } },
    ],
  },
];

describe("ChangelogModal", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("liner_locale", "en");
    useChangelogStore.getState().reset();
    // the launch check runs on mount; mark it done so tests drive the store
    useChangelogStore.setState({ hasChecked: true });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("renders the release notes and closes on the button", async () => {
    await act(async () => {
      root.render(
        <I18nProvider>
          <ChangelogModal />
        </I18nProvider>,
      );
    });
    expect(document.body.textContent).not.toContain("Offline playlist");

    await act(async () => {
      useChangelogStore.setState({ isOpen: true, mode: "update", entries: SAMPLE, version: "0.1.37" });
    });

    const text = document.body.textContent ?? "";
    expect(text).toContain("What's new in Liner v0.1.37");
    expect(text).toContain("v0.1.37");
    expect(text).toContain("Offline playlist");
    expect(text).toContain("Overlay after Alt+Tab");
    expect(text).toContain("New");
    expect(text).toContain("Fixed");

    const button = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent === "Got it",
    );
    expect(button).toBeDefined();
    await act(async () => {
      button!.click();
    });
    expect(useChangelogStore.getState().isOpen).toBe(false);
    expect(localStorage.getItem("liner_changelog_last_seen_v1")).toBe("0.1.37");
  });

  it("uses the history title and an empty state when there are no entries", async () => {
    await act(async () => {
      root.render(
        <I18nProvider>
          <ChangelogModal />
        </I18nProvider>,
      );
    });
    await act(async () => {
      useChangelogStore.setState({ isOpen: true, mode: "history", entries: [], version: "0.1.35" });
    });

    const text = document.body.textContent ?? "";
    expect(text).toContain("Changelog");
    expect(text).toContain("No changelog for this version yet.");
  });
});
