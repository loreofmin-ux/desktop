import React, { act } from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";

// @ts-expect-error - act support flag in vitest browserless DOM environment
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("framer-motion", () => {
  const cache: Record<string, any> = {};
  return {
    AnimatePresence: ({ children }: any) => <>{children}</>,
    motion: new Proxy(
      {},
      {
        get: (_target, prop: string) => {
          if (!cache[prop]) {
            cache[prop] = React.forwardRef(({ children, ...props }: any, ref: any) => {
              const clean = { ...props };
              for (const k of ["layout", "initial", "animate", "exit", "transition", "whileHover", "whileTap", "whileDrag"]) {
                delete clean[k];
              }
              return React.createElement(prop, { ref, ...clean }, children);
            });
          }
          return cache[prop];
        },
      },
    ),
  };
});

const submitLyricsReport = vi.fn();
vi.mock("@/shared/api", () => ({
  api: { submitLyricsReport: (...args: unknown[]) => submitLyricsReport(...args) },
}));

import { ToastProvider } from "@/shared/ui";
import { useLyricsStore } from "../store/lyricsStore";
import { parseRawLyrics } from "../engine/lyricsParser";
import { useLyricsReportStore } from "./lyricsReportStore";
import { useLyricsReportMenu } from "./useLyricsReportMenu";
import type { LyricsReport } from "./lyricsReport";

const LRC = "[00:01.00] Pour me a cocktail\n[00:05.00] At the end of the night";
const track = { id: "trk_9", title: "Bar Song", artists: "Band", durationMs: 200_000, coverUrl: "" };

function Harness({ onPlayMoment, position = 2_500 }: { onPlayMoment: (r: LyricsReport) => void; position?: number }) {
  const menu = useLyricsReportMenu({
    origin: "drawer",
    track,
    getPositionMs: () => position,
    onPlayMoment,
  });
  return (
    <div>
      <div data-testid="line-0" onContextMenu={(e) => menu.openMenu(e, { lineIndex: 0, lineText: "Pour me a cocktail" })}>
        Pour me a cocktail
      </div>
      {menu.element}
    </div>
  );
}

function findButton(text: string): HTMLButtonElement | undefined {
  return Array.from(document.body.querySelectorAll("button")).find((b) =>
    b.textContent?.includes(text),
  ) as HTMLButtonElement | undefined;
}

describe("lyrics report menu", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onPlayMoment = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    useLyricsReportStore.setState({ reports: [] });
    const parsed = parseRawLyrics(LRC, "lrc");
    useLyricsStore.setState({
      currentLyricsTrackId: "trk_9",
      rawLyrics: LRC,
      rawFormat: "lrc",
      plainLyrics: parsed.plainLyrics,
      baseSyncedLines: parsed.syncedLines,
      syncedLines: parsed.syncedLines,
      activeProvider: "lrclib",
      availableProviders: [],
      offsetMs: 0,
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onPlayMoment.mockReset();
    submitLyricsReport.mockReset();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function render(position?: number) {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <ToastProvider>
            <Harness onPlayMoment={onPlayMoment} position={position} />
          </ToastProvider>
        </MemoryRouter>,
      );
    });
  }

  async function rightClickLine() {
    const line = container.querySelector('[data-testid="line-0"]')!;
    await act(async () => {
      line.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 40, clientY: 60 }));
    });
  }

  it("does not add anything to the page until a line is right-clicked", async () => {
    await render();
    expect(findButton("Report wrong lyrics")).toBeUndefined();
    expect(document.body.querySelector('[data-dropdown-menu="true"]')).toBeNull();
  });

  it("saves a report in one click from the context menu", async () => {
    await render();
    await rightClickLine();
    const item = findButton("Report wrong lyrics");
    expect(item).toBeDefined();
    expect(findButton("Report out of sync")).toBeDefined();

    await act(async () => item!.click());

    const { reports } = useLyricsReportStore.getState();
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({
      kind: "wrong_words",
      positionMs: 2_500,
      origin: "drawer",
      line: { index: 0, text: "Pour me a cocktail", startMs: 1_000, endMs: 5_000, picked: "clicked" },
      track: { id: "trk_9", title: "Bar Song" },
    });
    expect(document.body.textContent).toContain("Thanks, report saved");
    expect(document.body.textContent).toContain('"Pour me a cocktail" · 0:02.5');
    // nothing leaves the device while the backend route is missing
    expect(submitLyricsReport).not.toHaveBeenCalled();
  });

  it("undo removes the report", async () => {
    await render();
    await rightClickLine();
    await act(async () => findButton("Report wrong lyrics")!.click());
    expect(useLyricsReportStore.getState().reports).toHaveLength(1);
    await act(async () => findButton("Undo")!.click());
    expect(useLyricsReportStore.getState().reports).toHaveLength(0);
  });

  it("does not record a double click twice", async () => {
    await render();
    await rightClickLine();
    await act(async () => findButton("Report wrong lyrics")!.click());
    await rightClickLine();
    await act(async () => findButton("Report wrong lyrics")!.click());
    expect(useLyricsReportStore.getState().reports).toHaveLength(1);
    expect(document.body.textContent).toContain("Already reported");
  });

  it("lists reports, keeps a note and plays the moment", async () => {
    await render(83_400);
    await rightClickLine();
    await act(async () => findButton("Report out of sync")!.click());

    await rightClickLine();
    const view = findButton("View lyrics reports (1)");
    expect(view).toBeDefined();
    await act(async () => view!.click());

    const cards = document.body.querySelectorAll('[data-testid="lyrics-report-card"]');
    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toContain("Reported at 1:23.4");
    expect(cards[0].textContent).toContain("Line 0:01.0 – 0:05.0");
    expect(cards[0].textContent).toContain("Out of sync");
    expect(cards[0].textContent).toContain("At the end of the night");

    const input = cards[0].querySelector("input")!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      setter.call(input, "I hear bar");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      input.focus();
      input.blur();
    });
    expect(useLyricsReportStore.getState().reports[0].note).toBe("I hear bar");

    await act(async () => findButton("Play this moment")!.click());
    expect(onPlayMoment).toHaveBeenCalledTimes(1);
    expect(onPlayMoment.mock.calls[0][0].positionMs).toBe(83_400);

    await act(async () => findButton("Clear all")!.click());
    expect(useLyricsReportStore.getState().reports).toHaveLength(0);
    expect(document.body.textContent).toContain("No reports yet");
  });
});
