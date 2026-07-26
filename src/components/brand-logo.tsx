import { cn } from "@/lib/utils";

export function BrandLogo({
  size = 32,
  showName = true,
  className,
  nameClassName,
}: {
  size?: number;
  showName?: boolean;
  className?: string;
  nameClassName?: string;
}) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-2.5", className)}>
      <span
        aria-hidden="true"
        className="brand-mark shrink-0 rounded-lg bg-cover bg-center"
        style={{ width: size, height: size }}
      />
      {showName ? (
        <span className={cn("font-bold tracking-tight text-ink", nameClassName)}>
          Pinpoints
        </span>
      ) : null}
    </span>
  );
}
