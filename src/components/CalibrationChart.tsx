import type { Dictionary } from "@/i18n";
import type { CalibrationBin } from "@/lib/scoring";

/**
 * Calibration: what the model said against what happened. One series, so no
 * legend; the diagonal is the reference for perfect calibration. Each point
 * has a hover title, and the same numbers are in the table beside the chart.
 */
export function CalibrationChart({ bins, color, t }: { bins: CalibrationBin[]; color: string; t: Dictionary }) {
  const size = 300;
  const pad = { l: 44, r: 12, t: 12, b: 40 };
  const w = size - pad.l - pad.r;
  const h = size - pad.t - pad.b;
  const x = (v: number) => pad.l + v * w;
  const y = (v: number) => pad.t + (1 - v) * h;
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const maxCount = Math.max(...bins.map((b) => b.count), 1);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width="100%"
      style={{ maxWidth: 360, direction: "ltr" }}
      role="img"
      aria-label={t.model.calibration}
    >
      {ticks.map((v) => (
        <g key={v}>
          <line x1={x(0)} x2={x(1)} y1={y(v)} y2={y(v)} stroke="#e3e7ee" strokeWidth="1" />
          <text x={x(0) - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#6b7689">
            {Math.round(v * 100)}%
          </text>
          <text x={x(v)} y={y(0) + 16} textAnchor="middle" fontSize="11" fill="#6b7689">
            {Math.round(v * 100)}%
          </text>
        </g>
      ))}
      <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke="#c9d0dc" strokeWidth="1.5" strokeDasharray="4 4" />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        points={bins.map((b) => `${x(b.meanForecast)},${y(b.observed)}`).join(" ")}
      />
      {bins.map((b) => (
        <circle
          key={b.from}
          cx={x(b.meanForecast)}
          cy={y(b.observed)}
          r={4 + 4 * Math.sqrt(b.count / maxCount)}
          fill={color}
          stroke="#fff"
          strokeWidth="2"
        >
          <title>
            {`${t.model.said} ${Math.round(b.meanForecast * 100)}%, ${t.model.happened} ${Math.round(b.observed * 100)}% (${b.count} ${t.model.cases})`}
          </title>
        </circle>
      ))}
      <text x={x(0.5)} y={size - 6} textAnchor="middle" fontSize="12" fill="#47526a">
        {t.model.said}
      </text>
      <text
        x={12}
        y={y(0.5)}
        textAnchor="middle"
        fontSize="12"
        fill="#47526a"
        transform={`rotate(-90 12 ${y(0.5)})`}
      >
        {t.model.happened}
      </text>
    </svg>
  );
}
