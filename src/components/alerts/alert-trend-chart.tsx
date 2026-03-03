"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface AlertTrendChartProps {
  data: { date: string; critical: number; high: number; medium: number }[];
}

export function AlertTrendChart({ data }: AlertTrendChartProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Alerts (Last 7 Days)</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 || data.every((d) => d.critical + d.high + d.medium === 0) ? (
          <p className="text-sm text-muted-foreground text-center py-8">No alert data for this period</p>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={30} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="critical" stackId="a" fill="#ef4444" name="Critical" />
              <Bar dataKey="high" stackId="a" fill="#f97316" name="High" />
              <Bar dataKey="medium" stackId="a" fill="#eab308" name="Medium" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
