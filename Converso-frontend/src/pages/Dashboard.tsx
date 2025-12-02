import { AppLayout } from "@/components/Layout/AppLayout";
import { StatsCard } from "@/components/Dashboard/StatsCard";
import { Mail, Linkedin, Users, CheckCircle, Clock, TrendingUp, AlertCircle, MessageSquare } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function Dashboard() {
  const { user, userRole } = useAuth();
  const { data: userProfile } = useProfile();
  const { data: teamMembers = [] } = useTeamMembers();
  
  const currentUserMember = teamMembers.find(m => m.id === user?.id);
  const userDisplayName = userProfile?.full_name || currentUserMember?.full_name || user?.email || "User";
  
  return (
    <AppLayout role={userRole} userName={userDisplayName}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">Real-time overview of your SDR operations</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatsCard
            title="Emails Today"
            value={34}
            icon={Mail}
            trend={{ value: 12, isPositive: true }}
          />
          <StatsCard
            title="LinkedIn DMs"
            value={18}
            icon={Linkedin}
            trend={{ value: 8, isPositive: true }}
          />
          <StatsCard
            title="Pending Reply"
            value={23}
            icon={AlertCircle}
            trend={{ value: 8, isPositive: true }}
          />
          <StatsCard
            title="No Response"
            value={12}
            icon={MessageSquare}
            trend={{ value: 5, isPositive: false }}
          />
          <StatsCard
            title="Open Conversations"
            value={45}
            icon={Clock}
            trend={{ value: 5, isPositive: false }}
          />
          <StatsCard
            title="Converted Today"
            value={7}
            icon={CheckCircle}
            trend={{ value: 15, isPositive: true }}
          />
        </div>

        {userRole === 'admin' && (
          <Card className="border shadow-sm">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-semibold">SDR Leaderboard</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">Top performing team members</p>
                </div>
                <Badge variant="outline" className="font-normal">
                  <Users className="h-3 w-3 mr-1" />
                  {teamMembers.length} Active SDRs
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
...
            </CardContent>
          </Card>
        )}

        <Card className="border shadow-sm">
          <CardHeader className="border-b">
            <CardTitle className="text-xl font-semibold">Recent Activity</CardTitle>
            <p className="text-sm text-muted-foreground">Latest updates from your team</p>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-500" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">Lead Converted</div>
                  <div className="text-sm text-muted-foreground mt-0.5">
                    <span className="font-medium text-foreground">Jane</span> converted <span className="font-medium text-foreground">Sarah Johnson</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">2 hours ago</div>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Mail className="h-4 w-4 text-blue-600 dark:text-blue-500" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">New Email Lead</div>
                  <div className="text-sm text-muted-foreground mt-0.5">
                    <span className="font-medium text-foreground">Mike Chen</span> from TechCorp reached out
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">3 hours ago</div>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Linkedin className="h-4 w-4 text-blue-600 dark:text-blue-500" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">LinkedIn DM</div>
                  <div className="text-sm text-muted-foreground mt-0.5">
                    <span className="font-medium text-foreground">David Park</span> sent a connection request
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">5 hours ago</div>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-500" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">Lead Qualified</div>
                  <div className="text-sm text-muted-foreground mt-0.5">
                    <span className="font-medium text-foreground">John</span> qualified <span className="font-medium text-foreground">Emily Rodriguez</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">1 day ago</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
