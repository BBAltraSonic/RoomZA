// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PropertyCard } from "@/components/premium/property-card";
import { OfferFeedCard } from "@/features/offers/offer-feed-card";
import { EntryFeedCard } from "@/features/entries/entry-feed-card";
import { ServiceFeedCard } from "@/features/services/service-feed-card";
import { ContactActions } from "./contact-actions";
import { ContactFields } from "./contact-fields";
import { propertyPublicContact, publicContactSchema, requirePublicContact, servicePublicContact } from "./schema";
import { offerContentSchema } from "@/features/offers/schema";
import { entryContentSchema } from "@/features/entries/schema";
import { evaluatePublishReadiness } from "@/features/listings/publish-validation";

afterEach(cleanup);
const contact = { phone: "+27215550100", whatsapp: "+27215550101", email: "help@example.com" };
describe("public guest contact", () => {
  it.each([{}, { phone:"0215550100" }, { whatsapp:"https://evil.test" }, { email:"x@example.com\r\nBcc:x@example.com" }, { phone:true }, { phone:"+27215550100", secret:"private" }])("rejects invalid or missing contact at publication: %j", value => {
    expect(() => requirePublicContact(value,true)).toThrow();
  });
  it("requires explicit consent and never reads account profile phone or email", () => {
    expect(() => requirePublicContact(contact,false)).toThrow(/permission/);
    expect(propertyPublicContact({ phone:contact.phone,email:contact.email })).toBeNull();
    expect(propertyPublicContact({ publicContact:contact,contactConsent:false })).toBeNull();
    expect(propertyPublicContact({ publicContact:contact,contactConsent:true })).toEqual(contact);
  });
  it("builds safe direct links with an encoded enquiry and no account", () => {
    render(<ContactActions contact={contact} title="Home & garden?" />);
    expect(screen.getByRole("link",{name:"Call"})).toHaveAttribute("href","tel:+27215550100");
    const whatsapp = new URL(screen.getByRole("link",{name:"WhatsApp"}).getAttribute("href")!);
    expect(whatsapp.origin).toBe("https://wa.me");
    expect(whatsapp.searchParams.get("text")).toContain("Home & garden?");
    expect(screen.getByRole("link",{name:"WhatsApp"})).toHaveAttribute("rel","noopener noreferrer");
    expect(screen.getByRole("link",{name:"Email"}).getAttribute("href")).toContain("mailto:help%40example.com?subject=");
  });
  it("shows a truthful legacy state and blocks contacts while availability is checking", () => {
    const { rerender }=render(<ContactActions title="Old listing" />);
    expect(screen.getByText("Contact details not provided")).toBeVisible();
    expect(screen.queryByRole("link")).toBeNull();
    rerender(<ContactActions title="Checking" contact={contact} disabled />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Call")).toHaveAttribute("aria-disabled","true");
  });
  it("invalidates publishing consent when a contact changes", () => {
    const change=vi.fn(),consent=vi.fn();
    render(<ContactFields value={contact} consent onChange={change} onConsentChange={consent} />);
    fireEvent.change(screen.getByLabelText("Public phone"),{target:{value:"+27215550102"}});
    expect(change).toHaveBeenCalledWith({...contact,phone:"+27215550102"});
    expect(consent).toHaveBeenCalledWith(false);
  });
  it("retains the existing public service phone without exposing unconsented additions", () => {
    expect(servicePublicContact({phone:"021 555 0100", publicContact:{email:contact.email},contactConsent:false})).toEqual({phone:contact.phone});
    expect(servicePublicContact({phone:"+27 21 555 0100", publicContact:{whatsapp:contact.whatsapp},contactConsent:true})).toEqual({phone:contact.phone,whatsapp:contact.whatsapp});
  });
  it("accepts old category content and the additive consented contact contract", () => {
    const base={title:"Demo",areaId:"00000000-0000-4000-8000-000000000001",address:"Demo",latitude:-33,longitude:18,startsAt:"2026-01-01T00:00:00Z",endsAt:"2099-01-01T00:00:00Z"};
    for(const schema of [offerContentSchema,entryContentSchema]) {
      const content={...base, ...(schema===offerContentSchema?{benefit:"Benefit",terms:"Terms",shopName:"Shop"}:{description:"Description",venueName:"Venue"})};
      expect(schema.safeParse(content).success).toBe(true);
      expect(schema.safeParse({...content,publicContact:contact,contactConsent:true}).success).toBe(true);
    }
    expect(publicContactSchema.parse({ email:contact.email })).toEqual({ email:contact.email });
  });
  it("adds a clear publication blocker for new Property and exempts legacy Property", () => {
    const old={guest_contact_exempt:true,metadata:{}};
    expect(evaluatePublishReadiness(old,3).fieldErrorsByField.guest_contact).toBeUndefined();
    expect(evaluatePublishReadiness({...old,guest_contact_exempt:false},3).fieldErrorsByField.guest_contact?.[0]).toMatch(/public/);
    expect(evaluatePublishReadiness({...old,guest_contact_exempt:false,metadata:{publicContact:contact,contactConsent:true}},3).fieldErrorsByField.guest_contact).toBeUndefined();
  });
});


it.each(["rent","sale","shopping","event","tourism","service"] as const)("offers consented guest contacts on the %s card", category => {
 const id="00000000-0000-4000-8000-000000000001", time="2026-10-09T00:00:00Z";
 const base={title:"Fixture",areaId:id,address:"Demo",latitude:-33,longitude:18,startsAt:time,endsAt:"2099-01-01T00:00:00Z",publicContact:contact,contactConsent:true};
 if(category==="rent"||category==="sale") render(<PropertyCard property={{id,title:base.title,price:6000,listingType:category,publicContact:contact}} />);
 else if(category==="shopping") render(<OfferFeedCard item={{offerId:id,revisionId:id,confirmedAt:time,areaId:id,status:"live",startsAt:time,endsAt:base.endsAt,content:{...base,benefit:"Benefit",terms:"Terms",shopName:"Shop"},place:{id,name:"Demo",region:"ZA",fullAddress:"Demo"},poster:null}} />);
 else if(category==="service") render(<ServiceFeedCard item={{id,area_id:id,approved_at:time,content:{...base,description:"Demo",providerName:"Demo",serviceType:"Plumbing",phone:contact.phone}}} />);
 else render(<EntryFeedCard item={{entryId:id,category,approvedAt:time,state:category==="event"?"upcoming":"live",content:{...base,description:"Demo",venueName:"Demo"}}} />);
 for(const name of ["WhatsApp","Call","Email"])expect(screen.getByRole("link",{name})).toBeVisible();
});
