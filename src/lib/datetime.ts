// Canadian timezone helpers. The business operates in Canada (America/Toronto),
// so all user-facing date/times must be formatted in that zone regardless of
// the viewer's locale.
export const CA_TZ = "America/Toronto";

export function formatCA(input: string | number | Date | null | undefined): string {
  if (!input) return "";
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-CA", {
    timeZone: CA_TZ,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}
