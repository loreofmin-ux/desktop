import React from "react";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { createRoot, Root } from "react-dom/client";
import { act } from "react";
import { useIsWindowFullScreen } from "./useIsWindowFullScreen";

type WindowStateCb = (state: {
  isFullScreen: boolean;
  isMaximized: boolean;
}) => void;
type Unsubscribe = () => void;

const electronApi = {
  isFullScreen: vi.fn<() => Promise<boolean>>(),
  onWindowStateChange: vi.fn<(cb: WindowStateCb) => Unsubscribe>(),
};

let latest: boolean | null = null;
let emitWindowState: WindowStateCb | null = null;
let unsubscribeSpy: Unsubscribe | null = null;

function Harness() {
  latest = useIsWindowFullScreen();
  return null;
}

describe("useIsWindowFullScreen", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    window.linerElectron = {
      ...window.linerElectron,
      isFullScreen: electronApi.isFullScreen,
      onWindowStateChange: electronApi.onWindowStateChange,
    } as typeof window.linerElectron;
  });

  afterEach(() => {
    if (root && container) {
      act(() => {
        root!.unmount();
      });
      document.body.removeChild(container);
    }
    root = null;
    container = null;
    document.body.innerHTML = "";
    delete (window as { linerElectron?: unknown }).linerElectron;
    emitWindowState = null;
    unsubscribeSpy = null;
    vi.clearAllMocks();
  });

  function mount() {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root!.render(<Harness />);
    });
  }

  function stubWindow(
    initialFullScreen: boolean,
    onWindowsState = (cb: WindowStateCb): Unsubscribe => {
      emitWindowState = cb;
      unsubscribeSpy = () => {
        /* unsubscribed */
      };
      return unsubscribeSpy;
    },
  ) {
    electronApi.isFullScreen.mockResolvedValue(initialFullScreen);
    electronApi.onWindowStateChange.mockImplementation(onWindowsState);
  }

  it("starts square-by-default: false with a windowed os window", async () => {
    stubWindow(false);
    mount();
    expect(latest).toBe(false);
    await act(async () => {
      await Promise.resolve();
    });
    expect(latest).toBe(false);
  });

  it("hydrates true when the window opens already fullscreen", async () => {
    stubWindow(true);
    mount();
    await act(async () => {
      await Promise.resolve();
    });
    expect(latest).toBe(true);
  });

  it("follows window:state-changed broadcasts both ways", async () => {
    stubWindow(false);
    mount();
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      emitWindowState?.({ isFullScreen: true, isMaximized: false });
    });
    expect(latest).toBe(true);

    act(() => {
      emitWindowState?.({ isFullScreen: false, isMaximized: false });
    });
    expect(latest).toBe(false);
  });

  it("unsubscribes from broadcasts on unmount", async () => {
    let unsubscribed = false;
    stubWindow(false, (cb) => {
      emitWindowState = cb;
      return () => {
        unsubscribed = true;
      };
    });
    mount();
    await act(async () => {
      await Promise.resolve();
    });
    expect(typeof emitWindowState).toBe("function");

    act(() => {
      root!.unmount();
    });
    root = null;
    expect(unsubscribed).toBe(true);
  });
});
