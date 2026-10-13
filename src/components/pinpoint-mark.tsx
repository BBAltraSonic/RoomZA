/** The rounded P-shaped location mark shared by the wordmark and app icons. */
export function PinpointMark({
  foreground = "currentColor",
  accent = "var(--mark-accent, #52774b)",
}: {
  foreground?: string;
  accent?: string;
}) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">
      <path
        fill={foreground}
        d="M32 3C19.85 3 10 12.85 10 25c0 6.54 2.77 12.37 7.14 16.97.33.35.86.12.86-.36V25c0-7.73 6.27-14 14-14s14 6.27 14 14-6.27 14-14 14c-2.12 0-4.13-.47-5.93-1.32-.5-.24-1.07.12-1.07.67v11.46c0 1.13.34 2.23.98 3.15l3.55 5.12c1.2 1.73 3.75 1.73 4.95 0L50.1 35.65A21.88 21.88 0 0 0 54 25C54 12.85 44.15 3 32 3Z"
      />
      <path fill={accent} d="M31 47c8 .36 14.77-4.79 19.1-11.35L34.48 58.08c-.85 1.23-2.38 1.59-3.48 1.05V47Z" />
      <circle cx="32" cy="25" r="6.75" fill={accent} />
    </svg>
  );
}
