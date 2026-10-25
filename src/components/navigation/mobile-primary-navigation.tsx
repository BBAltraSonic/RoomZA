import Link from "next/link";
import { Heart, Map, MessageCircle, Plus, User } from "lucide-react";
import { authPathForRedirect } from "@/lib/redirects";
import { MobileTabBar, MobileTabContent, mobileTabClassName } from "./mobile-tab-bar";

const destinations = [
  { label: "Explore", href: "/", icon: Map },
  { label: "Saved", href: "/saved", icon: Heart },
  { label: "Create", href: "/post", icon: Plus },
  { label: "Messages", href: "/messages", icon: MessageCircle },
  { label: "Profile", href: "/profile", icon: User },
] as const;

export function MobilePrimaryNavigation({ pathname, isAuthenticated }: {
  pathname: string; isAuthenticated: boolean;
}) {
  return <MobileTabBar label="Primary mobile navigation" itemCount={destinations.length} dataMobileNavigation desktopBreakpoint="lg">
    {destinations.map(item => {
      const active = item.href === "/"
        ? ["/", "/services", "/offers"].includes(pathname)
        : item.href === "/post"
          ? pathname === "/post"
          : item.href === "/profile"
            ? ["/profile", "/settings", "/dashboard", "/purchases", "/viewings"].some(path => pathname === path || pathname.startsWith(path + "/")) || pathname === "/post/listings"
          : pathname === item.href || pathname.startsWith(item.href + "/");
      return <Link key={item.href} prefetch={false}
        href={item.href === "/" || isAuthenticated ? item.href : authPathForRedirect(item.href)}
        aria-current={active ? "page" : undefined}
        className={mobileTabClassName(active, item.href === "/post" ? "group" : undefined)}>
        <MobileTabContent active={active} icon={item.icon} label={item.label} prominent={item.href === "/post"} />
      </Link>;
    })}
  </MobileTabBar>;
}
