"use client";

import dynamic from "next/dynamic";

import type { ShowingRequest } from "./actions";

const ShowingRequestBanner = dynamic(
  () => import("./showing-request-banner").then((module) => module.ShowingRequestBanner),
  { ssr: false },
);

export function ShowingRequestBannerLoader({
  landlordId,
  initialRequest,
}: {
  landlordId: string;
  initialRequest: ShowingRequest | null;
}) {
  return <ShowingRequestBanner landlordId={landlordId} initialRequest={initialRequest} />;
}
