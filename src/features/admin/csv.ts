export function csvCell(value: unknown) {
  const raw = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  const normalized = raw.replace(/[\r\n]+/g, " ");
  const text = /^[=+\-@\t]/.test(normalized) ? `'${normalized}` : normalized;
  return `"${text.replaceAll('"', '""')}"`;
}

export function toCsv(headers: string[], rows: unknown[][]) {
  return [headers.map(csvCell).join(","), ...rows.map((row) => row.map(csvCell).join(","))].join("\r\n");
}
