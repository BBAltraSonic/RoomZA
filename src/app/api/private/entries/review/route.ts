import { handleEntryPublicationWrite } from "@/features/entries/publication-api";
export const POST=(request:Request)=>handleEntryPublicationWrite(request,true);
