import { describe, it, expect, afterEach } from "vitest";
import { createRoot, Root } from "react-dom/client";
import { act } from "react";
import { useFullscreenQueue, type FullscreenQueue } from "./useFullscreenQueue";

let latest: FullscreenQueue | null = null;

function Harness({ fullscreenOpen }: { fullscreenOpen: boolean }) {
  latest = useFullscreenQueue(fullscreenOpen);
  return null;
}

describe("useFullscreenQueue", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    if (root && container) {
      act(() => root!.unmount());
      document.body.removeChild(container);
    }
    root = null;
    container = null;
    latest = null;
  });

  function render(fullscreenOpen: boolean) {
    if (!container) {
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
    }
    act(() => root!.render(<Harness fullscreenOpen={fullscreenOpen} />));
  }

  it("starts closed and toggles open and closed", () => {
    render(true);
    expect(latest!.open).toBe(false);
    act(() => latest!.toggle());
    expect(latest!.open).toBe(true);
    act(() => latest!.toggle());
    expect(latest!.open).toBe(false);
  });

  it("opens with show and closes with close", () => {
    render(true);
    act(() => latest!.show());
    expect(latest!.open).toBe(true);
    act(() => latest!.close());
    expect(latest!.open).toBe(false);
  });

  it("is never open outside the player", () => {
    render(false);
    act(() => latest!.show());
    expect(latest!.open).toBe(false);
  });

  it("starts closed again the next time the player opens", () => {
    render(true);
    act(() => latest!.show());
    render(false);
    expect(latest!.open).toBe(false);
    render(true);
    expect(latest!.open).toBe(false);
  });
});
