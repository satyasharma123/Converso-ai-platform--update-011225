import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, TrendingUp, Clock, Target } from "lucide-react";

interface SDRMetrics {
  id: string;
  name: string;
  responseSpeed: number;
  conversionRate: number;
  positiveReplyRate: number;
  avgEngagement: number;
  totalLeads: number;
}

export function PerformanceMetrics() {
  const metrics: SDRMetrics[] = [
    {
      id: "1",
      name: "Jane SDR",
      responseSpeed: 95,
      conversionRate: 28,
      positiveReplyRate: 85,
      avgEngagement: 4.2,
      totalLeads: 45,
    },
    {
      id: "2",
      name: "John SDR",
      responseSpeed: 88,
      conversionRate: 25,
      positiveReplyRate: 78,
      avgEngagement: 3.8,
      totalLeads: 52,
    },
    {
      id: "3",
      name: "Mike Manager",
      responseSpeed: 82,
      conversionRate: 22,
      positiveReplyRate: 72,
      avgEngagement: 3.5,
      totalLeads: 38,
    },
  ];

  const funnelStages = [
    { stage: "New", count: 120, color: "bg-blue-500" },
    { stage: "Engaged", count: 85, color: "bg-purple-500" },
    { stage: "Qualified", count: 52, color: "bg-yellow-500" },
    { stage: "Converted", count: 28, color: "bg-green-500" },
    { stage: "Lost", count: 35, color: "bg-red-500" },
    { stage: "Irrelevant", count: 12, color: "bg-gray-500" },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="border shadow-sm">
        <CardHeader className="border-b">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-semibold">SDR Leaderboard</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-3">
            {metrics.map((sdr, idx) => (
              <div key={sdr.id} className="p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full font-semibold text-sm bg-muted text-foreground">
                      {idx + 1}
                    </div>
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="text-sm">{sdr.name.slice(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h4 className="font-medium">{sdr.name}</h4>
                      <p className="text-xs text-muted-foreground">{sdr.totalLeads} leads</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="flex items-center gap-1 justify-center mb-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-semibold">{sdr.responseSpeed}</p>
                      <p className="text-xs text-muted-foreground">Speed</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center gap-1 justify-center mb-1">
                        <Target className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-semibold">{sdr.conversionRate}%</p>
                      <p className="text-xs text-muted-foreground">Conv</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center gap-1 justify-center mb-1">
                        <TrendingUp className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-semibold">{sdr.positiveReplyRate}%</p>
                      <p className="text-xs text-muted-foreground">Reply</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold">{sdr.avgEngagement}</p>
                      <p className="text-xs text-muted-foreground">Engage</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border shadow-sm">
        <CardHeader className="border-b">
          <CardTitle className="text-lg font-semibold">Lead Funnel</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {funnelStages.map((stage) => {
              const maxCount = Math.max(...funnelStages.map((s) => s.count));
              const percentage = (stage.count / maxCount) * 100;
              
              return (
                <div key={stage.stage}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{stage.stage}</span>
                    <span className="text-sm text-muted-foreground">{stage.count} leads</span>
                  </div>
                  <div className="h-10 bg-muted rounded-lg overflow-hidden">
                    <div
                      className={`h-full ${stage.color} flex items-center px-3 text-white font-medium text-sm transition-all duration-300`}
                      style={{ width: `${percentage}%` }}
                    >
                      {percentage > 15 && `${stage.count}`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
