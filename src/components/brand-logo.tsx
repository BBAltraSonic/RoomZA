import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import styles from "./navigation/pinpoint-chrome.module.css";

export function BrandLogo({
  size = 32,
  showName = true,
  tagline = false,
  className,
  nameClassName,
}: {
  size?: number;
  showName?: boolean;
  tagline?: boolean;
  className?: string;
  nameClassName?: string;
}) {
  return (
    <span className={cn(styles.palette, styles.brand, className)}>
      <span aria-hidden="true" className={styles.mark} style={{ width: size, height: size * 30 / 26 }}>
        <MapPin fill="currentColor" strokeWidth={1.5} /><i />
      </span>
      {showName ? <span className={nameClassName}>Pinpoint</span> : null}
      {showName && tagline ? <span className={styles.tagline}>the best of what’s nearby</span> : null}
    </span>
  );
}
