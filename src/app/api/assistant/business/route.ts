import { assistantBusiness } from "@/features/assistant/business/business-api";

export function POST(request: Request) {
  return assistantBusiness(request);
}
