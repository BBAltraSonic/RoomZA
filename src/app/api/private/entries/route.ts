import { handleEntryWorkspaceWrite } from "@/features/entries/workspace-api";

export const POST = (request: Request) => handleEntryWorkspaceWrite(request);
