import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export function StatsCard({ title, value, icon: Icon, trend }: StatsCardProps) {
  return (
    <Card className="border shadow-sm hover:shadow-md transition-all duration-300">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="p-2 rounded-lg bg-primary/5">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="text-2xl font-bold">{value}</div>
        {trend && (
          <div className="flex items-center gap-1 text-xs">
            <span className={`font-medium ${
              trend.isPositive 
                ? "text-green-600 dark:text-green-500" 
                : "text-red-600 dark:text-red-500"
            }`}>
              {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
            </span>
            <span className="text-muted-foreground">vs last week</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
