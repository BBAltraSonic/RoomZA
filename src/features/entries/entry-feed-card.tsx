"use client";
import { ContactActions } from "@/features/guest-contact/contact-actions";
import { readPublicContact } from "@/features/guest-contact/schema";
import { SpecialCard, type SpecialCardProps } from "@/features/discovery/special-card";
import type { PublicEntry } from "./public-contract";
export function EntryFeedCard({ item, ...props }: SpecialCardProps & { item: PublicEntry }) {
  const contact = readPublicContact(item.content.publicContact, item.content.contactConsent);
  return <SpecialCard {...props} special={{ id: item.entryId, category: item.category, title: item.content.title, identity: item.content.venueName, address: item.content.address, href: "/specials/" + item.entryId, description: item.content.description, startsAt: item.content.startsAt, endsAt: item.content.endsAt, priceCents: item.content.priceCents, originalPriceCents: item.content.originalPriceCents, bannerUrl: item.media?.[0]?.url, savedCount: item.savedCount, upcoming: item.state === "upcoming" }} contactActions={contact ? <ContactActions contact={contact} title={item.content.title} /> : undefined} />;
}
