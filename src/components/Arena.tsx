import type { CSSProperties } from "react";
import { fill, pct, type Dictionary } from "@/i18n";
import type { ModelForecast } from "@/lib/data";
import { median } from "@/lib/scoring";

/**
 * Every model as a colored dot on one 0 to 100 track, with the median as a
 * line. Dots that would overlap move to a lane above or below. The legend
 * under the track names every dot, so color is never the only cue.
 */
export function Arena({ latest, t, legend = true }: { latest: ModelForecast[]; t: Dictionary; legend?: boolean }) {
  const sorted = [...latest].sort((a, b) => a.forecast.probability - b.forecast.probability);
  const ps = sorted.map((l) => l.forecast.probability);
  if (ps.length === 0) return null;
  const med = median(ps);

  // Greedy lanes: center first, then above, then below; 6 points apart within a lane.
  const laneEnds = [-1, -1, -1];
  const offsets = [0, -15, 15];
  const placed = sorted.map((l, i) => {
    const p = l.forecast.probability;
    let lane = laneEnds.findIndex((end) => end < 0 || p - end >= 0.06);
    if (lane < 0) lane = i % 3;
    laneEnds[lane] = p;
    return { l, lane, i };
  });

  const label = fill(t.ui.between, { low: pct(Math.min(...ps)), high: pct(Math.max(...ps)) });
  return (
    <div>
      <div className="arena" role="img" aria-label={`${label}. ${t.rail.median}: ${pct(med)}`}>
        <div className="arena-track" />
        <span className="arena-median" style={{ left: `${med * 100}%` }} />
        {placed.map(({ l, lane, i }) => (
          <span
            key={l.model.id}
            className="arena-dot"
            title={`${l.model.name}: ${pct(l.forecast.probability)}`}
            style={
              {
                left: `${l.forecast.probability * 100}%`,
                top: `calc(50% - 8px + ${offsets[lane]}px)`,
                "--dot": l.model.color,
                "--i": i,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <div className="bar-scale" aria-hidden="true">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
      {legend && (
        <div className="arena-legend" aria-hidden="true">
          {[...sorted].reverse().map((l) => (
            <span key={l.model.id}>
              <span className="dot" style={{ "--dot": l.model.color } as CSSProperties} />
              {l.model.name} {pct(l.forecast.probability)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
