import { assistantSearch } from "@/features/assistant/search-api";

export function POST(request: Request) {
  return assistantSearch(request);
}
