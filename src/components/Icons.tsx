/** Three small pictures for the "how it works" steps. */
// currentColor, so each step can paint its icon in its own tone.
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function AskIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
      <path {...stroke} d="M5 7.5A3.500 3.500 0 0 1 8.500 4h13A3.500 3.500 0 0 1 25 7.500v9a3.500 3.500 0 0 1-3.500 3.500H14l-5.500 5v-5A3.500 3.500 0 0 1 5 16.500z" />
      <path {...stroke} d="M12.300 9.800a2.800 2.800 0 1 1 3.900 2.600c-.8.4-1.200.9-1.200 1.800" />
      <circle cx="15" cy="16.600" r="1.200" fill="currentColor" />
    </svg>
  );
}

export function ForecastIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
      <path {...stroke} d="M5 8h20M5 15h20M5 22h20" opacity="0.35" />
      <path {...stroke} strokeWidth="4.400" d="M5 8h14M5 15h8M5 22h17" />
    </svg>
  );
}

export function DecideIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
      <circle {...stroke} cx="15" cy="15" r="10.500" />
      <path {...stroke} strokeWidth="2.600" d="M10.200 15.300l3.300 3.300 6.300-6.600" />
    </svg>
  );
}
