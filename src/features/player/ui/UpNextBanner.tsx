import { AnimatePresence, motion } from "framer-motion";
import { MusicNote } from "@solar-icons/react";
import { usePlayerState } from "../hooks/usePlayerState";
import { getUpNextTrack } from "../engine/upNext";
import { CoverImage } from "@/features/covers";
import { useTranslation } from "@/languages";

export function UpNextBanner() {
  const player = usePlayerState();
  const { t } = useTranslation();
  const nextTrack = getUpNextTrack(player);

  return (
    <AnimatePresence>
      {nextTrack && (
        <motion.div
          key={nextTrack.id}
          role="status"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="flex w-[320px] items-center gap-[12px] rounded-xl bg-black/50 backdrop-blur-xl p-[8px] pr-[14px] text-white select-none"
        >
          <div className="relative h-[44px] w-[44px] shrink-0 overflow-hidden rounded-md bg-white/5">
            {nextTrack.coverUrl ? (
              <CoverImage
                src={nextTrack.coverUrl}
                alt={nextTrack.title}
                fill
                sizes="44px"
                unoptimized
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-white/40">
                <MusicNote size={20} />
              </div>
            )}
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="text-[11px] font-[500] uppercase tracking-[0.06em] text-white/50">
              {t("player.up_next")}
            </span>
            <span
              className="truncate text-[14px] font-[600] text-white"
              style={{ letterSpacing: "-0.03em" }}
            >
              {nextTrack.title}
            </span>
            {nextTrack.artists && (
              <span className="truncate text-[12px] text-white/60">
                {nextTrack.artists}
              </span>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default UpNextBanner;
