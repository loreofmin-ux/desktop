import { useState, useEffect, useRef, memo, useCallback, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePlayerState, playerEngine, playLyricsReportMoment } from "@/features/player";
import QueuePanel from "@/features/player/ui/QueuePanel";
import { useLyricsStore, type WordData, useLyricsAnimator } from "@/features/lyrics";
import { useLyricsReportMenu, readAudioPositionMs } from "@/features/lyrics/report";
import { useTranslation } from "@/languages";
import { useToast } from "@/shared/ui";
import { FiMusic } from "react-icons/fi";
import { ArrowLeftLine } from "@mingcute/react";
import { useTheme } from "next-themes";
import {
  useIsContentTransparent,
  useCustomizationStore,
  getBlockStyle,
} from "@/features/settings/store/customizationStore";

export interface RightDrawerProps {
  activeTab: "queue" | "lyrics";
  onTabChange: (tab: "queue" | "lyrics") => void;
  onClose?: () => void;
}

function RightDrawer({ activeTab, onTabChange, onClose }: RightDrawerProps) {
  const player = usePlayerState();
  const { t } = useTranslation();
  const { toast } = useToast();
  const hasCustomBg = useIsContentTransparent();
  const { resolvedTheme } = useTheme();
  const isDark =
    resolvedTheme
      ? resolvedTheme === "dark"
      : typeof document !== "undefined" &&
        (document.documentElement.getAttribute("data-theme") === "dark" ||
          (!document.documentElement.getAttribute("data-theme") &&
            window.matchMedia?.("(prefers-color-scheme: dark)")?.matches));
  const backgroundImage = useCustomizationStore((s) => s.backgroundImage);
  const backgroundBlur = useCustomizationStore((s) => s.backgroundBlur);
  const backgroundDim = useCustomizationStore((s) => s.backgroundDim);
  const contentViewConfig = useCustomizationStore((s) => s.contentView);

  const drawerStyle = useMemo(
    () => getBlockStyle(contentViewConfig, isDark, hasCustomBg),
    [contentViewConfig, isDark, hasCustomBg],
  );

  const drawerVarsStyle = useMemo(() => {
    const { background, backdropFilter, WebkitBackdropFilter, ...vars } = drawerStyle;
    return vars;
  }, [drawerStyle]);

  const activeTabRef = useRef<"queue" | "lyrics">(activeTab);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);
  const [isLyricsScrolled, setIsLyricsScrolled] = useState(false);

  const {
    lyricsLoading,
    syncedLines,
    plainLyrics,
    lyricsQuality,
    currentLyricsTrackId,
  } = useLyricsStore();
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);
  const lyricsContainerCallbackRef = useCallback(
    (el: HTMLDivElement | null) => {
      lyricsContainerRef.current = el;
    },
    [],
  );

  const prevTrackIdRef = useRef<string | null>(null);
  const prevQualityRef = useRef(lyricsQuality);

  const isMatchingTrack = Boolean(
    player.currentTrack?.id && currentLyricsTrackId === player.currentTrack.id,
  );
  const effectiveSyncedLines = isMatchingTrack ? syncedLines : [];
  const effectivePlainLyrics = isMatchingTrack ? plainLyrics : null;
  const effectiveLoading = lyricsLoading || !isMatchingTrack;

  useEffect(() => {
    const trackId = player.currentTrack?.id || null;
    if (trackId !== prevTrackIdRef.current) {
      prevTrackIdRef.current = trackId;
      prevQualityRef.current = lyricsQuality;
      return;
    }

    if (
      activeTab === "lyrics" &&
      lyricsQuality > prevQualityRef.current &&
      prevQualityRef.current > 0
    ) {
      toast(t("player.lyrics_upgraded"), "success");
    }
    prevQualityRef.current = lyricsQuality;
  }, [lyricsQuality, activeTab, player.currentTrack?.id, t, toast]);

  const isPlaying = player.status === "playing";

  const positionMsRef = useRef(player.positionMs);
  positionMsRef.current = player.positionMs;
  const getReportPositionMs = useCallback(
    () => readAudioPositionMs(positionMsRef.current),
    [],
  );
  const lyricsReport = useLyricsReportMenu({
    origin: "drawer",
    track: isMatchingTrack ? player.currentTrack : null,
    getPositionMs: getReportPositionMs,
    onPlayMoment: playLyricsReportMoment,
  });

  const [activeLineIndices, setActiveLineIndices] = useState<number[]>([]);
  const activeLineIndicesRef = useRef<number[]>([]);
  const isInFreeSearchRef = useRef(false);
  const isAutoScrollingRef = useRef(false);
  const autoScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentFollowedIndexRef = useRef<number | null>(null);
  const freeScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWheelTimeRef = useRef(0);

  const scrollToActiveLine = useCallback(
    (index: number, behavior: ScrollBehavior = "smooth") => {
      if (isInFreeSearchRef.current) return;
      const container = lyricsContainerRef.current;
      if (!container) return;
      const activeEl = container.querySelector<HTMLElement>(
        `[data-line-index="${index}"]`,
      );
      if (!activeEl) return;

      const containerRect = container.getBoundingClientRect();
      const elRect = activeEl.getBoundingClientRect();
      if (containerRect.height === 0 || elRect.height === 0) return;
      const offset = elRect.top - containerRect.top + container.scrollTop;
      const targetScrollTop =
        offset - container.clientHeight / 2 + elRect.height / 2;

      isAutoScrollingRef.current = true;
      if (autoScrollTimeoutRef.current) {
        clearTimeout(autoScrollTimeoutRef.current);
      }
      autoScrollTimeoutRef.current = setTimeout(() => {
        isAutoScrollingRef.current = false;
        autoScrollTimeoutRef.current = null;
      }, 1000);

      container.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior,
      });
    },
    [],
  );

  const returnToFollowingMode = useCallback(
    (targetIndex?: number, behavior: ScrollBehavior = "smooth") => {
      if (freeScrollTimerRef.current) {
        clearTimeout(freeScrollTimerRef.current);
        freeScrollTimerRef.current = null;
      }
      if (autoScrollTimeoutRef.current) {
        clearTimeout(autoScrollTimeoutRef.current);
        autoScrollTimeoutRef.current = null;
      }
      isAutoScrollingRef.current = false;
      isInFreeSearchRef.current = false;
      lastWheelTimeRef.current = 0;

      const idxToScroll =
        targetIndex !== undefined
          ? targetIndex
          : activeLineIndicesRef.current.length > 0
            ? activeLineIndicesRef.current[activeLineIndicesRef.current.length - 1]
            : null;

      if (idxToScroll !== null && idxToScroll !== undefined) {
        currentFollowedIndexRef.current = idxToScroll;
        scrollToActiveLine(idxToScroll, behavior);
      }
    },
    [scrollToActiveLine],
  );

  const handleUserScroll = useCallback(() => {
    if (isAutoScrollingRef.current) {
      isAutoScrollingRef.current = false;
      if (autoScrollTimeoutRef.current) {
        clearTimeout(autoScrollTimeoutRef.current);
        autoScrollTimeoutRef.current = null;
      }
      const container = lyricsContainerRef.current;
      if (container) {
        container.scrollTo({ top: container.scrollTop, behavior: "auto" });
      }
    }

    lastWheelTimeRef.current = Date.now();
    isInFreeSearchRef.current = true;

    if (freeScrollTimerRef.current) {
      clearTimeout(freeScrollTimerRef.current);
      freeScrollTimerRef.current = null;
    }

    freeScrollTimerRef.current = setTimeout(() => {
      const elapsed = Date.now() - lastWheelTimeRef.current;
      if (elapsed < 5900) return;

      returnToFollowingMode();
    }, 6000);
  }, [returnToFollowingMode]);

  const handleActiveLineChange = useCallback(
    (indices: number[]) => {
      activeLineIndicesRef.current = indices;
      setActiveLineIndices(indices);

      const latestIndex =
        indices.length > 0 ? indices[indices.length - 1] : -1;
      if (latestIndex < 0) return;

      if (isInFreeSearchRef.current) {
        return;
      }

      if (latestIndex !== currentFollowedIndexRef.current) {
        currentFollowedIndexRef.current = latestIndex;
        scrollToActiveLine(latestIndex, "smooth");
      }
    },
    [scrollToActiveLine],
  );

  const isActuallySynced = effectiveSyncedLines.some((line) => line.timeMs > 0);

  const { registerWordSpan, setWordData, clearWordSpans } = useLyricsAnimator({
    syncedLines: effectiveSyncedLines,
    isActuallySynced,
    isPlaying,
    positionMs: player.positionMs,
    durationMs: player.durationMs,
    onActiveLineChange: handleActiveLineChange,
  });

  useEffect(() => {
    const container = lyricsContainerRef.current;
    if (!container || activeTab !== "lyrics" || effectiveLoading) return;

    const onNativeUserInteraction = () => {
      handleUserScroll();
    };

    container.addEventListener("wheel", onNativeUserInteraction, {
      passive: true,
      capture: true,
    });
    container.addEventListener("touchmove", onNativeUserInteraction, {
      passive: true,
      capture: true,
    });
    return () => {
      container.removeEventListener("wheel", onNativeUserInteraction, {
        capture: true,
      });
      container.removeEventListener("touchmove", onNativeUserInteraction, {
        capture: true,
      });
    };
  }, [activeTab, effectiveLoading, handleUserScroll]);

  useEffect(() => {
    return () => {
      if (freeScrollTimerRef.current) {
        clearTimeout(freeScrollTimerRef.current);
      }
      if (autoScrollTimeoutRef.current) {
        clearTimeout(autoScrollTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    returnToFollowingMode();
    currentFollowedIndexRef.current = null;
    setActiveLineIndices([]);
    activeLineIndicesRef.current = [];
    if (lyricsContainerRef.current) {
      lyricsContainerRef.current.scrollTop = 0;
      setIsLyricsScrolled(false);
    }
  }, [player.currentTrack?.id, returnToFollowingMode]);

  useEffect(() => {
    if (activeTab === "lyrics") {
      returnToFollowingMode(undefined, "auto");
      const timer = setTimeout(() => {
        const latest =
          activeLineIndicesRef.current[activeLineIndicesRef.current.length - 1];
        if (latest !== undefined) {
          scrollToActiveLine(latest, "auto");
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [activeTab, returnToFollowingMode, scrollToActiveLine]);

  useEffect(() => {
    effectiveSyncedLines.forEach((line, i) => {
      const words = line.words || [];
      const animatedWords = words.filter((w) => w.text.trim().length > 0);
      if (animatedWords.length > 0) {
        setWordData(
          i,
          animatedWords.map((w) => ({ timeMs: w.timeMs, endMs: w.endMs })),
        );
      } else {
        clearWordSpans(i);
      }
    });
  }, [effectiveSyncedLines, setWordData, clearWordSpans]);

  const renderWordLevel = (
    line: { timeMs: number; text: string; words?: WordData[] },
    i: number,
    isActiveLine: boolean,
  ) => {
    if (!isActiveLine) {
      if (!line.words?.some((w) => w.isBackground)) {
        return line.text;
      }
      const mainWords = line.words.filter((w) => !w.isBackground);
      const bgWords = line.words.filter((w) => w.isBackground);
      return (
        <>
          <span className="inline">
            {mainWords.map((w) => w.text).join("")}
          </span>
          <div className="text-[14px] font-[500] leading-[1.15]">
            {bgWords.map((w) => w.text).join("")}
          </div>
        </>
      );
    }

    let wordsToRender =
      line.words && line.words.length > 0 ? line.words : [];

    if (wordsToRender.length === 0) {
      return line.text;
    }

    const words = wordsToRender;
    const hasBg = words.some((w) => w.isBackground);
    const animatedWords = words.filter((word) => word.text.trim().length > 0);

    const renderPart = (word: WordData, key: number, className = "") => {
      if (!word.text.trim()) return word.text;
      const animIdx = animatedWords.indexOf(word);
      return (
        <span key={key} className="inline">
          <span
            className={`bg-clip-text text-transparent ${className}`}
            style={{
              backgroundImage:
                "linear-gradient(to right, var(--color-text-primary) 0%, var(--color-text-tertiary) 0%)",
              transform: "none",
            }}
            ref={(el) => {
              if (animIdx >= 0) {
                registerWordSpan(i, animIdx, animatedWords.length, el);
              }
            }}
            onClick={(e) => {
              e.stopPropagation();
              playerEngine.seek(word.timeMs, true);
            }}
          >
            {word.text}
          </span>
        </span>
      );
    };

    if (!hasBg) {
      return words.map((word, index) => renderPart(word, index, "font-[700]"));
    }

    const mainWords = words.filter((word) => !word.isBackground);
    const bgWords = words.filter((word) => word.isBackground);

    return (
      <>
        {mainWords.map((word, index) =>
          renderPart(word, index, "font-[700]"),
        )}
        <div className="text-[14px] font-[500] leading-[1.15]">
          {bgWords.map((word, index) =>
            renderPart(
              word,
              mainWords.length + index,
              "text-[14px] font-[500]",
            ),
          )}
        </div>
      </>
    );
  };

  const lastIdx = syncedLines.length - 1;
  const lastLine = syncedLines[lastIdx];
  const lastWordEndMs = lastLine?.words?.[lastLine.words.length - 1]?.endMs;
  const prevLine = syncedLines.length > 1 ? syncedLines[lastIdx - 1] : null;
  const prevDuration = prevLine ? lastLine.timeMs - prevLine.timeMs : 5000;
  const dotsActivateMs =
    lastWordEndMs ??
    (lastLine?.timeMs != null ? lastLine.timeMs + prevDuration : null);
  const showOutroDots =
    player.durationMs > 0 &&
    lastLine?.timeMs > 0 &&
    player.durationMs - lastLine.timeMs > 5000 &&
    lastLine?.text;

  return (
    <div
      className={`relative flex flex-col h-full w-full overflow-hidden select-none shadow-[-16px_0_36px_rgba(0,0,0,0.3)] ${
        hasCustomBg
          ? ""
          : "bg-bg-primary"
      }`}
      style={drawerVarsStyle}
    >
      {hasCustomBg && backgroundImage ? (
        <div
          className="absolute inset-0 z-0 pointer-events-none overflow-hidden"
          aria-hidden="true"
        >
          <img
            src={backgroundImage}
            alt=""
            className="absolute select-none pointer-events-none max-w-none"
            style={{
              top: "-6px",
              right: "-6px",
              width: "100vw",
              height: "100vh",
              objectFit: "cover",
              filter: backgroundBlur > 0 ? `blur(${backgroundBlur}px)` : undefined,
              transform: backgroundBlur > 0 ? "scale(1.05)" : undefined,
            }}
          />
          {backgroundDim > 0 && (
            <div
              className="absolute inset-0 bg-black pointer-events-none"
              style={{ opacity: backgroundDim / 100 }}
            />
          )}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: drawerStyle.background,
              backdropFilter: drawerStyle.backdropFilter,
              WebkitBackdropFilter: drawerStyle.WebkitBackdropFilter,
            }}
          />
        </div>
      ) : null}

      <div className="relative shrink-0 z-20">
        <div
          data-window-drag
          className="relative flex items-center justify-between px-[16px] h-[56px] select-none"
        >
          <div className="flex items-center min-w-0">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label={t("common.back") || "Back"}
                data-no-tooltip="true"
                data-no-window-drag
                className={`group inline-flex h-[32px] shrink-0 items-center gap-[6px] rounded-md px-[10px] active:scale-[0.94] transition-all cursor-pointer select-none pointer-events-auto text-[13px] font-[500] border-0 !border-none ${
                  hasCustomBg
                    ? "apple-glass-pill !border-none"
                    : "bg-bg-panel/85 backdrop-blur-xl text-text-primary hover:bg-bg-panel border-0 !border-none"
                }`}
                style={{ fontFamily: "var(--font-inter), sans-serif" }}
              >
                <ArrowLeftLine
                  size={16}
                  className="transition-transform duration-150 group-hover:-translate-x-0.5"
                />
                <span className="relative -left-[1.5px] top-[1px]">{t("common.back") || "Back"}</span>
              </button>
            )}
          </div>
          <div className="w-[120px] h-[32px] shrink-0" />
        </div>

        <div className="px-[16px] pb-[10px]">
          <div
            className={`grid grid-cols-2 w-full items-center gap-[4px] rounded-xl p-[4px] ${
              hasCustomBg
                ? "apple-glass-pill"
                : "bg-bg-elevated"
            }`}
          >
            <button
              type="button"
              onClick={() => onTabChange("queue")}
              className={`relative inline-flex items-center justify-center rounded-lg px-[16px] py-[7px] text-[13px] leading-none transition-colors duration-150 border-0 bg-transparent cursor-pointer select-none active:scale-[0.97] ${
                activeTab === "queue"
                  ? hasCustomBg
                    ? "text-white dark:text-black font-semibold"
                    : "text-text-primary"
                  : hasCustomBg
                    ? "text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white"
                    : "text-text-secondary hover:text-text-primary"
              }`}
              style={{
                fontFamily: "var(--font-inter), sans-serif",
                fontWeight: activeTab === "queue" ? 500 : 400,
              }}
            >
              {activeTab === "queue" && (
                <motion.div
                  layoutId="activeRightDrawerTab"
                  className={`absolute inset-0 rounded-lg ${
                    hasCustomBg
                      ? "apple-glass-prominent"
                      : "bg-border-alpha-14"
                  }`}
                  transition={{
                    type: "spring",
                    stiffness: 450,
                    damping: 35,
                  }}
                />
              )}
              <span className="relative z-10">{t("player.queue")}</span>
            </button>
            <button
              type="button"
              onClick={() => onTabChange("lyrics")}
              className={`relative inline-flex items-center justify-center rounded-lg px-[16px] py-[7px] text-[13px] leading-none transition-colors duration-150 border-0 bg-transparent cursor-pointer select-none active:scale-[0.97] ${
                activeTab === "lyrics"
                  ? hasCustomBg
                    ? "text-white dark:text-black font-semibold"
                    : "text-text-primary"
                  : hasCustomBg
                    ? "text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white"
                    : "text-text-secondary hover:text-text-primary"
              }`}
              style={{
                fontFamily: "var(--font-inter), sans-serif",
                fontWeight: activeTab === "lyrics" ? 500 : 400,
              }}
            >
              {activeTab === "lyrics" && (
                <motion.div
                  layoutId="activeRightDrawerTab"
                  className={`absolute inset-0 rounded-lg ${
                    hasCustomBg
                      ? "apple-glass-prominent"
                      : "bg-border-alpha-14"
                  }`}
                  transition={{
                    type: "spring",
                    stiffness: 450,
                    damping: 35,
                  }}
                />
              )}
              <span className="relative z-10">{t("player.lyrics")}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative z-10">
        {activeTab === "queue" && <QueuePanel />}

        {activeTab === "lyrics" && (
          effectiveLoading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 select-none">
              <div className="w-[26px] h-[26px] rounded-full border-[2.5px] border-text-tertiary/20 border-t-text-primary animate-spin" />
              <span
                className="text-[13px] font-[500] text-text-tertiary tracking-tight"
                style={{ fontFamily: "var(--font-inter), sans-serif" }}
              >
                {t("common.loading") || "Loading"}
              </span>
            </div>
          ) : (
            <div
              className="absolute inset-0 overflow-y-auto p-[32px]"
              style={{
                maskImage:
                  "linear-gradient(to bottom, transparent, black 5%, black 95%, transparent)",
                WebkitMaskImage:
                  "linear-gradient(to bottom, transparent, black 5%, black 95%, transparent)",
              }}
              ref={lyricsContainerCallbackRef}
              onWheelCapture={handleUserScroll}
              onTouchMoveCapture={handleUserScroll}
              onScroll={(e) => {
                const target = e.currentTarget;
                const next = target.scrollTop > 2;
                setIsLyricsScrolled((prev) => (prev === next ? prev : next));
              }}
            >
              <div
                className="flex flex-col gap-[24px] pb-[50vh] pt-[10vh]"
                style={{
                  fontFamily: "var(--font-inter), sans-serif",
                  letterSpacing: "-0.02em",
                }}
              >
                {effectiveSyncedLines.length > 0 && isActuallySynced ? (
                <>
                  {effectiveSyncedLines[0].timeMs > 5000 && effectiveSyncedLines[0].text && (
                    <div
                      className={`relative text-[25px] font-[700] lyric-line ${
                        activeLineIndices.length === 0
                          ? "lyric-line--active text-text-primary"
                          : "text-text-tertiary"
                      }`}
                      style={{ transformOrigin: "left center" }}
                    >
                      {activeLineIndices.length === 0 ? (
                        <span className="inline-flex">
                          {"•••".split("").map((d, di) => (
                            <span
                              key={di}
                              className="lyric-dot-anim"
                              style={{ animationDelay: `${di * 0.2}s` }}
                            >
                              {d}
                            </span>
                          ))}
                        </span>
                      ) : (
                        "•••"
                      )}
                    </div>
                  )}
                  {effectiveSyncedLines.map((line, i) => {
                    const isActive = activeLineIndices.includes(i);
                    const isPassed =
                      i <
                      (activeLineIndices.length > 0
                        ? activeLineIndices[0]
                        : 0);

                    let displayText = line.text;

                    const tagMatch = displayText.match(/^\s*<([^>]+)>/);
                    let isRight = false;
                    let isCenter = false;
                    let customColor: string | null = null;

                    const colorMap: Record<string, string> = {
                      pink: "#f9a8d4",
                      red: "#fca5a5",
                      blue: "#93c5fd",
                      green: "#86efac",
                      yellow: "#fde047",
                      purple: "#d8b4fe",
                      orange: "#fdba74",
                      cyan: "#67e8f9",
                    };

                    if (tagMatch) {
                      displayText = displayText.slice(tagMatch[0].length).trim();
                      const tags = tagMatch[1].split(",");
                      if (tags.includes("right")) isRight = true;
                      if (tags.includes("center")) isCenter = true;

                      for (const tag of tags) {
                        if (colorMap[tag]) {
                          customColor = colorMap[tag];
                          break;
                        }
                      }
                    }

                    const isLastLine = i === effectiveSyncedLines.length - 1;
                    const isLastLineDone =
                      isLastLine &&
                      dotsActivateMs != null &&
                      player.positionMs >= dotsActivateMs;
                    const lineIsActive = isActive && !isLastLineDone;

                    const customStyle: React.CSSProperties = {
                      transformOrigin: isRight
                        ? "right center"
                        : isCenter
                          ? "center center"
                          : "left center",
                      color:
                        customColor && lineIsActive
                          ? customColor
                          : "var(--text-primary)",
                    };

                    if (isRight) {
                      customStyle.textAlign = "right";
                      customStyle.width = "100%";
                    } else if (isCenter) {
                      customStyle.textAlign = "center";
                      customStyle.width = "100%";
                    }

                    return (
                      <div
                        key={i}
                        data-line-index={i}
                        className={`relative text-[25px] font-[700] lyric-line ${
                          lineIsActive ? "lyric-line--active" : ""
                        }`}
                        style={customStyle}
                        onClick={() => {
                          returnToFollowingMode(i, "smooth");
                          playerEngine.seek(line.timeMs, true);
                        }}
                        onContextMenu={(e) =>
                          lyricsReport.openMenu(e, { lineIndex: i, lineText: displayText })
                        }
                      >
                        {displayText ? (
                          renderWordLevel(
                            { ...line, text: displayText },
                            i,
                            lineIsActive,
                          )
                        ) : lineIsActive ? (
                          <span className="inline-flex">
                            {"•••".split("").map((d, di) => (
                              <span
                                key={di}
                                className="lyric-dot-anim"
                                style={{ animationDelay: `${di * 0.2}s` }}
                              >
                                {d}
                              </span>
                            ))}
                          </span>
                        ) : (
                          "•••"
                        )}
                      </div>
                    );
                  })}
                  {showOutroDots && (
                    <div
                      className={`relative text-[25px] font-[700] lyric-line ${
                        activeLineIndices.length > 0 &&
                        activeLineIndices[0] === lastIdx &&
                        dotsActivateMs != null &&
                        player.positionMs >= dotsActivateMs
                          ? "lyric-line--active text-text-primary"
                          : "text-text-tertiary"
                      }`}
                      style={{ transformOrigin: "left center" }}
                    >
                      {activeLineIndices.length > 0 &&
                      activeLineIndices[0] === lastIdx &&
                      dotsActivateMs != null &&
                      player.positionMs >= dotsActivateMs ? (
                        <span className="inline-flex">
                          {"•••".split("").map((d, di) => (
                            <span
                              key={di}
                              className="lyric-dot-anim"
                              style={{ animationDelay: `${di * 0.2}s` }}
                            >
                              {d}
                            </span>
                          ))}
                        </span>
                      ) : (
                        "•••"
                      )}
                    </div>
                  )}
                </>
              ) : effectivePlainLyrics === "[INSTRUMENTAL]" ? (
                <div className="flex flex-col gap-[16px] text-[18px] font-[500] text-text-secondary items-center justify-center min-h-[40vh]">
                  <div className="text-[25px] font-[700] mb-[8px]">
                    <span className="inline-flex">
                      {"•••".split("").map((d, di) => (
                        <span
                          key={di}
                          className="lyric-dot-anim"
                          style={{ animationDelay: `${di * 0.2}s` }}
                        >
                          {d}
                        </span>
                      ))}
                    </span>
                  </div>
                  <div className="flex items-center gap-[12px] text-[20px] font-[600]">
                    <FiMusic className="w-[24px] h-[24px]" />
                    <span>This song is instrumental</span>
                  </div>
                </div>
              ) : effectivePlainLyrics ||
                (effectiveSyncedLines.length > 0 && !isActuallySynced) ? (
                <>
                  {(effectiveSyncedLines.length > 0
                    ? effectiveSyncedLines
                    : (effectivePlainLyrics || "")
                        .split("\n")
                        .map((t) => ({ text: t, timeMs: 0 }))
                  ).map((line, i) => {
                    let displayText = line.text.trim();

                    const tagMatch = displayText.match(/^\s*<([^>]+)>/);
                    let isRight = false;
                    let isCenter = false;

                    if (tagMatch) {
                      displayText = displayText.slice(tagMatch[0].length).trim();
                      const tags = tagMatch[1].split(",");
                      if (tags.includes("right")) isRight = true;
                      if (tags.includes("center")) isCenter = true;
                    }

                    const customStyle: React.CSSProperties = {
                      color: "var(--color-text-primary)",
                      opacity: 0.35,
                    };

                    if (isRight) {
                      customStyle.textAlign = "right";
                      customStyle.width = "100%";
                    } else if (isCenter) {
                      customStyle.textAlign = "center";
                      customStyle.width = "100%";
                    }

                    return (
                      <div
                        key={i}
                        className="relative text-[25px] font-[700] text-text-primary min-h-[24px]"
                        style={customStyle}
                        onContextMenu={(e) =>
                          displayText
                            ? lyricsReport.openMenu(e, { lineIndex: i, lineText: displayText })
                            : undefined
                        }
                      >
                        {displayText || "\n"}
                      </div>
                    );
                  })}
                </>
              ) : (
                <div className="text-[28px] font-[700] text-text-tertiary">
                  No lyrics available
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {lyricsReport.element}
    </div>
  );
}

export default memo(RightDrawer);
