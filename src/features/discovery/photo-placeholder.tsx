import { ImageOff } from "lucide-react";

export function PhotoPlaceholder() {
  return <span className="flex size-full flex-col items-center justify-center gap-2 bg-muted text-sm text-muted-foreground">
    <ImageOff size={24} aria-hidden="true" />Photo unavailable
  </span>;
}
