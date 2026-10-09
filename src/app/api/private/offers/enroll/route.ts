import { handleOfferWorkspaceWrite } from "@/features/offers/workspace-api";

export const POST = (request: Request) => handleOfferWorkspaceWrite(request, true);
