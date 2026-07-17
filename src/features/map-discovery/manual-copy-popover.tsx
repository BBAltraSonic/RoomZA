"use client";

import { Copy, X } from "lucide-react";
import { useEffect, useRef } from "react";

type ManualCopyPopoverProps = {
  url: string;
  onClose: () => void;
};

export function ManualCopyPopover({ url, onClose }: ManualCopyPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();

    function handlePointerDown(event: PointerEvent) {
      if (!popoverRef.current?.contains(event.target as Node)) onClose();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  function selectUrl() {
    inputRef.current?.focus();
    inputRef.current?.select();
  }

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby="manual-copy-title"
      aria-describedby="manual-copy-instructions"
      className="fixed inset-x-4 bottom-4 z-[80] mx-auto max-w-md rounded-2xl border border-border bg-panel p-4 text-ink shadow-[var(--elevation-2)] sm:bottom-auto sm:left-auto sm:right-5 sm:top-20 sm:mx-0 sm:w-[22rem]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p id="manual-copy-title" className="text-sm font-semibold">
            Copy this listing link
          </p>
          <p id="manual-copy-instructions" className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Automatic copying is unavailable. Press Ctrl+C or use your device&apos;s copy command.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Close copy link"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={url}
          readOnly
          onFocus={(event) => event.currentTarget.select()}
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm text-ink outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          aria-label="Listing link"
        />
        <button
          type="button"
          onClick={selectUrl}
          className="inline-flex min-h-11 items-center gap-2 rounded-md bg-forest px-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-forest/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Copy className="size-4" />
          Select
        </button>
      </div>
    </div>
  );
}
