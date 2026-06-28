import type { TrendPoint } from "@/features/dashboard/metrics";

/** 登録月別推移（自作SVGのエリア＋ライン）。ラインだけブランドアクセントを使用。 */
export function RegistrationTrend({ points }: { points: TrendPoint[] }) {
  const W = 720;
  const H = 220;
  const padL = 36;
  const padR = 12;
  const padT = 16;
  const padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const max = Math.max(1, ...points.map((p) => p.count));
  const niceMax = Math.ceil((max * 1.15) / 5) * 5 || 5;
  const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;
  const x = (i: number) => padL + stepX * i;
  const y = (v: number) => padT + innerH - (v / niceMax) * innerH;

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(p.count).toFixed(1)}`)
    .join(" ");
  const areaPath =
    points.length > 0
      ? `${linePath} L ${x(points.length - 1).toFixed(1)} ${(padT + innerH).toFixed(1)} L ${x(0).toFixed(1)} ${(padT + innerH).toFixed(1)} Z`
      : "";

  const gridYs = [0, 0.5, 1].map((t) => ({ v: Math.round(niceMax * t), yy: y(niceMax * t) }));
  const labelEvery = points.length > 8 ? 2 : 1;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="登録月別推移">
      <defs>
        <linearGradient id="lcTrendLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#f58529" />
          <stop offset="35%" stopColor="#dd2a7b" />
          <stop offset="70%" stopColor="#8134af" />
          <stop offset="100%" stopColor="#515bd4" />
        </linearGradient>
        <linearGradient id="lcTrendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dd2a7b" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#dd2a7b" stopOpacity="0" />
        </linearGradient>
      </defs>

      {gridYs.map((g, i) => (
        <g key={i}>
          <line x1={padL} y1={g.yy} x2={W - padR} y2={g.yy} stroke="#eef0f3" strokeWidth="1" />
          <text x={padL - 8} y={g.yy + 3} textAnchor="end" fontSize="10" fill="#9ca3af">
            {g.v}
          </text>
        </g>
      ))}

      {areaPath && <path d={areaPath} fill="url(#lcTrendFill)" />}
      {linePath && (
        <path
          d={linePath}
          fill="none"
          stroke="url(#lcTrendLine)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      {points.map((p, i) => (
        <circle
          key={`d${i}`}
          cx={x(i)}
          cy={y(p.count)}
          r="2.5"
          fill="#ffffff"
          stroke="#dd2a7b"
          strokeWidth="1.5"
        />
      ))}

      {points.map((p, i) =>
        i % labelEvery === 0 ? (
          <text key={`l${i}`} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="#9ca3af">
            {p.label}
          </text>
        ) : null
      )}
    </svg>
  );
}
