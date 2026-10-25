import { ContactActions } from "@/features/guest-contact/contact-actions";
import { readPublicContact } from "@/features/guest-contact/schema";
import { SpecialCard, type SpecialCardProps } from "@/features/discovery/special-card";
import type { PublicLiveOffer } from "./public-contract";
export function OfferFeedCard({ item, ...props }: SpecialCardProps & { item: PublicLiveOffer }) {
  const contact = readPublicContact(item.content.publicContact, item.content.contactConsent);
  return <SpecialCard {...props} special={{ id: item.offerId, category: "shopping", title: item.content.title, identity: item.content.shopName, address: item.content.address, href: "/offers/" + item.offerId, description: item.content.benefit, startsAt: item.startsAt, endsAt: item.endsAt, priceCents: item.content.priceCents, originalPriceCents: item.content.originalPriceCents, bannerUrl: item.media?.[0]?.url, savedCount: item.savedCount }} contactActions={contact ? <ContactActions contact={contact} title={item.content.title} /> : undefined} />;
}
