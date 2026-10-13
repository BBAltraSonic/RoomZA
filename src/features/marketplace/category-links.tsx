import Link from "next/link";
import { CalendarDays, Compass, Home, Store, Wrench } from "lucide-react";

const categories = [
  { name: "Property", icon: Home, description: "List a home to rent or buy.", create: "/dashboard/listings/new", manage: "/dashboard" },
  { name: "Services", icon: Wrench, description: "Offer your services to people nearby.", create: "/post/services", manage: "/post/services" },
  { name: "Shopping Specials", icon: Store, description: "Share a current offer from your shop or business.", create: "/post/offers", manage: "/post/offers" },
  { name: "Places", icon: Compass, description: "Share a place or visitor experience.", create: "/post/entries/tourism", manage: "/post/entries/tourism" },
  { name: "Events", icon: CalendarDays, description: "List an event and its dates.", create: "/post/entries/event", manage: "/post/entries/event" },
] as const;

export function CategoryLinks({ intent }: { intent: "create" | "manage" }) {
  return <nav aria-label={intent === "create" ? "Listing categories" : "Your listing categories"}>
    <ul className="divide-y divide-border border-y border-border">
      {categories.map(category => <li key={category.name}>
        <Link href={category[intent]} className="flex min-h-20 flex-col justify-center gap-1 rounded-lg px-3 py-4 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
          <span className="inline-flex items-center gap-2 font-semibold text-ink"><category.icon className="size-4 text-clay" aria-hidden="true" />{category.name}</span>
          <span className="text-sm text-muted-foreground">{intent === "create" ? category.description : "View and manage your " + category.name.toLowerCase() + " listings."}</span>
        </Link>
      </li>)}
    </ul>
  </nav>;
}
