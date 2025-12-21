import { AppLayout } from "@/components/Layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { PerformanceMetrics } from "@/components/Analytics/PerformanceMetrics";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { useConversations } from "@/hooks/useConversations";
import { workQueueApi, type WorkQueueItem } from "@/lib/backend-api";
import { useState, useEffect, useMemo } from "react";
import {
  calculateSDRLeaderboard,
  calculateLeadFunnel,
  calculateTrendsOverTime,
  calculateEmailsByDay,
  calculateConversionFunnel,
  calculateSDRPerformanceRadar,
} from "@/utils/analytics";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Brush,
  Legend,
} from "recharts";

export default function Analytics() {
  const { user, userRole } = useAuth();
  const { data: userProfile } = useProfile();
  const { data: teamMembers = [] } = useTeamMembers();
  const { data: pipelineStages = [] } = usePipelineStages();
  const { data: conversations = [] } = useConversations();
  
  const currentUserMember = teamMembers.find(m => m.id === user?.id);
  const userDisplayName = userProfile?.full_name || currentUserMember?.full_name || user?.email || "User";

  // Fetch work queue data
  const [workQueueItems, setWorkQueueItems] = useState<WorkQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [leadsOnly, setLeadsOnly] = useState(true);

  useEffect(() => {
    const fetchWorkQueueData = async () => {
      try {
        setLoading(true);
        const items = await workQueueApi.getWorkQueue('all');
        setWorkQueueItems(items);
      } catch (error) {
        console.error('Failed to fetch work queue data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkQueueData();
  }, []);

  // Filter data based on "Leads Only" toggle
  const filteredWorkQueueItems = useMemo(() => {
    if (!leadsOnly) return workQueueItems;
    return workQueueItems.filter(item => item.custom_stage_id !== null);
  }, [workQueueItems, leadsOnly]);

  const filteredConversations = useMemo(() => {
    if (!leadsOnly) return conversations;
    // Filter conversations that have a stage assigned (are leads)
    return conversations.filter(c => c.custom_stage_id !== null);
  }, [conversations, leadsOnly]);

  // Calculate all analytics data using memoization
  const sdrLeaderboardData = useMemo(
    () => calculateSDRLeaderboard(filteredWorkQueueItems, filteredConversations, teamMembers, userRole, user?.id),
    [filteredWorkQueueItems, filteredConversations, teamMembers, userRole, user?.id]
  );

  const leadFunnelData = useMemo(
    () => calculateLeadFunnel(filteredWorkQueueItems, pipelineStages),
    [filteredWorkQueueItems, pipelineStages]
  );

  const trendData = useMemo(
    () => calculateTrendsOverTime(filteredWorkQueueItems, filteredConversations),
    [filteredWorkQueueItems, filteredConversations]
  );

  const emailsByDay = useMemo(
    () => calculateEmailsByDay(filteredConversations, userRole, user?.id),
    [filteredConversations, userRole, user?.id]
  );

  const conversionFunnelData = useMemo(
    () => calculateConversionFunnel(filteredWorkQueueItems, pipelineStages),
    [filteredWorkQueueItems, pipelineStages]
  );

  const radarData = useMemo(
    () => calculateSDRPerformanceRadar(sdrLeaderboardData, userRole, user?.id),
    [sdrLeaderboardData, userRole, user?.id]
  );
  
  return (
    <AppLayout role={userRole} userName={userDisplayName}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Analytics & Performance</h1>
            <p className="text-xs text-muted-foreground mt-1">Performance metrics and insights</p>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={leadsOnly}
              onCheckedChange={setLeadsOnly}
            />
            <span className="text-sm text-muted-foreground">
              Leads only
            </span>
          </div>
        </div>

        <PerformanceMetrics 
          sdrLeaderboardData={sdrLeaderboardData}
          leadFunnelData={leadFunnelData}
          loading={loading}
        />

        <Card className="border shadow-sm">
          <CardHeader className="border-b">
            <CardTitle className="text-sm font-semibold">Trends Over Time</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {loading || trendData.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                <p className="text-sm">{loading ? 'Loading trends...' : 'No trend data available'}</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                />
                <YAxis 
                  yAxisId="left"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Legend 
                  wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                  iconType="line"
                />
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="leads" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Leads"
                />
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="conversions" 
                  stroke="hsl(var(--chart-2))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--chart-2))', r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Conversions"
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="engagement" 
                  stroke="hsl(var(--chart-3))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--chart-3))', r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Engagement %"
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="responseTime" 
                  stroke="hsl(var(--chart-4))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--chart-4))', r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Response Time (hrs)"
                />
                <Brush 
                  dataKey="date" 
                  height={30} 
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--muted))"
                  travellerWidth={10}
                />
              </LineChart>
            </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border shadow-sm">
            <CardHeader className="border-b">
              <CardTitle className="text-sm font-semibold">Emails Received (Last 7 Days)</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {loading || emailsByDay.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  <p className="text-sm">{loading ? 'Loading emails...' : 'No email data available'}</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={emailsByDay} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  />
                  <Bar 
                    dataKey="count" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="border shadow-sm">
            <CardHeader className="border-b">
              <CardTitle className="text-sm font-semibold">Conversion Funnel</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {loading || conversionFunnelData.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  <p className="text-sm">{loading ? 'Loading funnel...' : 'No funnel data available'}</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart 
                    data={conversionFunnelData} 
                  layout="vertical"
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis 
                    type="number" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  />
                  <YAxis 
                    dataKey="stage" 
                    type="category" 
                    width={90}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  />
                  <Bar 
                    dataKey="count" 
                    fill="hsl(var(--primary))"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-2 border shadow-sm">
            <CardHeader className="border-b">
              <CardTitle className="text-sm font-semibold">SDR Performance Comparison</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {loading || radarData.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  <p className="text-sm">{loading ? 'Loading performance data...' : 'No performance data available'}</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={400}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis 
                      dataKey="metric"
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    />
                    <PolarRadiusAxis 
                      angle={90} 
                      domain={[0, 100]}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    />
                    {sdrLeaderboardData.slice(0, 3).map((sdr, idx) => {
                      const firstName = sdr.name.split(' ')[0];
                      const colors = [
                        'hsl(var(--primary))',
                        'hsl(var(--chart-2))',
                        'hsl(var(--chart-3))',
                      ];
                      return (
                        <Radar
                          key={sdr.id}
                          name={firstName}
                          dataKey={firstName}
                          stroke={colors[idx]}
                          fill={colors[idx]}
                          fillOpacity={0.2}
                          strokeWidth={2}
                        />
                      );
                    })}
                    <Legend />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
