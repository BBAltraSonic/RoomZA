import type { ReactNode } from "react";

import { LandlordShowingInbox } from "@/features/showings/landlord-showing-inbox";

/** Every /post workspace (My listings, entries, offers, services) hears incoming showing requests. */
export default function PostLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <LandlordShowingInbox />
      {children}
    </>
  );
}
