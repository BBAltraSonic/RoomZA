import { forgetAccountMemory, readAccountMemory, writeAccountMemory } from "@/features/assistant/memory-api";

export function GET(request: Request) {
  return readAccountMemory(request);
}

export function PUT(request: Request) {
  return writeAccountMemory(request);
}

export function DELETE(request: Request) {
  return forgetAccountMemory(request);
}
