import Link from "next/link";
import { ArrowUpRight, CalendarDays, Compass, Home, Store, Wrench } from "lucide-react";

const categories = [
  { name: "Property", icon: Home, description: "List a home to rent or buy.", create: "/dashboard/listings/new" },
  { name: "Services", icon: Wrench, description: "Offer your services to people nearby.", create: "/post/services" },
  { name: "Shopping Specials", icon: Store, description: "Share a current offer from your shop or business.", create: "/post/offers" },
  { name: "Places", icon: Compass, description: "Share a place or visitor experience.", create: "/post/entries/tourism" },
  { name: "Events", icon: CalendarDays, description: "List an event and its dates.", create: "/post/entries/event" },
] as const;

export function CategoryLinks() {
  return <nav aria-label="Listing categories">
    <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-panel)] border border-border bg-panel shadow-[var(--elevation-1)]">
      {categories.map(category => <li key={category.name}>
        <Link href={category.create} className="group flex min-h-24 items-center gap-4 px-4 py-5 outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-6">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-brand-ink"><category.icon className="size-5" aria-hidden="true" /></span>
          <span className="min-w-0 flex-1"><span className="block font-semibold text-ink">{category.name}</span>
            <span className="mt-1 block text-sm leading-5 text-muted-foreground">{category.description}</span>
          </span>
          <ArrowUpRight className="size-4 shrink-0 text-brand-ink transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden="true" />
        </Link>
      </li>)}
    </ul>
  </nav>;
}
