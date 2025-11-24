import { AppLayout } from "@/components/Layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Mail, TrendingUp, UserCheck } from "lucide-react";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Team() {
  const { data: teamMembers = [], isLoading } = useTeamMembers();

  return (
    <AppLayout role="admin" userName="Admin User">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Team Management</h1>
            <p className="text-xs text-muted-foreground">Manage your SDR team and assignments</p>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add SDR
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New SDR</DialogTitle>
                <DialogDescription>
                  Invite a new team member to join your workspace
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" placeholder="John Doe" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="john@company.com" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline">Cancel</Button>
                <Button>Send Invitation</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading team members...</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {teamMembers.map((member) => (
              <Card key={member.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{member.full_name}</CardTitle>
                    <Badge variant={member.role === 'admin' ? "default" : "secondary"}>
                      {member.role === 'admin' ? "Admin" : "SDR"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{member.email}</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        <span>Role</span>
                      </div>
                      <span className="font-semibold capitalize">{member.role}</span>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1">
                      Assign
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
