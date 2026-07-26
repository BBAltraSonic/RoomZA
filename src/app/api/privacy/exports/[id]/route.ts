import { downloadPrivacyExport } from "@/features/trust/privacy-export-route";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return downloadPrivacyExport(request, (await params).id);
}
