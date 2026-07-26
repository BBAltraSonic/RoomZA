import {
  deleteFavorite,
  getFavorites,
  saveFavorite,
} from "@/features/favorites/api";

export function GET(request: Request) {
  return getFavorites(request);
}

export function POST(request: Request) {
  return saveFavorite(request);
}

export function DELETE(request: Request) {
  return deleteFavorite(request);
}
