export type AdminStatusTone = "success" | "warning" | "forest";

export function transparencySnapshotTone(status: string): AdminStatusTone {
  return status === "published" ? "success" : "warning";
}

export function trustVersionTone(status: string | null | undefined): AdminStatusTone {
  if (status === "published") return "success";
  if (status === "approved") return "forest";
  return "warning";
}
