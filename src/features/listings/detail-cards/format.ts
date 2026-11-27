export function formatListingDate(date: string) {
  const parsed = new Date(date);
  if (!Number.isFinite(parsed.getTime())) return "Not specified";
  return parsed.toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
