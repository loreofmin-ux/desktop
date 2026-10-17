import { useEffect, useState } from "react";

/**
 * Tracks the OS window's fullscreen state: hydrates once from the main
 * process, then follows `window:state-changed` broadcasts.
 */
export function useIsWindowFullScreen(): boolean {
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    if (!window.linerElectron) return;

    // hydrate initial os window state
    window.linerElectron.isFullScreen?.().then((fs) => {
      if (typeof fs === "boolean") setIsFullScreen(fs);
    });

    // live sync across os fullscreen transitions
    const unsubscribe = window.linerElectron.onWindowStateChange?.((state) => {
      setIsFullScreen(state.isFullScreen);
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  return isFullScreen;
}
