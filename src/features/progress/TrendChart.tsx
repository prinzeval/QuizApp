import "@mantine/charts/styles.css";
import { AreaChart } from "@mantine/charts";
import type { TrendPoint } from "./progressUtils.ts";

/** Weekly accuracy, one series (so no legend: the card title names it). */
export default function TrendChart({ points }: { points: TrendPoint[] }) {
  return (
    <AreaChart
      h={220}
      data={points}
      dataKey="week"
      series={[{ name: "accuracy", label: "Accuracy", color: "clay.6" }]}
      curveType="monotone"
      connectNulls
      withDots
      dotProps={{ r: 4, strokeWidth: 2 }}
      activeDotProps={{ r: 5, strokeWidth: 2 }}
      strokeWidth={2}
      fillOpacity={0.18}
      yAxisProps={{ domain: [0, 100], ticks: [0, 50, 100], width: 44 }}
      xAxisProps={{ interval: "preserveStartEnd", minTickGap: 16, padding: { left: 12, right: 12 } }}
      gridAxis="x"
      strokeDasharray="3 3"
      tooltipAnimationDuration={120}
      valueFormatter={value => `${value}%`}
      aria-label="Weekly accuracy chart"
    />
  );
}
