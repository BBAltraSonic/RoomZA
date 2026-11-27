import Link from "next/link";
import { ArrowUpRight, CalendarDays, Compass, Home, Store } from "lucide-react";

const categories = [
  { name: "Property", icon: Home, description: "List a home to rent or buy.", create: "/dashboard/listings/new" },
  { name: "Shopping Specials", icon: Store, description: "Share a current offer from your shop or business.", create: "/post/offers" },
  { name: "Places", icon: Compass, description: "Share a place or visitor experience.", create: "/post/entries/tourism" },
  { name: "Events", icon: CalendarDays, description: "List an event and its dates.", create: "/post/entries/event" },
] as const;

export function CategoryLinks() {
  return <nav aria-label="Listing categories">
    <ul className="grid grid-cols-2 gap-3 sm:gap-4">
      {categories.map((category, index) => {
        // An odd tile out at the end fills the whole row instead of leaving a gap.
        const fullRow = index === categories.length - 1 && categories.length % 2 === 1;
        return <li key={category.name} className={fullRow ? "col-span-2" : undefined}>
          <Link href={category.create} className={`group relative flex h-full rounded-[var(--radius-panel)] border border-border bg-panel p-4 shadow-[var(--elevation-1)] outline-none transition-[background-color,border-color,transform] hover:border-brand-ink/40 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] motion-reduce:transform-none sm:p-5 ${fullRow ? "items-center gap-4" : "min-h-40 flex-col"}`}>
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-brand-ink"><category.icon className="size-6" aria-hidden="true" /></span>
            <span className={`min-w-0 ${fullRow ? "flex-1" : "mt-4"}`}>
              <span className="block font-semibold leading-5 text-ink">{category.name}</span>
              <span className="mt-1 block text-sm leading-5 text-muted-foreground">{category.description}</span>
            </span>
            <ArrowUpRight className={`size-4 shrink-0 text-brand-ink transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transform-none ${fullRow ? "" : "absolute right-4 top-4"}`} aria-hidden="true" />
          </Link>
        </li>;
      })}
    </ul>
  </nav>;
}
