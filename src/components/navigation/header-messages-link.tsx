"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { authPathForRedirect } from "@/lib/redirects";
import { useDiscoveryAccount } from "./navigation-account-context";
import styles from "./pinpoint-chrome.module.css";

const MESSAGES_HREF = "/messages";

/** Desktop header twin of the dock's Messages item, sharing its unread count. */
export function HeaderMessagesLink({ className }: { className?: string }) {
  const { isAuthenticated, unreadMessages = 0 } = useDiscoveryAccount();
  const unread = isAuthenticated ? unreadMessages : 0;
  const label = unread ? `Messages, ${unread} unread` : "Messages";
  return <Link prefetch={false} href={isAuthenticated ? MESSAGES_HREF : authPathForRedirect(MESSAGES_HREF)}
    aria-label={label} title="Messages" className={className}>
    <span className={styles.iconBadgeAnchor}>
      <MessageCircle size={17} aria-hidden="true" />
      {unread ? <span aria-hidden="true" className={styles.iconBadge}>{unread > 99 ? "99+" : unread}</span> : null}
    </span>
  </Link>;
}
