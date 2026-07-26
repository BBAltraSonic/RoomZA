export type LiveTourScheduleFormat = "compact" | "medium" | "full";

export function formatLiveTourSchedule(
  value: string,
  format: LiveTourScheduleFormat = "medium",
  timeZone?: string,
) {
  const options: Intl.DateTimeFormatOptions = format === "compact"
    ? {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }
    : {
        dateStyle: format === "full" ? "full" : "medium",
        timeStyle: "short",
      };
  return new Intl.DateTimeFormat("en-ZA", {
    ...options,
    timeZone,
  }).format(new Date(value));
}
