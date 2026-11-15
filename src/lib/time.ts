/** Request time. Server components read the clock through this helper. */
export function now(): Date {
  return new Date();
}

export const DAY_MS = 24 * 60 * 60 * 1000;
