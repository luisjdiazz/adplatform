"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatNumber, formatPercentage } from "@/lib/utils";

interface MetricsCardProps {
  title: string;
  metrics: {
    spend?: number;
    impressions?: number;
    clicks?: number;
    ctr?: number;
    cpc?: number;
    conversions?: number;
    cpa?: number;
    roas?: number;
  };
}

export function MetricsCard({ title, metrics }: MetricsCardProps) {
  const items = [
    { label: "Gasto", value: formatCurrency(metrics.spend || 0) },
    { label: "Impresiones", value: formatNumber(metrics.impressions || 0) },
    { label: "Clicks", value: formatNumber(metrics.clicks || 0) },
    { label: "CTR", value: formatPercentage(metrics.ctr || 0) },
    { label: "CPC", value: formatCurrency(metrics.cpc || 0) },
    { label: "Conversiones", value: formatNumber(metrics.conversions || 0) },
    { label: "CPA", value: formatCurrency(metrics.cpa || 0) },
    { label: "ROAS", value: `${(metrics.roas || 0).toFixed(1)}x` },
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
