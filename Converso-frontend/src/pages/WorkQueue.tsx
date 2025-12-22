import { AppLayout } from "@/components/Layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListTodo, Mail, Linkedin, Search, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { useState, useEffect } from "react";
import { workQueueApi, type WorkQueueItem } from "@/lib/backend-api";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { LeadDetailsModal } from "@/components/Pipeline/LeadDetailsModal";
import type { Conversation } from "@/hooks/useConversations";
import { useSearchParams } from "react-router-dom";

export default function WorkQueue() {
  const { user, userRole } = useAuth();
  const { data: userProfile } = useProfile();
  const { data: teamMembers = [] } = useTeamMembers();
  const { data: pipelineStages = [] } = usePipelineStages();
  const [searchParams] = useSearchParams();
  
  const currentUserMember = teamMembers.find(m => m.id === user?.id);
  const userDisplayName = userProfile?.full_name || currentUserMember?.full_name || user?.email || "User";

  // Read URL parameters for initial filter state
  const urlFilter = searchParams.get('filter') as 'all' | 'pending' | 'overdue' | 'idle' | null;
  const urlLeadsOnly = searchParams.get('leadsOnly') === 'true';

  const [workQueueItems, setWorkQueueItems] = useState<WorkQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'overdue' | 'idle'>(urlFilter || 'all');
  const [showLeadsOnly, setShowLeadsOnly] = useState(urlLeadsOnly || true);
  const [channelFilter, setChannelFilter] = useState<'all' | 'email' | 'linkedin'>('all');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [assignedSdrFilter, setAssignedSdrFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLead, setSelectedLead] = useState<Conversation | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);

  // Fetch work queue data when activeFilter changes
  useEffect(() => {
    const fetchWorkQueue = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await workQueueApi.getWorkQueue(activeFilter);
        setWorkQueueItems(data);
      } catch (err) {
        console.error('Failed to fetch work queue:', err);
        setError(err instanceof Error ? err.message : 'Failed to load work queue');
      } finally {
        setLoading(false);
      }
    };

    fetchWorkQueue();
  }, [activeFilter]);

  // Handle filter button click
  const handleFilterChange = (filter: 'all' | 'pending' | 'overdue' | 'idle') => {
    setActiveFilter(filter);
  };

  // Handle sort toggle
  const handleSort = (key: string) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDirection('asc');
    } else if (sortDirection === 'asc') {
      setSortDirection('desc');
    } else {
      setSortKey(null);
      setSortDirection(null);
    }
  };

  // Handle lead click to open modal
  const handleLeadClick = (item: WorkQueueItem) => {
    // Convert WorkQueueItem to Conversation format for modal
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
  };

  // Apply client-side filtering for all filters
  const displayedItems = workQueueItems
    .filter(item => {
      // Apply "Leads Only" filter
      if (showLeadsOnly && item.custom_stage_id === null) {
        return false;
      }
      // Apply channel filter
      if (channelFilter === 'email' && item.conversation_type !== 'email') {
        return false;
      }
      if (channelFilter === 'linkedin' && item.conversation_type !== 'linkedin') {
        return false;
      }
      // Apply stage filter
      if (stageFilter !== 'all' && item.custom_stage_id !== stageFilter) {
        return false;
      }
      // Apply assigned SDR filter
      if (assignedSdrFilter !== 'all' && item.assigned_sdr_id !== assignedSdrFilter) {
        return false;
      }
      // Apply search filter (case-insensitive)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = item.sender_name?.toLowerCase().includes(query);
        const matchesEmail = item.sender_email?.toLowerCase().includes(query);
        const matchesLinkedIn = item.sender_linkedin_url?.toLowerCase().includes(query);
        
        if (!matchesName && !matchesEmail && !matchesLinkedIn) {
          return false;
        }
      }
      return true;
    });

  // Apply sorting after filtering
  const sortedItems = [...displayedItems];

  if (sortKey && sortDirection) {
    sortedItems.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      // Map sort keys to actual data
      if (sortKey === 'conversation_type') {
        aVal = a.conversation_type;
        bVal = b.conversation_type;
      } else if (sortKey === 'stage_name') {
        aVal = a.custom_stage_id ? pipelineStages.find(s => s.id === a.custom_stage_id)?.name : null;
        bVal = b.custom_stage_id ? pipelineStages.find(s => s.id === b.custom_stage_id)?.name : null;
      } else if (sortKey === 'assigned_to_name') {
        aVal = a.assigned_sdr_id ? teamMembers.find(m => m.id === a.assigned_sdr_id)?.full_name : null;
        bVal = b.assigned_sdr_id ? teamMembers.find(m => m.id === b.assigned_sdr_id)?.full_name : null;
      } else if (sortKey === 'last_activity_at') {
        aVal = a.last_message_at;
        bVal = b.last_message_at;
      } else if (sortKey === 'idle_days') {
        aVal = a.idle_days;
        bVal = b.idle_days;
      } else if (sortKey === 'status') {
        // Status priority: overdue > pending_reply > up to date
        aVal = a.overdue ? 0 : a.pending_reply ? 1 : 2;
        bVal = b.overdue ? 0 : b.pending_reply ? 1 : 2;
      }

      if (aVal == null) return 1;
      if (bVal == null) return -1;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      return sortDirection === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }

  return (
    <AppLayout role={userRole} userName={userDisplayName}>
      <div className="flex flex-col h-[calc(100vh-56px-48px)]">
        {/* Sticky Header */}
        <div className="sticky top-0 z-20 bg-background border-b pb-4">
          {/* Page Header */}
          <div className="mb-4">
            <h1 className="text-3xl font-bold text-foreground">
              Work Queue
            </h1>
            <p className="text-muted-foreground mt-1">Leads that need your action</p>
          </div>

          {/* Filter Bar with integrated Search */}
          <Card className="border shadow-sm">
            <div className="px-4 py-2">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant={activeFilter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleFilterChange('all')}
                  >
                    All
                  </Button>
                  <Button
                    variant={activeFilter === 'pending' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleFilterChange('pending')}
                  >
                    Pending Reply
                  </Button>
                  <Button
                    variant={activeFilter === 'overdue' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleFilterChange('overdue')}
                  >
                    Overdue
                  </Button>
                  <Button
                    variant={activeFilter === 'idle' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleFilterChange('idle')}
                  >
                    Idle
                  </Button>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {/* Channel Filter Dropdown */}
                    <Select value={channelFilter} onValueChange={(value: 'all' | 'email' | 'linkedin') => setChannelFilter(value)}>
                      <SelectTrigger className="w-[140px] h-9">
                        <SelectValue placeholder="All Channels" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Channels</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="linkedin">LinkedIn</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Stage Filter Dropdown */}
                    <Select value={stageFilter} onValueChange={setStageFilter}>
                      <SelectTrigger className="w-[140px] h-9">
                        <SelectValue placeholder="All Stages" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Stages</SelectItem>
                        {pipelineStages.map((stage) => (
                          <SelectItem key={stage.id} value={stage.id}>
                            {stage.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Assigned SDR Filter (Admin only) */}
                    {userRole === 'admin' && (
                      <Select value={assignedSdrFilter} onValueChange={setAssignedSdrFilter}>
                        <SelectTrigger className="w-[140px] h-9">
                          <SelectValue placeholder="All SDRs" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All SDRs</SelectItem>
                          {teamMembers.map((member) => (
                            <SelectItem key={member.id} value={member.id}>
                              {member.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {/* Leads Only Toggle */}
                    <div className="flex items-center gap-2">
                      <Switch
                        id="leads-only"
                        checked={showLeadsOnly}
                        onCheckedChange={setShowLeadsOnly}
                      />
                      <Label htmlFor="leads-only" className="cursor-pointer">
                        Leads only
                      </Label>
                    </div>
                  </div>

                  {/* Search Bar - Integrated into Filter Card */}
                  <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search leads..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Table */}
          <Card className="border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead</TableHead>
                <TableHead>
                  <div
                    className="flex items-center gap-1 cursor-pointer select-none"
                    onClick={() => handleSort('conversation_type')}
                  >
                    <span>Channel</span>
                    {sortKey !== 'conversation_type' && <ArrowUpDown className="h-3 w-3 text-muted-foreground" />}
                    {sortKey === 'conversation_type' && sortDirection === 'asc' && <ArrowUp className="h-3 w-3" />}
                    {sortKey === 'conversation_type' && sortDirection === 'desc' && <ArrowDown className="h-3 w-3" />}
                  </div>
                </TableHead>
                <TableHead>
                  <div
                    className="flex items-center gap-1 cursor-pointer select-none"
                    onClick={() => handleSort('stage_name')}
                  >
                    <span>Stage</span>
                    {sortKey !== 'stage_name' && <ArrowUpDown className="h-3 w-3 text-muted-foreground" />}
                    {sortKey === 'stage_name' && sortDirection === 'asc' && <ArrowUp className="h-3 w-3" />}
                    {sortKey === 'stage_name' && sortDirection === 'desc' && <ArrowDown className="h-3 w-3" />}
                  </div>
                </TableHead>
                {userRole === 'admin' && (
                  <TableHead>
                    <div
                      className="flex items-center gap-1 cursor-pointer select-none"
                      onClick={() => handleSort('assigned_to_name')}
                    >
                      <span>Assigned To</span>
                      {sortKey !== 'assigned_to_name' && <ArrowUpDown className="h-3 w-3 text-muted-foreground" />}
                      {sortKey === 'assigned_to_name' && sortDirection === 'asc' && <ArrowUp className="h-3 w-3" />}
                      {sortKey === 'assigned_to_name' && sortDirection === 'desc' && <ArrowDown className="h-3 w-3" />}
                    </div>
                  </TableHead>
                )}
                <TableHead>
                  <div
                    className="flex items-center gap-1 cursor-pointer select-none"
                    onClick={() => handleSort('last_activity_at')}
                  >
                    <span>Last Activity</span>
                    {sortKey !== 'last_activity_at' && <ArrowUpDown className="h-3 w-3 text-muted-foreground" />}
                    {sortKey === 'last_activity_at' && sortDirection === 'asc' && <ArrowUp className="h-3 w-3" />}
                    {sortKey === 'last_activity_at' && sortDirection === 'desc' && <ArrowDown className="h-3 w-3" />}
                  </div>
                </TableHead>
                <TableHead>
                  <div
                    className="flex items-center gap-1 cursor-pointer select-none"
                    onClick={() => handleSort('idle_days')}
                  >
                    <span>Idle (days)</span>
                    {sortKey !== 'idle_days' && <ArrowUpDown className="h-3 w-3 text-muted-foreground" />}
                    {sortKey === 'idle_days' && sortDirection === 'asc' && <ArrowUp className="h-3 w-3" />}
                    {sortKey === 'idle_days' && sortDirection === 'desc' && <ArrowDown className="h-3 w-3" />}
                  </div>
                </TableHead>
                <TableHead>
                  <div
                    className="flex items-center gap-1 cursor-pointer select-none"
                    onClick={() => handleSort('status')}
                  >
                    <span>Status</span>
                    {sortKey !== 'status' && <ArrowUpDown className="h-3 w-3 text-muted-foreground" />}
                    {sortKey === 'status' && sortDirection === 'asc' && <ArrowUp className="h-3 w-3" />}
                    {sortKey === 'status' && sortDirection === 'desc' && <ArrowDown className="h-3 w-3" />}
                  </div>
                </TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={userRole === 'admin' ? 8 : 7} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <ListTodo className="h-12 w-12 mb-4 opacity-20 animate-pulse" />
                      <p className="text-sm">Loading work queue...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={userRole === 'admin' ? 8 : 7} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <ListTodo className="h-12 w-12 mb-4 opacity-20" />
                      <p className="text-sm text-red-500">{error}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : sortedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={userRole === 'admin' ? 8 : 7} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <ListTodo className="h-12 w-12 mb-4 opacity-20" />
                      <p className="text-sm">
                        {searchQuery.trim() 
                          ? 'No matching leads found' 
                          : showLeadsOnly 
                            ? 'No leads in pipeline' 
                            : 'No work items yet'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                sortedItems.map((item) => (
                  <TableRow key={item.conversation_id}>
                    {/* Lead */}
                    <TableCell className="align-middle">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium truncate">{item.sender_name}</span>
                        <span className="text-xs text-muted-foreground truncate max-w-[240px]">
                          {item.sender_email || item.sender_linkedin_url || 'No contact'}
                        </span>
                      </div>
                    </TableCell>

                    {/* Channel */}
                    <TableCell className="align-middle whitespace-nowrap">
                      {item.conversation_type === 'email' ? (
                        <Badge variant="outline" className="gap-1">
                          <Mail className="h-3 w-3" />
                          Email
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1">
                          <Linkedin className="h-3 w-3" />
                          LinkedIn
                        </Badge>
                      )}
                    </TableCell>

                    {/* Stage */}
                    <TableCell className="align-middle whitespace-nowrap">
                      {item.custom_stage_id 
                        ? <span className="text-xs">{pipelineStages.find(s => s.id === item.custom_stage_id)?.name || 'Unknown'}</span>
                        : <span className="text-xs text-muted-foreground">Unassigned</span>
                      }
                    </TableCell>

                    {/* Assigned To (Admin only) */}
                    {userRole === 'admin' && (
                      <TableCell className="align-middle whitespace-nowrap">
                        {item.assigned_sdr_id 
                          ? <span className="text-xs">{teamMembers.find(m => m.id === item.assigned_sdr_id)?.full_name || 'Unknown'}</span>
                          : <span className="text-xs text-muted-foreground">Unassigned</span>
                        }
                      </TableCell>
                    )}

                    {/* Last Activity */}
                    <TableCell className="align-middle whitespace-nowrap">
                      <span className="text-xs">
                        {item.last_message_at
                          ? formatDistanceToNow(new Date(item.last_message_at), { addSuffix: true })
                          : 'No activity'}
                      </span>
                    </TableCell>

                    {/* Idle (days) */}
                    <TableCell className="align-middle whitespace-nowrap">
                      <span className="text-xs">
                        {item.idle_days !== null ? item.idle_days : '-'}
                      </span>
                    </TableCell>

                    {/* Status */}
                    <TableCell className="align-middle whitespace-nowrap">
                      {item.overdue ? (
                        <Badge variant="destructive" className="text-xs px-2 py-0.5">Overdue</Badge>
                      ) : item.pending_reply ? (
                        <Badge variant="secondary" className="text-xs px-2 py-0.5">Pending Reply</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs px-2 py-0.5">Up to date</Badge>
                      )}
                    </TableCell>

                    {/* Action */}
                    <TableCell className="align-middle whitespace-nowrap">
                      <Button variant="ghost" size="sm" onClick={() => handleLeadClick(item)} className="text-xs font-medium">
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
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
