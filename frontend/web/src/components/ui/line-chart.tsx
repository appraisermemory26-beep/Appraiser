"use client";

interface LineChartProps {
  points: number[];
  stroke?: string;
  fill?: string;
  height?: number;
}

export function LineChart({
  points,
  stroke = "var(--accent)",
  fill = "rgba(74, 222, 128, 0.12)",
  height = 120,
}: LineChartProps) {
  const safe = points.length > 1 ? points : [0, points[0] ?? 0];
  const width = 320;
  const max = Math.max(...safe, 1);
  const min = Math.min(...safe, 0);
  const range = Math.max(max - min, 1);

  const coords = safe.map((v, i) => {
    const x = (i / (safe.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 12) - 6;
    return { x, y };
  });

  const line = coords.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `${line} ${width},${height} 0,${height}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
      <polyline fill={fill} stroke="none" points={area} />
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={line}
      />
      {coords.map((p, idx) => (
        <circle key={idx} cx={p.x} cy={p.y} r="3.5" fill={stroke} />
      ))}
    </svg>
  );
}
