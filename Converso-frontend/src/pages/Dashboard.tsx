import { AppLayout } from "@/components/Layout/AppLayout";
import { StatsCard } from "@/components/Dashboard/StatsCard";
import { Mail, Linkedin, Users, CheckCircle, Clock, TrendingUp, AlertCircle, MessageSquare, ListTodo } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState, useEffect } from "react";
import { workQueueApi, type WorkQueueItem } from "@/lib/backend-api";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import type { Conversation } from "@/hooks/useConversations";
import { LeadDetailsModal } from "@/components/Pipeline/LeadDetailsModal";

export default function Dashboard() {
  const { user, userRole } = useAuth();
  const { data: userProfile } = useProfile();
  const { data: teamMembers = [] } = useTeamMembers();
  const navigate = useNavigate();
  
  const currentUserMember = teamMembers.find(m => m.id === user?.id);
  const userDisplayName = userProfile?.full_name || currentUserMember?.full_name || user?.email || "User";

  // Fetch work queue data for KPI cards
  const [workQueueItems, setWorkQueueItems] = useState<WorkQueueItem[]>([]);
  const [loadingKPIs, setLoadingKPIs] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Conversation | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showLeadsOnly, setShowLeadsOnly] = useState(true); // Default: Leads only ON

  useEffect(() => {
    const fetchWorkQueueData = async () => {
      try {
        setLoadingKPIs(true);
        const items = await workQueueApi.getWorkQueue('all');
        setWorkQueueItems(items);
      } catch (error) {
        console.error('Failed to fetch work queue data:', error);
      } finally {
        setLoadingKPIs(false);
      }
    };

    fetchWorkQueueData();
  }, []);

  // Single filtered source for all dashboard sections
  const dashboardItems = showLeadsOnly
    ? workQueueItems.filter(item => item.custom_stage_id !== null)
    : workQueueItems;

  // Calculate KPI metrics from dashboard items
  const pendingRepliesCount = dashboardItems.filter(i => i.pending_reply).length;
  const overdueLeadsCount = dashboardItems.filter(i => i.overdue).length;
  const idleLeadsCount = dashboardItems.filter(
    i => i.idle_days > 0 && !i.pending_reply && !i.overdue
  ).length;
  const totalLeadsInPipeline = dashboardItems.length;

  // Filter work items for "My Work Today" section
  const myWorkToday = dashboardItems
    .filter(item => {
      if (!item.pending_reply && !item.overdue) return false;
      if (userRole === 'sdr' && item.assigned_sdr_id !== user?.id) return false;
      return true;
    })
    .slice(0, 8);

  // SDR Leaderboard logic
  const sdrUsers = userRole === 'sdr'
    ? teamMembers.filter(m => m.id === user?.id)
    : teamMembers.filter(m => m.role === 'sdr');

  const sdrLeaderboardData = sdrUsers.map((sdr) => {
    const assignedLeads = workQueueItems.filter(item =>
      item.assigned_sdr_id === sdr.id &&
      item.custom_stage_id !== null
    );

    const fresh = assignedLeads.filter(item => (item.idle_days ?? 0) <= 2).length;
    const warm = assignedLeads.filter(item => (item.idle_days ?? 0) >= 3 && (item.idle_days ?? 0) <= 7).length;
    const stale = assignedLeads.filter(item => (item.idle_days ?? 0) >= 8).length;

    const overdue = assignedLeads.filter(item => item.overdue).length;

    return {
      id: sdr.id,
      name: sdr.full_name,
      leadsAssigned: assignedLeads.length,
      fresh,
      warm,
      stale,
      overdue
    };
  });

  // Recent Activity normalization logic
  const recentActivity = workQueueItems
    .flatMap((item) => {
      const events = [];

      // 1. Lead assigned (using stage_assigned_at as proxy for assignment timestamp)
      if (item.assigned_sdr_id && item.stage_assigned_at) {
        events.push({
          type: "assigned",
          title: `Lead assigned`,
          description: `${item.sender_name}`,
          timestamp: item.stage_assigned_at,
          sdrId: item.assigned_sdr_id,
          conversationId: item.conversation_id,
        });
      }

      // 2. Stage changed / added to pipeline
      if (item.custom_stage_id && item.stage_assigned_at) {
        events.push({
          type: "stage",
          title: `Lead moved to stage`,
          description: `${item.sender_name}`,
          timestamp: item.stage_assigned_at,
          sdrId: item.assigned_sdr_id,
          conversationId: item.conversation_id,
        });
      }

      // 3. Became overdue (using last_message_at as proxy since we don't have overdue_at)
      if (item.overdue && item.last_message_at) {
        events.push({
          type: "overdue",
          title: `Lead became overdue`,
          description: `${item.sender_name}`,
          timestamp: item.last_message_at,
          sdrId: item.assigned_sdr_id,
          conversationId: item.conversation_id,
        });
      }

      return events;
    })
    .filter((event) => {
      // SDR sees only their activity
      if (userRole === "sdr") {
        return event.sdrId === user?.id;
      }
      return true;
    })
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() -
        new Date(a.timestamp).getTime()
    )
    .slice(0, 6);
  
  return (
    <AppLayout role={userRole} userName={userDisplayName}>
      <div className="flex flex-col h-[calc(100vh-56px)] min-h-0">
        {/* Sticky Header */}
        <div className="sticky top-0 z-20 bg-background border-b pb-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Dashboard
              </h1>
              <p className="text-muted-foreground mt-1">Real-time overview of your SDR operations</p>
            </div>
            
            {/* Leads Only Toggle */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Leads only</span>
              <Switch
                checked={showLeadsOnly}
                onCheckedChange={setShowLeadsOnly}
              />
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="space-y-6">
            {/* KPI Cards - Work Queue Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card 
            className="border shadow-sm cursor-pointer transition-colors hover:bg-muted/50"
            onClick={() => navigate('/work-queue?filter=pending')}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Pending Replies</p>
                  <p className="text-xl font-medium mt-2">
                    {loadingKPIs ? (
                      <span className="text-muted-foreground animate-pulse">--</span>
                    ) : (
                      pendingRepliesCount
                    )}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="border shadow-sm cursor-pointer transition-colors hover:bg-muted/50"
            onClick={() => navigate('/work-queue?filter=overdue')}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Overdue Leads</p>
                  <p className="text-xl font-medium mt-2">
                    {loadingKPIs ? (
                      <span className="text-muted-foreground animate-pulse">--</span>
                    ) : (
                      overdueLeadsCount
                    )}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-red-500/10">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="border shadow-sm cursor-pointer transition-colors hover:bg-muted/50"
            onClick={() => navigate('/work-queue?filter=idle')}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Idle Leads</p>
                  <p className="text-xl font-medium mt-2">
                    {loadingKPIs ? (
                      <span className="text-muted-foreground animate-pulse">--</span>
                    ) : (
                      idleLeadsCount
                    )}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <Clock className="h-5 w-5 text-orange-600 dark:text-orange-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="border shadow-sm cursor-pointer transition-colors hover:bg-muted/50"
            onClick={() => navigate('/work-queue?leadsOnly=true')}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Total Leads</p>
                  <p className="text-xl font-medium mt-2">
                    {loadingKPIs ? (
                      <span className="text-muted-foreground animate-pulse">--</span>
                    ) : (
                      totalLeadsInPipeline
                    )}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-green-500/10">
                  <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* My Work Today Section */}
        <Card className="border shadow-sm">
          <CardHeader className="border-b">
            <div>
              <CardTitle className="text-xl font-semibold">My Work Today</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Leads that need your immediate attention</p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadingKPIs ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center text-muted-foreground">
                  <ListTodo className="h-12 w-12 mb-4 opacity-20 animate-pulse mx-auto" />
                  <p className="text-sm">Loading work items...</p>
                </div>
              </div>
            ) : myWorkToday.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mb-4 opacity-20 mx-auto" />
                  <p className="text-sm">No urgent items - you're all caught up!</p>
                </div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Lead</TableHead>
                    <TableHead className="text-xs">Channel</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Last Activity</TableHead>
                    <TableHead className="text-xs">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myWorkToday.map((item) => (
                    <TableRow key={item.conversation_id} className="h-10">
                      <TableCell className="align-middle">
                        <div className="flex flex-col">
                          <span className="text-xs font-medium truncate max-w-[200px]">{item.sender_name}</span>
                          <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                            {item.sender_email || item.sender_linkedin_url || 'No contact'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="align-middle whitespace-nowrap">
                        {item.conversation_type === 'email' ? (
                          <Badge variant="outline" className="gap-1">
                            <Mail className="h-3 w-3" /> Email
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1">
                            <Linkedin className="h-3 w-3" /> LinkedIn
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="align-middle whitespace-nowrap">
                        {item.overdue ? (
                          <Badge variant="destructive" className="text-[11px] px-1.5 py-0">Overdue</Badge>
                        ) : item.pending_reply ? (
                          <Badge variant="secondary" className="text-[11px] px-1.5 py-0">Pending Reply</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[11px] px-1.5 py-0">Up to date</Badge>
                        )}
                      </TableCell>
                      <TableCell className="align-middle whitespace-nowrap">
                        <span className="text-xs">
                          {item.last_message_at ? formatDistanceToNow(new Date(item.last_message_at), { addSuffix: true }) : 'No activity'}
                        </span>
                      </TableCell>
                      <TableCell className="align-middle whitespace-nowrap">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-[11px] font-medium h-7 px-2"
                          onClick={() => {
                            const conversation: Conversation = {
                              id: item.conversation_id,
                              sender_name: item.sender_name,
                              sender_email: item.sender_email || undefined,
                              sender_linkedin_url: item.sender_linkedin_url || undefined,
                              subject: item.subject || undefined,
                              preview: item.preview || '',
                              last_message_at: item.last_message_at || new Date().toISOString(),
                              conversation_type: item.conversation_type,
                              status: 'new' as const,
                              is_read: false,
                              assigned_to: item.assigned_sdr_id || undefined,
                              custom_stage_id: item.custom_stage_id || undefined,
                              stage_assigned_at: item.stage_assigned_at || undefined,
                              conversation_ids: [item.conversation_id],
                              activity_count: 0,
                              conversation_count: 1,
                            } as Conversation;
                            setSelectedLead(conversation);
                            setIsModalOpen(true);
                          }}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* SDR Leaderboard */}
        <Card className="border shadow-sm">
          <CardHeader className="border-b pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">SDR Leaderboard</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Top performing team members</p>
              </div>
              <Badge variant="outline" className="font-normal text-xs">
                <Users className="h-3 w-3 mr-1" />
                {sdrUsers.length} Active SDRs
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {sdrLeaderboardData.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No SDR data available
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">SDR</TableHead>
                    <TableHead className="text-xs">Leads Assigned</TableHead>
                    <TableHead className="text-xs">Lead Aging</TableHead>
                    <TableHead className="text-xs">Overdue</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {sdrLeaderboardData.map((row) => (
                    <TableRow key={row.id} className="h-10">
                      <TableCell className="text-sm font-medium">
                        {row.name}
                      </TableCell>

                      <TableCell className="text-sm">
                        {row.leadsAssigned}
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        Fresh: {row.fresh} | Warm: {row.warm} | Stale: {row.stale}
                      </TableCell>

                      <TableCell
                        className={`text-sm ${
                          row.overdue > 0
                            ? 'text-amber-600 font-medium'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {row.overdue}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Recent Activity</CardTitle>
                <CardDescription className="text-xs">
                  Latest lead-level updates
                </CardDescription>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => navigate("/work-queue")}
              >
                View all
              </Button>
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            {recentActivity.length === 0 ? (
              <div className="text-center text-muted-foreground py-6 text-sm">
                No recent activity
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((activity) => (
                  <div
                    key={`${activity.type}-${activity.conversationId}-${activity.timestamp}`}
                    className="flex gap-3 items-start"
                  >
                    <div className="mt-1 h-8 w-8 rounded-md bg-muted flex items-center justify-center text-xs">
                      {activity.type === "assigned" && "👤"}
                      {activity.type === "stage" && "📊"}
                      {activity.type === "overdue" && "⏰"}
                    </div>

                    <div className="flex-1">
                      <p className="text-sm font-medium leading-tight">
                        {activity.description}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {activity.title} ·{" "}
                        {formatDistanceToNow(new Date(activity.timestamp), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
          </div>
        </div>
      </div>

      {/* Lead Details Modal */}
      <LeadDetailsModal 
        conversation={selectedLead}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
      />
    </AppLayout>
  );
}
