import type { ComponentPropsWithoutRef, ReactNode } from "react";
import Link from "next/link";
import { Heart, Plus } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";
import styles from "./pinpoint-chrome.module.css";
import { NotificationBell } from "@/features/notifications/notification-bell";

export function PinpointChrome({
  variant, className, children, ...props
}: ComponentPropsWithoutRef<"header"> & { variant: "discovery" | "workspace" }) {
  return <header {...props} data-header-variant={variant}
    className={cn(styles.palette, styles.header, variant === "workspace" && styles.workspace, className)}>
    {children}
  </header>;
}

export function PinpointBrandLink({ tagline = false }: { tagline?: boolean }) {
  return <Link prefetch={false} href="/" aria-label="Pinpoint home" className={styles.brandLink}>
    <BrandLogo size={26} tagline={tagline} />
  </Link>;
}

export function PinpointHeaderActions({
  profileMenu, showSaved = true, showNotifications = true, add,
}: {
  profileMenu?: ReactNode;
  showSaved?: boolean;
  showNotifications?: boolean;
  add?: { href: string; label: string; unavailable?: string };
}) {
  return <div className={styles.actions}>
    {showSaved ? <Link prefetch={false} href="/saved" aria-label="Saved homes" title="Saved homes" className={styles.icon}><Heart size={18} aria-hidden="true" /></Link> : null}
    {showNotifications ? <NotificationBell className={styles.icon} /> : null}
    {add ? add.unavailable
      ? <button type="button" disabled title={add.unavailable} className={styles.add} aria-label={add.label}><Plus size={17} aria-hidden="true" /><span>{add.label}</span></button>
      : <Link prefetch={false} href={add.href} className={styles.add} aria-label={add.label}><Plus size={17} aria-hidden="true" /><span>{add.label}</span></Link>
      : null}
    {profileMenu}
  </div>;
}
