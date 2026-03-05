"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatNumber, formatPercentage } from "@/lib/utils";

interface MetricsCardProps {
  title: string;
  metrics: Record<string, any>;
}

function num(v: any): number {
  return parseFloat(v) || 0;
}

function getConversions(metrics: Record<string, any>): number {
  if (metrics.conversions) return num(metrics.conversions);
  const actions = metrics.actions as any[] | undefined;
  if (!actions) return 0;
  const conv = actions.find(
    (a) => a.action_type === "offsite_conversion" || a.action_type === "lead" || a.action_type === "purchase"
  );
  return conv ? num(conv.value) : 0;
}

function getCPA(metrics: Record<string, any>): number {
  if (metrics.cpa) return num(metrics.cpa);
  const costs = metrics.cost_per_action_type as any[] | undefined;
  if (!costs) return 0;
  const conv = costs.find(
    (a) => a.action_type === "offsite_conversion" || a.action_type === "lead" || a.action_type === "purchase"
  );
  return conv ? num(conv.value) : 0;
}

export function MetricsCard({ title, metrics }: MetricsCardProps) {
  const items = [
    { label: "Gasto", value: formatCurrency(num(metrics.spend)) },
    { label: "Impresiones", value: formatNumber(num(metrics.impressions)) },
    { label: "Clicks", value: formatNumber(num(metrics.clicks)) },
    { label: "CTR", value: formatPercentage(num(metrics.ctr)) },
    { label: "CPC", value: formatCurrency(num(metrics.cpc)) },
    { label: "Frecuencia", value: num(metrics.frequency).toFixed(1) },
    { label: "Conversiones", value: formatNumber(getConversions(metrics)) },
    { label: "CPA", value: formatCurrency(getCPA(metrics)) },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-4">
          {items.map((item) => (
            <div key={item.label}>
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-sm font-semibold">{item.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
