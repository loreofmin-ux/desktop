import { useCallback, useState } from "react";

export interface FullscreenQueue {
  open: boolean;
  show: () => void;
  close: () => void;
  toggle: () => void;
}

export function useFullscreenQueue(fullscreenOpen: boolean): FullscreenQueue {
  const [open, setOpen] = useState(false);
  const [wasFullscreen, setWasFullscreen] = useState(fullscreenOpen);
  if (wasFullscreen !== fullscreenOpen) {
    setWasFullscreen(fullscreenOpen);
    setOpen(false);
  }

  const show = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((prev) => !prev), []);

  return { open: open && fullscreenOpen, show, close, toggle };
}
