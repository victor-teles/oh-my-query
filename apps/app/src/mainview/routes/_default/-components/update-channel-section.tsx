import { CheckCircle2, Download, Loader2, RefreshCw } from "lucide-react";
import { useCallback } from "react";

import type { UpdateChannel } from "@/routes/_default/-hooks/use-update-channel";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useUpdateChannel } from "@/routes/_default/-hooks/use-update-channel";

import { useSettingsFeedback } from "./settings-feedback-context";

interface ChannelMeta {
  value: UpdateChannel;
  label: string;
  blurb: string;
  cadence: string;
  disabled?: boolean;
  disabledHint?: string;
}

const CHANNELS: ChannelMeta[] = [
  {
    blurb: "Fully tested releases. The default for everyone.",
    cadence: "~monthly",
    label: "Stable",
    value: "stable",
  },
  {
    blurb: "Get new features early. May still have rough edges.",
    cadence: "weekly",
    label: "Beta",
    value: "beta",
  },
  {
    blurb: "Bleeding edge. Built from main, expect breakage.",
    cadence: "daily",
    disabled: true,
    disabledHint: "Coming soon",
    label: "Nightly",
    value: "nightly",
  },
];

interface ChannelCardProps {
  meta: ChannelMeta;
  selected: boolean;
  onSelect: (value: UpdateChannel) => void;
}

const ChannelCard = ({ meta, selected, onSelect }: ChannelCardProps) => {
  const handleClick = useCallback(() => {
    if (meta.disabled) {
      return;
    }
    onSelect(meta.value);
  }, [meta.disabled, meta.value, onSelect]);

  return (
    <button
      aria-pressed={selected}
      className={cn(
        "group flex w-full flex-col items-start gap-1.5 rounded-lg border p-4 text-left transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring",
        meta.disabled && "cursor-not-allowed opacity-50",
        !meta.disabled && "cursor-pointer",
        selected
          ? "border-primary bg-primary/5"
          : "border-foreground/10 hover:border-foreground/25"
      )}
      disabled={meta.disabled}
      onClick={handleClick}
      title={meta.disabled ? meta.disabledHint : undefined}
      type="button"
    >
      <div className="flex w-full items-center justify-between">
        <span className="text-sm font-semibold">{meta.label}</span>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {meta.disabled ? meta.disabledHint : meta.cadence}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{meta.blurb}</p>
    </button>
  );
};

const formatRelative = (timestamp: number): string => {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 5) {
    return "just now";
  }
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.round(seconds / 60);
  return `${minutes}m ago`;
};

export const UpdateChannelSection = () => {
  const {
    channel,
    check,
    checkNow,
    installNow,
    loading,
    pendingRestart,
    setChannel,
    supported,
  } = useUpdateChannel();
  const { notifySaved } = useSettingsFeedback();

  const handleSelect = useCallback(
    async (value: UpdateChannel) => {
      await setChannel(value);
      notifySaved();
    },
    [notifySaved, setChannel]
  );

  if (!supported) {
    return (
      <section>
        <h2 className="text-xl font-semibold tracking-tight">Updates</h2>
        <p className="mt-1.5 mb-6 text-sm text-muted-foreground">
          Channel switching and auto-update only work in the desktop app.
        </p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-xl font-semibold tracking-tight">Updates</h2>
      <p className="mt-1.5 mb-6 text-sm text-muted-foreground">
        Pick a release channel and check for updates. New channel takes effect
        on next launch.
      </p>

      <div
        aria-label="Release channel"
        className="grid gap-3 sm:grid-cols-3"
        role="radiogroup"
      >
        {CHANNELS.map((meta) => (
          <ChannelCard
            key={meta.value}
            meta={meta}
            onSelect={handleSelect}
            selected={!loading && channel === meta.value}
          />
        ))}
      </div>

      {pendingRestart && (
        <p className="mt-3 text-xs text-muted-foreground">
          Restart oh-my-query to start receiving updates from the new channel.
        </p>
      )}

      <div className="mt-8 flex flex-col gap-3 border-t border-foreground/10 pt-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Check for updates</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              We don&apos;t auto-check on launch &mdash; click below when you
              want.
            </p>
          </div>
          <Button
            disabled={
              check.status === "checking" || check.status === "installing"
            }
            onClick={checkNow}
            size="sm"
            type="button"
            variant="outline"
          >
            {check.status === "checking" ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Checking
              </>
            ) : (
              <>
                <RefreshCw className="size-3.5" />
                Check now
              </>
            )}
          </Button>
        </div>

        {check.status === "no-update" && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="size-3.5 text-primary" />
            You&apos;re up to date &middot; checked{" "}
            {formatRelative(check.checkedAt)}
          </p>
        )}

        {check.status === "available" && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-primary/30 bg-primary/5 p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">
                Update available &middot; v{check.update.version}
              </p>
              {check.update.notes && (
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                  {check.update.notes}
                </p>
              )}
            </div>
            <Button onClick={installNow} size="sm" type="button">
              <Download className="size-3.5" />
              Install &amp; restart
            </Button>
          </div>
        )}

        {check.status === "installing" && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Downloading and installing&hellip;
          </p>
        )}

        {check.status === "installed" && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="size-3.5 text-primary" />
            Update installed. Relaunch to apply.
          </p>
        )}

        {check.status === "error" && (
          <p className="text-xs text-destructive">
            Couldn&apos;t check for updates: {check.message}
          </p>
        )}
      </div>
    </section>
  );
};
