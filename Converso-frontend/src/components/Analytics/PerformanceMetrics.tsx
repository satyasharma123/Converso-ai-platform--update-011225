import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, TrendingUp, Clock, Target } from "lucide-react";
import type { SDRLeaderboardRow, FunnelStage } from "@/utils/analytics";

interface PerformanceMetricsProps {
  sdrLeaderboardData: SDRLeaderboardRow[];
  leadFunnelData: FunnelStage[];
  loading: boolean;
}

export function PerformanceMetrics({ sdrLeaderboardData, leadFunnelData, loading }: PerformanceMetricsProps) {
  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border shadow-sm">
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground py-12">
              <p className="text-sm">Loading analytics...</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground py-12">
              <p className="text-sm">Loading funnel...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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
          {sdrLeaderboardData.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p className="text-sm">No SDR data available</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sdrLeaderboardData.map((sdr, idx) => (
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
                      <p className="text-xs text-muted-foreground">{sdr.leadsAssigned} leads</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="flex items-center gap-1 justify-center mb-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-semibold">{sdr.avgResponseSpeed || '--'}</p>
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
                      <p className="text-sm font-semibold">{sdr.replyRate}%</p>
                      <p className="text-xs text-muted-foreground">Reply</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold">{sdr.engagementScore}</p>
                      <p className="text-xs text-muted-foreground">Engage</p>
                    </div>
                  </div>
                </div>
              </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border shadow-sm">
        <CardHeader className="border-b">
          <CardTitle className="text-lg font-semibold">Lead Funnel</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {leadFunnelData.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p className="text-sm">No funnel data available</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[260px] overflow-y-auto pr-2">
              {leadFunnelData.map((stage) => {
                const maxCount = Math.max(...leadFunnelData.map((s) => s.count));
                const percentage = maxCount > 0 ? (stage.count / maxCount) * 100 : 0;
              
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
