import { AppLayout } from "@/components/Layout/AppLayout";
import { ConversationList } from "@/components/Inbox/ConversationList";
import { EmailView } from "@/components/Inbox/EmailView";
import { EmailSidebar } from "@/components/Inbox/EmailSidebar";
import { BulkActions } from "@/components/Inbox/BulkActions";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search, Filter, Loader2, AlertCircle, PanelRightClose, PanelRightOpen, User, ChevronLeft, ChevronRight } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { LeadProfilePanel } from "@/components/Inbox/LeadProfilePanel";
import { useConversations } from "@/hooks/useConversations";
import { ConnectedAccountFilter } from "@/components/Inbox/ConnectedAccountFilter";
import { toast } from "sonner";
import { useAssignConversation, useUpdateConversationStage, useToggleRead, useToggleFavoriteConversation, useDeleteConversation } from "@/hooks/useConversations";
import { useMessages } from "@/hooks/useMessages";
import { useEmailSyncStatus, useInitEmailSync } from "@/hooks/useEmailSync";
import { useConnectedAccounts } from "@/hooks/useConnectedAccounts";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { cn } from "@/lib/utils";

export default function EmailInbox() {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [accountFilter, setAccountFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConversations, setSelectedConversations] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState('inbox');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  const { user, userRole } = useAuth();
  const { data: conversations = [], isLoading, error: conversationsError } = useConversations('email');
  const assignConversation = useAssignConversation();
  const updateStage = useUpdateConversationStage();
  const toggleRead = useToggleRead();
  const { data: connectedAccounts = [] } = useConnectedAccounts();
  const { data: syncStatuses = [] } = useEmailSyncStatus();
  const initSync = useInitEmailSync();
  const { data: workspace, isLoading: workspaceLoading } = useWorkspace();
  const { data: teamMembers = [] } = useTeamMembers();
  const { data: stages = [] } = usePipelineStages();
  const toggleFavoriteConversation = useToggleFavoriteConversation();
  const deleteConversation = useDeleteConversation();
  const [tabValue, setTabValue] = useState<'all' | 'unread' | 'favorites'>('all');
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [filterState, setFilterState] = useState<{ sdr: string; stage: string }>({
    sdr: 'all',
    stage: 'all',
  });

  const activeFilterCount =
    (filterState.sdr !== 'all' ? 1 : 0) +
    (filterState.stage !== 'all' ? 1 : 0);

  const handleFilterChange = (key: 'sdr' | 'stage', value: string) => {
    setFilterState((prev) => {
      const newState = { ...prev, [key]: value };
      console.log('[EmailInbox] Filter changed:', key, value, newState);
      return newState;
    });
    // Close popover after filter change
    setTimeout(() => setFilterPopoverOpen(false), 100);
  };

  const clearFilters = () => {
    setFilterState({ sdr: 'all', stage: 'all' });
    setFilterPopoverOpen(false);
  };

  // Auto-trigger sync for all connected email accounts on mount
  useEffect(() => {
    if (!user || !connectedAccounts.length) return;
    
    const emailAccounts = connectedAccounts.filter(acc => acc.account_type === 'email');
    
    if (emailAccounts.length === 0) return;
    
    // Wait a bit for sync statuses to load, then check and trigger sync
    const timeoutId = setTimeout(() => {
      emailAccounts.forEach(account => {
        const syncStatus = syncStatuses.find((s: any) => s.accountId === account.id);
        
        const shouldSync = !syncStatus || syncStatus.status === 'error' || syncStatus.status === 'pending';
        
        const isInProgress = syncStatuses.some((s: any) => 
          s.accountId === account.id && s.status === 'in_progress'
        );
        
        if (shouldSync && !isInProgress) {
          console.log(`🚀 Triggering sync for account: ${account.account_name} (${account.id})`);
          initSync.mutate(account.id, {
            onSuccess: () => {
              console.log(`✅ Sync initiated for ${account.account_name}`);
              toast.success(`🔄 Syncing emails from ${account.account_name}...`, {
                duration: 3000,
              });
            },
            onError: (error: any) => {
              console.error(`❌ Failed to initiate sync for ${account.id}:`, error);
              const errorMessage = error?.message || 'Unknown error';
              toast.error(`Failed to sync ${account.account_name}: ${errorMessage}`, {
                duration: 5000,
              });
            }
          });
        }
      });
    }, 2000);
    
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, connectedAccounts.length, syncStatuses.length]);

  // Debug: Log all conversations with their stage IDs when filter is active
  useEffect(() => {
    if (filterState.stage !== 'all') {
      console.log('[Filter Debug] All conversations with stages:', conversations.map(conv => ({
        id: conv.id,
        subject: (conv as any).subject?.substring(0, 40),
        custom_stage_id: (conv as any).custom_stage_id,
        customStageId: (conv as any).customStageId,
        assignedStageId: (conv as any).custom_stage_id || (conv as any).customStageId || 'NULL'
      })));
      console.log('[Filter Debug] Active stage filter:', filterState.stage);
    }
  }, [filterState.stage, conversations]);

  // Apply filters
  const filteredConversations = conversations
    .filter(conv => {
      const accountId =
        (conv as any).received_on_account_id ||
        (conv as any).receivedOnAccountId ||
        (conv as any).received_account?.id;
      const matchesAccount =
        accountFilter === 'all' ||
        accountId === accountFilter;

      const searchTarget = `${conv.sender_name || ''} ${conv.sender_email || ''} ${conv.subject || ''}`.toLowerCase();
      const matchesSearch =
        searchQuery === '' ||
        searchTarget.includes(searchQuery.toLowerCase());

      const folder = (conv as any).email_folder || (conv as any).emailFolder || 'inbox';
      const matchesFolder = folder === selectedFolder;

      const isUnread = !(conv.is_read ?? (conv as any).isRead ?? false);
      const isFavorite = Boolean((conv as any).is_favorite ?? (conv as any).isFavorite);
      const matchesTab =
        tabValue === 'all' ||
        (tabValue === 'unread' && isUnread) ||
        (tabValue === 'favorites' && isFavorite);

      const assignedId = (conv as any).assigned_to || (conv as any).assignedTo;
      const matchesSdr =
        filterState.sdr === 'all' ||
        (filterState.sdr === 'unassigned' && !assignedId) ||
        assignedId === filterState.sdr;

      // Get stage ID from conversation - check multiple possible property names
      const stageId = (conv as any).custom_stage_id || (conv as any).customStageId || null;
      
      // Normalize stage IDs for comparison (convert to string, trim whitespace)
      const normalizedStageId = stageId ? String(stageId).trim() : null;
      const normalizedFilterStage = filterState.stage !== 'all' ? String(filterState.stage).trim() : 'all';
      
      const matchesStage =
        normalizedFilterStage === 'all' ||
        (normalizedStageId !== null && normalizedStageId === normalizedFilterStage);

      // Enhanced debug logging for stage filter
      if (normalizedFilterStage !== 'all') {
        const matches = normalizedStageId === normalizedFilterStage;
        if (matches || normalizedStageId) {
          console.log('[Filter] Stage check:', { 
            conversationId: conv.id,
            conversationSubject: (conv as any).subject?.substring(0, 30),
            stageId: normalizedStageId, 
            filterStage: normalizedFilterStage, 
            matches,
            stageIdType: typeof normalizedStageId,
            filterStageType: typeof normalizedFilterStage
          });
        }
      }

      const allMatches = matchesAccount && matchesSearch && matchesFolder && matchesTab && matchesSdr && matchesStage;
      
      // Log when a conversation matches all filters (only when stage filter is active)
      if (filterState.stage !== 'all' && allMatches) {
        console.log('[Filter] ✅ Conversation passed all filters:', {
          id: conv.id,
          subject: (conv as any).subject?.substring(0, 30),
          stageId: normalizedStageId,
          matches: { account: matchesAccount, search: matchesSearch, folder: matchesFolder, tab: matchesTab, sdr: matchesSdr, stage: matchesStage }
        });
      }
      
      return allMatches;
    })
    .map(conv => ({
      ...conv,
      selected: selectedConversations.includes(conv.id),
    }));

  // Debug: Log filtered results count
  useEffect(() => {
    if (filterState.stage !== 'all') {
      console.log('[Filter Debug] Filtered results:', {
        totalConversations: conversations.length,
        filteredCount: filteredConversations.length,
        activeStageFilter: filterState.stage,
        activeSdrFilter: filterState.sdr,
        activeFolder: selectedFolder,
        activeTab: tabValue
      });
    }
  }, [filteredConversations.length, filterState, conversations.length, selectedFolder, tabValue]);

  const handleToggleSelect = (id: string) => {
    setSelectedConversations(prev => 
      prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedConversations.length === filteredConversations.length) {
      setSelectedConversations([]);
    } else {
      setSelectedConversations(filteredConversations.map(c => c.id));
    }
  };

  const handleBulkMarkRead = () => {
    selectedConversations.forEach(id => {
      const conv = conversations.find(c => c.id === id);
      if (conv && !(conv.is_read || (conv as any).isRead)) {
        toggleRead.mutate({ conversationId: id, isRead: false });
      }
    });
  };

  const handleBulkMarkUnread = () => {
    selectedConversations.forEach(id => {
      const conv = conversations.find(c => c.id === id);
      if (conv && (conv.is_read || (conv as any).isRead)) {
        toggleRead.mutate({ conversationId: id, isRead: true });
      }
    });
  };

  const handleBulkAssignSDR = (sdrId: string | null) => {
    selectedConversations.forEach(id => {
      assignConversation.mutate({ conversationId: id, sdrId });
    });
  };

  const handleBulkChangeStage = (stageId: string) => {
    selectedConversations.forEach(id => {
      updateStage.mutate({ conversationId: id, stageId });
    });
  };

  const handleBulkArchive = () => {
    toast.info('Bulk archive feature coming soon');
  };

  const handleBulkFavorite = async (isFavorite: boolean) => {
    if (selectedConversations.length === 0) {
      toast.info('Select messages to update favorites');
      return;
    }

    await Promise.all(
      selectedConversations.map(id =>
        toggleFavoriteConversation.mutateAsync({ conversationId: id, isFavorite })
      )
    );
    setSelectedConversations([]);
    toast.success(isFavorite ? 'Marked as favorite' : 'Removed favorites');
  };

  const handleBulkDelete = async () => {
    if (selectedConversations.length === 0) {
      toast.info('Select messages to delete');
      return;
    }

    const confirmed = window.confirm('Delete selected email threads? This cannot be undone.');
    if (!confirmed) return;

    await Promise.all(selectedConversations.map(id => deleteConversation.mutateAsync(id)));
    setSelectedConversations([]);
  };

  const handleFolderChange = (folder: string) => {
    setSelectedFolder(folder);
    setSelectedConversations([]);
  };

  const selectedConv = conversations.find((c) => c.id === selectedConversation);
  const { data: messagesForSelected = [] } = useMessages(selectedConversation);

  const mockLead = selectedConv ? {
    name: selectedConv.sender_name || '',
    email: selectedConv.sender_email || '',
    company: "Acme Corp",
    stage: selectedConv.status,
    engagementScore: 65,
    lastResponseTime: "1 hour ago",
    messageCount: messagesForSelected.length,
    source: "Sales Account",
    assignedTo: "Jane SDR",
  } : null;

  const mockTimeline = selectedConv ? [
    { id: "1", type: "message" as const, description: "Email received", timestamp: "1 hour ago", actor: "System" },
    { id: "2", type: "assignment" as const, description: "Auto-assigned to Jane SDR", timestamp: "1 hour ago", actor: "Routing Rule" },
  ] : [];

  const isAnySyncInProgress = syncStatuses.some((s: any) => s.status === 'in_progress');

  return (
    <AppLayout role={userRole} userName={user?.email}>
      <div className="flex flex-col h-[calc(100vh-100px)] overflow-hidden">
        {/* Main Content Area */}
        <div className="flex flex-1 overflow-hidden relative">
          {/* Left Section: Sidebar + Conversations */}
          <div className="flex flex-shrink-0 h-full">
            {/* Email Sidebar - Collapsible */}
            <div className={cn(
              "h-full border-r bg-card flex-shrink-0 relative transition-all duration-300 ease-in-out group",
              isSidebarCollapsed ? "w-[60px]" : "w-[200px]"
            )}>
              <div className="h-full overflow-hidden">
                <EmailSidebar onFolderChange={handleFolderChange} isCollapsed={isSidebarCollapsed} />
              </div>
              
              {/* Collapse Button - Styled like Breakcold */}
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className={cn(
                  "absolute -right-3 top-3 z-10 bg-background border rounded-full p-1 shadow-sm hover:bg-accent transition-opacity",
                  "opacity-0 group-hover:opacity-100 focus:opacity-100"
                )}
                title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {isSidebarCollapsed ? (
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                ) : (
                  <ChevronLeft className="h-3 w-3 text-muted-foreground" />
                )}
              </button>
            </div>

            {/* Conversation List */}
            <div className="w-[320px] h-full border-r bg-background flex flex-col flex-shrink-0">
              <div className="p-3 space-y-2 border-b flex-shrink-0">
                <Tabs value={tabValue} onValueChange={(value) => setTabValue(value as 'all' | 'unread' | 'favorites')} className="w-full">
                  <TabsList className="bg-transparent border-b rounded-none w-full justify-start h-auto p-0">
                    <TabsTrigger 
                      value="all" 
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs px-3 py-1.5"
                    >
                      All Messages
                    </TabsTrigger>
                    <TabsTrigger 
                      value="unread"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs px-3 py-1.5"
                    >
                      Unread
                    </TabsTrigger>
                    <TabsTrigger 
                      value="favorites"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs px-3 py-1.5"
                    >
                      Favorites
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                
                <ConnectedAccountFilter 
                  value={accountFilter} 
                  onChange={setAccountFilter}
                  type="email"
                />

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input 
                      placeholder="Search leads" 
                      className="pl-7 h-8 text-xs placeholder:text-xs" 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="icon" className="h-8 w-8 flex-shrink-0 relative">
                        <Filter className="h-3.5 w-3.5" />
                        {activeFilterCount > 0 && (
                          <Badge className="absolute -top-1 -right-1 text-[10px] px-1 py-0 leading-none">
                            {activeFilterCount}
                          </Badge>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 space-y-4">
                      <div>
                        <p className="text-[11px] font-medium mb-1 text-muted-foreground">SDR</p>
                        <Select value={filterState.sdr} onValueChange={(value) => handleFilterChange('sdr', value)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="All SDRs" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem className="text-xs" value="all">All Accounts</SelectItem>
                            <SelectItem className="text-xs" value="unassigned">Unassigned</SelectItem>
                            {teamMembers.map((member) => (
                              <SelectItem key={member.id} value={member.id} className="text-xs">
                                {member.full_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <p className="text-[11px] font-medium mb-1 text-muted-foreground">Stage</p>
                        <Select value={filterState.stage} onValueChange={(value) => handleFilterChange('stage', value)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="All Stages" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem className="text-xs" value="all">All stages</SelectItem>
                            {stages.map(stage => (
                              <SelectItem key={stage.id} value={stage.id} className="text-xs">
                                {stage.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center justify-between">
                        <Button variant="ghost" size="sm" className="text-xs" onClick={clearFilters}>
                          Clear
                        </Button>
                        <Button size="sm" className="text-xs" onClick={() => setFilterPopoverOpen(false)}>
                          Apply
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Checkbox 
                      className="h-3.5 w-3.5" 
                      checked={selectedConversations.length === filteredConversations.length && filteredConversations.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                    <span className="text-xs">Select all</span>
                  </div>
                  
                  <BulkActions 
                    selectedCount={selectedConversations.length}
                    onMarkRead={handleBulkMarkRead}
                    onMarkUnread={handleBulkMarkUnread}
                    onAssignSDR={handleBulkAssignSDR}
                    onChangeStage={handleBulkChangeStage}
                    onArchive={handleBulkArchive}
                    onDelete={handleBulkDelete}
                    onFavorite={() => handleBulkFavorite(true)}
                    onUnfavorite={() => handleBulkFavorite(false)}
                    onClearSelection={() => setSelectedConversations([])}
                  />
                </div>
              </div>

              {/* Conversation List Content */}
              <div className="flex-1 overflow-y-auto">
                {workspaceLoading || isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Loading...</p>
                    </div>
                  </div>
                ) : !workspace ? (
                  <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                    <AlertCircle className="h-10 w-10 text-yellow-500 mb-3" />
                    <h3 className="text-sm font-semibold mb-1">Setup Required</h3>
                    <p className="text-xs text-muted-foreground">
                      Run SETUP_DATABASE_FOR_EMAIL_SYNC.sql in Supabase
                    </p>
                  </div>
                ) : connectedAccounts.filter(acc => acc.account_type === 'email').length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                    <AlertCircle className="h-10 w-10 text-blue-500 mb-3" />
                    <h3 className="text-sm font-semibold mb-1">No Email Accounts</h3>
                    <p className="text-xs text-muted-foreground mb-3">
                      Connect Gmail or Outlook to sync emails
                    </p>
                    <Button 
                      size="sm"
                      onClick={() => window.location.href = '/settings?tab=integrations'}
                    >
                      Connect
                    </Button>
                  </div>
                ) : filteredConversations.length === 0 && !isAnySyncInProgress ? (
                  <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                    <AlertCircle className="h-10 w-10 text-muted-foreground mb-3" />
                    <h3 className="text-sm font-semibold mb-1">No Emails</h3>
                    <p className="text-xs text-muted-foreground">
                      {syncStatuses.some(s => s.status === 'error') 
                        ? 'Sync error. Check Settings → Integrations'
                        : 'Emails syncing in background...'}
                    </p>
                  </div>
                ) : (
                  <ConversationList
                    conversations={filteredConversations as any}
                    onConversationClick={setSelectedConversation}
                    selectedId={selectedConversation || undefined}
                    onToggleSelect={handleToggleSelect}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Email View - Takes remaining space */}
          <div
            className={cn(
              "flex-1 min-w-0 h-full overflow-hidden bg-background relative transition-[padding-right] duration-300 ease-in-out",
              isProfileOpen ? "pr-[420px]" : "pr-0"
            )}
          >
            {selectedConv ? (
              <div className="h-full flex flex-col">
                <EmailView 
                  conversation={{
                    id: selectedConv.id,
                    senderName: (selectedConv as any).senderName || selectedConv.sender_name || '',
                    senderEmail: (selectedConv as any).senderEmail || selectedConv.sender_email || '',
                    subject: selectedConv.subject || '',
                    status: selectedConv.status,
                    assigned_to: (selectedConv as any).assigned_to || (selectedConv as any).assignedTo,
                    custom_stage_id: (selectedConv as any).custom_stage_id || (selectedConv as any).customStageId || null,
                    is_read: selectedConv.is_read
                  }} 
                  messages={messagesForSelected as any}
                />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <p className="text-sm">Select an email to view</p>
              </div>
            )}

          </div>

          {/* Right Profile Drawer - Slides in/out */}
          <div 
            className={cn(
              "fixed top-[72px] right-0 h-[calc(100vh-72px)] bg-card border-l shadow-2xl transition-all duration-300 ease-in-out z-40",
              isProfileOpen ? "translate-x-0 w-[400px]" : "translate-x-[calc(100%-36px)] w-[400px]"
            )}
          >
            {/* Drawer Content */}
            <div className="h-full flex flex-col">
              {/* Toggle Tab - Always visible on the left edge */}
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className={cn(
                  "absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full z-30",
                  "flex flex-col items-center justify-center gap-1 py-3 px-2",
                  "bg-slate-900 text-white rounded-l-md shadow-xl",
                  "hover:bg-slate-800 transition-all duration-200",
                  "w-10 h-24"
                )}
                title={isProfileOpen ? "Close profile" : "Open profile"}
              >
                <User className="h-4 w-4" />
                <div className="flex flex-col items-center gap-0.5 text-[9px] font-semibold tracking-tight">
                  <span>LEAD</span>
                  <span>PROFILE</span>
                </div>
              </button>
              
              {/* Drawer Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 flex-shrink-0">
                <h3 className="font-semibold text-base text-foreground">Lead Profile</h3>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 hover:bg-muted/50"
                  onClick={() => setIsProfileOpen(false)}
                >
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
              
              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto overscroll-contain">
                {selectedConv && mockLead ? (
                  <LeadProfilePanel 
                    lead={mockLead} 
                    timeline={mockTimeline}
                    conversationId={selectedConv.id}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center p-6">
                    <User className="h-16 w-16 text-muted-foreground/30 mb-4" />
                    <p className="text-sm font-medium text-muted-foreground">No lead selected</p>
                    <p className="text-xs text-muted-foreground mt-1.5">Select an email to view lead details</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
