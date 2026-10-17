import { useEffect, useState } from "react";

/**
 * Viewport-based fullscreen detection: a wayland compositor (kde meta-f,
 * hyprland keybinds) can fullscreen the os window without electron's
 * enter-full-screen event ever firing, so also treat a viewport that
 * covers the whole screen as fullscreen.
 */
export function isViewportFullScreen(): boolean {
  if (typeof window === "undefined") return false;
  const { innerWidth, innerHeight } = window;
  const width = window.screen?.width ?? 0;
  const height = window.screen?.height ?? 0;
  return (
    width > 0 &&
    height > 0 &&
    innerWidth >= width &&
    innerHeight >= height
  );
}

function merge(osFullScreen: boolean | null, viewportFullScreen: boolean) {
  return Boolean(osFullScreen) || viewportFullScreen;
}

/**
 * Tracks the OS window's fullscreen state: hydrates from the main process,
 * follows `window:state-changed` broadcasts, and falls back to measuring
 * the viewport for compositor-driven fullscreen that never produces an
 * electron event (wayland).
 */
export function useIsWindowFullScreen(): boolean {
  const [osFullScreen, setOsFullScreen] = useState<boolean | null>(null);
  const [viewportFullScreen, setViewportFullScreen] = useState(
    isViewportFullScreen,
  );

  useEffect(() => {
    if (!window.linerElectron) {
      return;
    }

    // hydrate initial os window state
    window.linerElectron.isFullScreen?.().then((fs) => {
      if (typeof fs === "boolean") setOsFullScreen(fs);
    });

    // live sync across os fullscreen transitions
    const unsubscribe = window.linerElectron.onWindowStateChange?.((state) => {
      setOsFullScreen(state.isFullScreen);
    });

    // compositor-driven fullscreen never sends electron events on wayland,
    // so verify against the viewport size on every resize
    const syncViewport = () => setViewportFullScreen(isViewportFullScreen());
    window.addEventListener("resize", syncViewport);

    return () => {
      unsubscribe?.();
      window.removeEventListener("resize", syncViewport);
    };
  }, []);

  return merge(osFullScreen, viewportFullScreen);
}
