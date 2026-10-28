import { AnimatePresence, motion } from "framer-motion";
import { Sidebar } from "@solar-icons/react";
import { useTranslation } from "@/languages";
import { cn } from "@/shared/lib";
import { ISLAND_SURFACE } from "@/shared/ui";
import RightDrawer from "./RightDrawer";

const DRAWER_EASE = [0.22, 1, 0.36, 1] as const;

export interface FullscreenQueueButtonProps {
  open: boolean;
  onToggle: () => void;
}

export function FullscreenQueueButton({
  open,
  onToggle,
}: FullscreenQueueButtonProps) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      aria-label={t("player.queue")}
      aria-pressed={open}
      onClick={onToggle}
      data-no-window-drag
      className={cn(
        ISLAND_SURFACE,
        "inline-flex h-[32px] w-[32px] items-center justify-center border-none cursor-pointer select-none pointer-events-auto transition-all active:scale-[0.94]",
        open
          ? "bg-white/[0.16] text-white"
          : "text-white/80 hover:text-white hover:bg-white/10",
      )}
    >
      <Sidebar size={18} weight={open ? "Bold" : "Outline"} />
    </button>
  );
}

export interface FullscreenQueueDrawerProps {
  open: boolean;
  width: number;
  onClose: () => void;
  onNavigate: () => void;
}

export function FullscreenQueueDrawer({
  open,
  width,
  onClose,
  onNavigate,
}: FullscreenQueueDrawerProps) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.aside
          key="fullscreen-queue"
          data-theme="dark"
          data-no-window-drag
          initial={{ x: width + 6 }}
          animate={{ x: 0 }}
          exit={{ x: width + 6 }}
          transition={{ duration: 0.28, ease: DRAWER_EASE }}
          className="dark pointer-events-auto absolute top-[44px] right-[6px] bottom-[6px] z-[75]"
          style={{ width }}
        >
          <RightDrawer onClose={onClose} onNavigate={onNavigate} />
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
