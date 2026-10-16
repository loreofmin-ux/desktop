import { useEffect } from "react";
import Dialog from "@/shared/ui/Dialog";
import Button from "@/shared/ui/Button";
import { LinkLine } from "@mingcute/react";
import { useTranslation, type Locale } from "@/languages";
import { useChangelogStore } from "../store/changelogStore";
import { resolveText, type ChangeType } from "../lib/changelog";

const font = { fontFamily: "var(--font-inter), sans-serif" } as const;

const RELEASES_URL = "https://github.com/tryliner/desktop/releases";

const TYPE_CLASSES: Record<ChangeType, string> = {
  new: "bg-[#2383e2]/12 text-[#2383e2]",
  improved: "bg-emerald-400/12 text-emerald-500",
  fixed: "bg-border-alpha-14 text-text-secondary",
};

function formatDate(date: string, locale: Locale): string {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(parsed);
  } catch {
    return date;
  }
}

export default function ChangelogModal() {
  const { t, locale } = useTranslation();
  const isOpen = useChangelogStore((state) => state.isOpen);
  const mode = useChangelogStore((state) => state.mode);
  const entries = useChangelogStore((state) => state.entries);
  const version = useChangelogStore((state) => state.version);
  const close = useChangelogStore((state) => state.close);

  useEffect(() => {
    useChangelogStore.getState().checkOnLaunch();
  }, []);

  const title =
    mode === "update"
      ? t("changelog.update_title", { version })
      : t("changelog.history_title");

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      maxWidth={420}
    >
      <div className="flex flex-col gap-[16px] px-[20px] pb-[20px]">
        <div className="flex flex-col gap-[6px]">
          <h3
            className="text-text-primary text-[16px] font-[600] tracking-[-0.01em] m-0"
            style={font}
          >
            {title}
          </h3>
          <p
            className="text-text-secondary text-[13px] leading-relaxed m-0 font-[400]"
            style={font}
          >
            {mode === "update" ? t("changelog.update_desc") : t("changelog.history_desc")}{" "}
            <a
              href={RELEASES_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.preventDefault();
                window.open(RELEASES_URL, "_blank", "noopener,noreferrer");
              }}
              className="inline-flex items-center gap-[3px] text-[#2383e2] hover:bg-[#2383e2]/10 dark:hover:bg-[#2383e2]/15 px-[5px] py-[1px] -mx-[3px] rounded-md font-[500] cursor-pointer align-baseline select-none transition-colors"
            >
              <span>{t("changelog.all_releases")}</span>
              <LinkLine size={12} className="inline shrink-0 opacity-80" />
            </a>
          </p>
        </div>

        <div className="flex flex-col gap-[16px] max-h-[50vh] overflow-y-auto -mx-[4px] px-[4px]">
          {entries.length === 0 ? (
            <p className="text-text-tertiary text-[13px] m-0" style={font}>
              {t("changelog.empty")}
            </p>
          ) : (
            entries.map((entry) => (
              <section key={entry.version} className="flex flex-col gap-[8px]">
                <div className="flex items-center gap-[8px]">
                  <span
                    className="inline-flex items-center h-[22px] rounded-full bg-border-alpha-14 px-[9px] border border-border-primary/40 text-[11.5px] font-[500] text-text-secondary leading-none select-none"
                    style={font}
                  >
                    v{entry.version}
                  </span>
                  {entry.date ? (
                    <span className="text-text-tertiary text-[12px] select-none" style={font}>
                      {formatDate(entry.date, locale)}
                    </span>
                  ) : null}
                </div>
                <ul className="flex flex-col gap-[6px] m-0 p-0 list-none">
                  {entry.changes.map((item, index) => (
                    <li key={index} className="flex items-start gap-[8px]">
                      <span
                        className={`shrink-0 inline-flex items-center h-[18px] rounded-[5px] px-[6px] text-[10.5px] font-[600] leading-none mt-[1px] select-none ${TYPE_CLASSES[item.type]}`}
                        style={font}
                      >
                        {t(`changelog.types.${item.type}`)}
                      </span>
                      <span
                        className="text-text-primary text-[13px] leading-snug"
                        style={font}
                      >
                        {resolveText(item, locale)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>

        <div className="flex items-center gap-[8px] w-full pt-[4px]">
          <Button
            variant="primary"
            onClick={close}
            className="flex-1 !h-[36px] !text-[13px]"
          >
            {t("changelog.close_button")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
