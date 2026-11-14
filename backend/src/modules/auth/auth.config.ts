const DURATION_UNITS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 24 * 60 * 60,
};

/** Parse a bounded integer duration such as 15m or 7d into seconds. */
export function durationToSeconds(
  value: string | undefined,
  fallbackSeconds: number,
  maximumSeconds: number,
): number {
  if (!value) return fallbackSeconds;
  const match = /^(\d{1,6})(s|m|h|d)$/i.exec(value.trim());
  if (!match) {
    throw new Error(
      "Invalid token duration. Use an integer followed by s, m, h, or d.",
    );
  }
  const amount = Number(match[1]);
  const seconds = amount * DURATION_UNITS[match[2].toLowerCase()];
  if (
    !Number.isSafeInteger(seconds) ||
    seconds < 1 ||
    seconds > maximumSeconds
  ) {
    throw new Error(
      `Token duration must be between 1 and ${maximumSeconds} seconds.`,
    );
  }
  return seconds;
}
