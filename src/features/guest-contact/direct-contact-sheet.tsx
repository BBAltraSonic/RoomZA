import { Mail, MessageCircle, MessageSquare, Phone } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { directContactLinks, type DirectContactChannel, type DirectContactLink } from "./contact-actions";
import type { PublicContact } from "./schema";

const ICONS: Record<DirectContactChannel, ReactNode> = {
  whatsapp: <MessageCircle className="size-4 shrink-0 text-forest" aria-hidden="true" />,
  phone: <Phone className="size-4 shrink-0 text-forest" aria-hidden="true" />,
  email: <Mail className="size-4 shrink-0 text-forest" aria-hidden="true" />,
};

const triggerClassName = "h-11 w-full min-w-0 rounded-lg px-2 text-sm font-semibold";
const rowClassName = "flex min-h-12 w-full items-center gap-3 rounded-xl border border-border bg-panel px-3 text-left text-sm font-semibold text-ink transition-colors hover:bg-warm-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function linkProps(link: DirectContactLink) {
  return { href: link.href, target: link.external ? "_blank" : undefined, rel: link.external ? "noopener noreferrer" : undefined };
}

export type DirectContactSheetProps = {
  contact?: PublicContact | null;
  /** What the enquiry is about, used for the prefilled message. */
  title: string;
  /** Who is being contacted: the provider or venue. */
  name: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Contact for listers who publish their own channels (specials). Like the property
 * Contact sheet it is one button: it opens the channels fastest-reply first, and skips the sheet
 * when there is only one.
 */
export function DirectContactSheet({ contact, title, name, disabled = false, className }: DirectContactSheetProps) {
  const links = directContactLinks(contact, title);
  if (!links.length) return <p className={cn("flex min-h-11 items-center text-xs text-muted-foreground", className)}>Contact details not provided</p>;
  if (links.length === 1) {
    const [link] = links as [DirectContactLink];
    const label = link.channel === "phone" ? `Call ${name}` : link.channel === "email" ? `Email ${name}` : `WhatsApp ${name}`;
    if (disabled) return <Button type="button" variant="outline" disabled className={cn(triggerClassName, className)}>{ICONS[link.channel]}<span className="truncate">{label}</span></Button>;
    return <Button render={<a {...linkProps(link)} />} variant="outline" data-emphasis="secondary" className={cn(triggerClassName, className)}>
      {ICONS[link.channel]}<span className="truncate">{label}</span>
    </Button>;
  }
  return <Dialog>
    <DialogTrigger disabled={disabled} render={<Button type="button" variant="outline" data-emphasis="secondary" className={cn(triggerClassName, className)} />}>
      <MessageSquare className="size-4" aria-hidden="true" />
      <span>Contact</span>
    </DialogTrigger>
    <DialogContent className="gap-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-md sm:pb-4">
      <div className="pr-8">
        <DialogTitle className="text-base font-semibold text-ink">Contact {name}</DialogTitle>
        <DialogDescription className="mt-1 text-xs leading-5">{title}</DialogDescription>
      </div>
      <div className="grid gap-2">
        {links.map((link, index) => <a key={link.channel} {...linkProps(link)} className={rowClassName}>
          {ICONS[link.channel]}
          <span className="min-w-0 flex-1">
            <span className="block">{link.label}</span>
            <span className="block truncate text-xs font-normal text-muted-foreground">{link.value}</span>
          </span>
          {index === 0 && link.channel === "whatsapp" ? <span className="rounded-full bg-accent px-2 py-0.5 text-[0.6875rem] font-semibold text-brand-ink">Fastest reply</span> : null}
        </a>)}
      </div>
      <p className="text-xs leading-5 text-muted-foreground">These details are published by the lister. Pinpoint does not see these conversations.</p>
    </DialogContent>
  </Dialog>;
}

