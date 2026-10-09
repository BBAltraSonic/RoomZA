import { handlePublicOfferDetail } from "@/features/offers/public-api";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return handlePublicOfferDetail(request, (await context.params).id);
}
