import { handlePublicOfferDirections } from "@/features/offers/public-api";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return handlePublicOfferDirections(request, (await context.params).id);
}
