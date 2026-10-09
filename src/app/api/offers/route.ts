import { handlePublicOfferFeed } from "@/features/offers/public-api";
export async function GET(request: Request) { return handlePublicOfferFeed(request); }
