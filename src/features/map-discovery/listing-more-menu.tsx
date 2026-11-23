"use client";

import { useRef } from "react";
import { Menu } from "@base-ui/react/menu";
import { Flag, MoreHorizontal, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

const itemClassName = "flex min-h-11 w-full cursor-default items-center gap-3 rounded-lg px-3 text-sm font-medium text-ink outline-none data-highlighted:bg-muted data-disabled:opacity-50";

/**
 * The listing's less frequent actions, kept out of the way of Save, Contact and Apply.
 * Share hands back the trigger so focus can return to it after a manual-copy fallback.
 */
export function ListingMoreMenu({ onShare, onReport, sharing = false, className, iconClassName }: {
  onShare: (trigger: HTMLElement | null) => void;
  onReport: () => void;
  sharing?: boolean;
  className?: string;
  iconClassName?: string;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  return <Menu.Root>
    <Menu.Trigger ref={triggerRef} aria-label="More actions" aria-busy={sharing} className={className}>
      <MoreHorizontal className={cn("size-4", iconClassName)} aria-hidden="true" />
    </Menu.Trigger>
    <Menu.Portal>
      <Menu.Positioner side="bottom" align="end" sideOffset={8} collisionPadding={12} className="z-[calc(var(--z-dialog)-1)]">
        <Menu.Popup className="min-w-52 rounded-xl border border-border bg-panel p-1.5 shadow-[var(--elevation-2)] outline-none">
          <Menu.Item disabled={sharing} onClick={() => onShare(triggerRef.current)} className={itemClassName}>
            <Share2 className="size-4" aria-hidden="true" />Share listing
          </Menu.Item>
          <Menu.Item onClick={onReport} className={itemClassName}>
            <Flag className="size-4" aria-hidden="true" />Report this listing
          </Menu.Item>
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>;
}
