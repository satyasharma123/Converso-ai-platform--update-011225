import { AppLayout } from "@/components/Layout/AppLayout";
import { ConversationList } from "@/components/Inbox/ConversationList";
import { EmailView } from "@/components/Inbox/EmailView";
import { EmailSidebar } from "@/components/Inbox/EmailSidebar";
import { BulkActions } from "@/components/Inbox/BulkActions";
import { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Search, Filter, Loader2, AlertCircle, PanelRightClose, PanelRightOpen, User, ChevronLeft, ChevronRight, PanelLeft, RefreshCw, X } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
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
  const location = useLocation();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [accountFilter, setAccountFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConversations, setSelectedConversations] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState('inbox');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showCheckboxes, setShowCheckboxes] = useState(false);
  
  const { user, userRole } = useAuth();
  
  // Handle navigation from Sales Pipeline
  useEffect(() => {
    if (location.state?.selectedConversationId) {
      setSelectedConversation(location.state.selectedConversationId);
      setIsProfileOpen(true);
      // Clear the state after using it
      window.history.replaceState({}, document.title);
    }
  }, [location]);
  const { data: userProfile } = useProfile();
  const { data: teamMembers = [] } = useTeamMembers();
  
  // ✅ MULTI-FOLDER SUPPORT: Fetch conversations for selected folder only
  // Backend filters by folder using message-level provider_folder
  const { data: conversations = [], isLoading, error: conversationsError } = useConversations('email', selectedFolder);
  
  const currentUserMember = teamMembers.find(m => m.id === user?.id);
  const userDisplayName = userProfile?.full_name || currentUserMember?.full_name || user?.email || "User";
  const assignConversation = useAssignConversation();
  const updateStage = useUpdateConversationStage();
  const toggleRead = useToggleRead();
  const { data: connectedAccounts = [] } = useConnectedAccounts();
  const { data: syncStatuses = [] } = useEmailSyncStatus();
  const initSync = useInitEmailSync();
  const { data: workspace, isLoading: workspaceLoading } = useWorkspace();
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

  // Calculate unread count and favorites count
  const unreadCount = conversations.filter(conv => !(conv.is_read ?? (conv as any).isRead ?? false)).length;
  const favoritesCount = conversations.filter(conv => 
    Boolean((conv as any).is_favorite ?? (conv as any).isFavorite)
  ).length;

  // Function to trigger sync for all email accounts
  const triggerEmailSync = (isManual: boolean = false) => {
    if (!user || !workspace) return;
    
    const emailAccounts = connectedAccounts.filter(acc => acc.account_type === 'email');
    
    if (emailAccounts.length === 0) {
      if (isManual) {
        toast.error('No email accounts connected. Please connect Gmail or Outlook from Settings → Integrations', {
          duration: 5000,
          action: {
            label: 'Go to Settings',
            onClick: () => window.location.href = '/settings?tab=integrations'
          }
        });
      }
      return;
    }
    
    setIsSyncing(true);
    const accountsToSync: any[] = [];
    
    // First, identify which accounts need syncing
    emailAccounts.forEach(account => {
      const syncStatus = syncStatuses.find((s: any) => s.accountId === account.id);
      
      // For manual sync, always sync regardless of status
      // For auto sync, only sync if needed
      const shouldSync = isManual || 
                        !syncStatus || 
                        syncStatus.status === 'error' || 
                        syncStatus.status === 'pending';
      
      const isInProgress = syncStatuses.some((s: any) => 
        s.accountId === account.id && s.status === 'in_progress'
      );
      
      if (shouldSync && !isInProgress) {
        accountsToSync.push(account);
      }
    });
    
    if (accountsToSync.length === 0) {
      setIsSyncing(false);
      if (isManual) {
        toast.info('All accounts are already synced');
      }
      return;
    }
    
    // Track completed syncs
    let completedCount = 0;
    const totalToSync = accountsToSync.length;
    
    // Show initial toast for manual sync
    if (isManual) {
      const accountNames = accountsToSync.map(a => a.account_name || a.account_email).join(', ');
      toast.info(`Syncing ${totalToSync} account${totalToSync > 1 ? 's' : ''}: ${accountNames}`, {
        duration: 4000,
      });
    }
    
    // Trigger sync for each account with a timeout safety net
    const syncTimeout = setTimeout(() => {
      // Safety: If sync takes longer than 2 minutes, reset the state
      if (completedCount < totalToSync) {
        console.warn('⚠️ Sync timeout - resetting sync state');
        setIsSyncing(false);
      }
    }, 2 * 60 * 1000); // 2 minutes timeout
    
    // Trigger sync for each account
    accountsToSync.forEach((account, index) => {
      console.log(`${isManual ? '🔄 Manual' : '🚀 Auto'} syncing account: ${account.account_name || account.account_email} (${account.id})`);
      
      initSync.mutate(account.id, {
        onSuccess: () => {
          console.log(`✅ Sync initiated for ${account.account_name || account.account_email}`);
        },
        onError: (error: any) => {
          console.error(`❌ Failed to initiate sync for ${account.id}:`, error);
          const errorMessage = error?.message || 'Unknown error';
          if (isManual) {
            toast.error(`Failed to sync ${account.account_name || account.account_email}: ${errorMessage}`, {
              duration: 5000,
            });
          }
        },
        onSettled: () => {
          completedCount++;
          console.log(`📊 Sync progress: ${completedCount}/${totalToSync} accounts processed`);
          
          // Only set isSyncing to false when ALL accounts are done
          if (completedCount >= totalToSync) {
            clearTimeout(syncTimeout);
            setIsSyncing(false);
            console.log('✅ All syncs completed');
            if (isManual) {
              toast.success(`Sync completed for ${totalToSync} account${totalToSync > 1 ? 's' : ''}`, {
                duration: 3000,
              });
            }
          }
        }
      });
    });
  };

  // Auto-trigger sync for all connected email accounts on mount (only if not already synced)
  useEffect(() => {
    if (!user || !connectedAccounts.length || !workspace) return;
    
    const emailAccounts = connectedAccounts.filter(acc => acc.account_type === 'email');
    
    if (emailAccounts.length === 0) return;
    
    // Wait for sync statuses to load, then check and trigger sync only if needed
    const timeoutId = setTimeout(() => {
      triggerEmailSync(false); // Auto sync on mount
    }, 2000);
    
    return () => clearTimeout(timeoutId);
    // ✅ FIX: Remove syncStatuses.length and connectedAccounts.length from deps to prevent refetch loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, workspace?.id]);

  // Auto-sync every 15 minutes
  useEffect(() => {
    if (!user || !workspace) return;
    
    // Set up interval for auto-sync every 15 minutes (900000 ms)
    const syncInterval = setInterval(() => {
      console.log('⏰ Auto-sync triggered (15-minute interval)');
      triggerEmailSync(false);
    }, 15 * 60 * 1000); // 15 minutes
    
    return () => clearInterval(syncInterval);
    // ✅ FIX: Remove connectedAccounts.length from deps to prevent refetch loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, workspace?.id]);

  // ✅ FIX: Removed debug useEffect that was causing refetch loops on conversations changes
  // Debug: Log all conversations with their stage IDs when filter is active
  // (Commenting out to prevent refetch loops - enable only for debugging)
  // useEffect(() => {
  //   if (filterState.stage !== 'all') {
  //     console.log('[Filter Debug] All conversations with stages:', conversations.map(conv => ({
  //       id: conv.id,
  //       subject: (conv as any).subject?.substring(0, 40),
  //       custom_stage_id: (conv as any).custom_stage_id,
  //       customStageId: (conv as any).customStageId,
  //       assignedStageId: (conv as any).custom_stage_id || (conv as any).customStageId || 'NULL'
  //     })));
  //     console.log('[Filter Debug] Active stage filter:', filterState.stage);
  //   }
  // }, [filterState.stage, conversations]);

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

      // ✅ NO FOLDER FILTERING: Backend already filtered by folder
      // Conversations returned are already for the selected folder

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

      const allMatches = matchesAccount && matchesSearch && matchesTab && matchesSdr && matchesStage;
      
      // Log when a conversation matches all filters (only when stage filter is active)
      if (filterState.stage !== 'all' && allMatches) {
        console.log('[Filter] ✅ Conversation passed all filters:', {
          id: conv.id,
          subject: (conv as any).subject?.substring(0, 30),
          stageId: normalizedStageId,
          matches: { account: matchesAccount, search: matchesSearch, tab: matchesTab, sdr: matchesSdr, stage: matchesStage }
        });
      }
      
      return allMatches;
    })
    .map(conv => ({
      ...conv,
      selected: selectedConversations.includes(conv.id),
    }));

  // ✅ FIX: Removed debug useEffect that was causing refetch loops
  // Debug: Log filtered results count
  // (Commenting out to prevent refetch loops - enable only for debugging)
  // useEffect(() => {
  //   if (filterState.stage !== 'all') {
  //     console.log('[Filter Debug] Filtered results:', {
  //       totalConversations: conversations.length,
  //       filteredCount: filteredConversations.length,
  //       activeStageFilter: filterState.stage,
  //       activeSdrFilter: filterState.sdr,
  //       activeFolder: selectedFolder,
  //       activeTab: tabValue
  //     });
  //   }
  // }, [filteredConversations.length, filterState, conversations.length, selectedFolder, tabValue]);

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

  // ✅ MINIMAL FIX: Conversation is metadata only, messages contain email body
  // This prevents body loss when conversations cache is invalidated
  const selectedConv = conversations.find((c) => c.id === selectedConversation);
  
  // Fetch messages for selected conversation (contains email body)
  // Messages cache is independent of conversations cache
  const { data: messagesForSelected = [] } = useMessages(selectedConversation);

  // 🔍 DEBUG: Log data sources for troubleshooting
  if (process.env.NODE_ENV === 'development' && selectedConv) {
    console.log('[EmailInbox] Data sources:', {
      conversationId: selectedConv.id,
      conversationHasPreview: !!selectedConv.preview,
      messagesCount: messagesForSelected.length,
      firstMessageHasBody: !!(messagesForSelected[0] as any)?.html_body || !!(messagesForSelected[0] as any)?.text_body,
    });
  }

  // Calculate engagement score based on message count, response time, and activity
  const calculateEngagementScore = (messageCount: number, lastMessageAt: string | null): number => {
    let score = 0;
    // Base score from message count (up to 50 points)
    score += Math.min(messageCount * 10, 50);
    
    // Response time score (up to 30 points) - faster responses = higher score
    if (lastMessageAt) {
      const hoursSinceLastMessage = (Date.now() - new Date(lastMessageAt).getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastMessage < 1) score += 30;
      else if (hoursSinceLastMessage < 4) score += 20;
      else if (hoursSinceLastMessage < 24) score += 10;
      else score += 5;
    }
    
    // Activity bonus (up to 20 points) - more messages = more engaged
    if (messageCount > 5) score += 20;
    else if (messageCount > 2) score += 10;
    
    return Math.min(score, 100);
  };

  // Format time ago helper
  const formatTimeAgo = (timestamp: string | null | undefined): string => {
    if (!timestamp) return "Never";
    const now = new Date();
    const past = new Date(timestamp);
    const diffMs = now.getTime() - past.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return "just now";
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
  };

  // Get account display name
  const getAccountDisplay = (conv: typeof selectedConv): string => {
    if (conv?.received_account?.account_email) {
      return conv.received_account.account_email;
    }
    if (conv?.received_account?.account_name) {
      return conv.received_account.account_name;
    }
    return conv?.sender_email || "N/A";
  };

  const leadData = selectedConv ? {
    name: selectedConv.sender_name || '',
    email: selectedConv.sender_email || '',
    company: (selectedConv as any).company_name || '',
    location: (selectedConv as any).location || '',
    stage: selectedConv.status,
    stageId: (selectedConv as any).custom_stage_id || null,
    engagementScore: calculateEngagementScore(
      messagesForSelected.length, 
      selectedConv.last_message_at || (selectedConv as any).lastMessageAt
    ),
    lastResponseTime: formatTimeAgo(
      selectedConv.last_message_at || (selectedConv as any).lastMessageAt
    ),
    messageCount: messagesForSelected.length,
    source: selectedConv.conversation_type || 'email',
    account: getAccountDisplay(selectedConv),
    assignedTo: teamMembers?.find(m => m.id === selectedConv.assigned_to)?.full_name || "Unassigned",
    assignedToId: selectedConv.assigned_to || '',
  } : null;

  // Generate timeline from actual messages
  const generateTimeline = (conv: typeof selectedConv, messages: typeof messagesForSelected) => {
    const timeline = [];
    if (conv) {
      // Add conversation creation
      timeline.push({
        id: "conv-created",
        type: "message" as const,
        description: `${conv.conversation_type === 'email' ? 'Email' : 'LinkedIn message'} received`,
        timestamp: formatTimeAgo((conv as any).created_at || (conv as any).createdAt),
        actor: "System"
      });

      // Add message events (first and last)
      if (messages.length > 0) {
        const firstMessage = messages[messages.length - 1]; // Oldest first
        const lastMessage = messages[0]; // Newest first
        if (messages.length === 1) {
          timeline.push({
            id: `msg-${firstMessage.id}`,
            type: "message" as const,
            description: "First message received",
            timestamp: formatTimeAgo(firstMessage.created_at || (firstMessage as any).createdAt),
            actor: firstMessage.sender_name || "Lead"
          });
        } else {
          timeline.push({
            id: `msg-last-${lastMessage.id}`,
            type: "message" as const,
            description: "Latest message received",
            timestamp: formatTimeAgo(lastMessage.created_at || (lastMessage as any).createdAt),
            actor: lastMessage.sender_name || "Lead"
          });
        }
      }

      // Add assignment if assigned
      const assignedMember = teamMembers?.find(m => m.id === conv.assigned_to);
      if (assignedMember) {
        timeline.push({
          id: "assignment",
          type: "assignment" as const,
          description: `Assigned to ${assignedMember.full_name}`,
          timestamp: formatTimeAgo(conv.last_message_at || (conv as any).lastMessageAt),
          actor: "System"
        });
      }
    }
    return timeline;
  };

  const timeline = selectedConv ? generateTimeline(selectedConv, messagesForSelected) : [];

  const isAnySyncInProgress = syncStatuses.some((s: any) => s.status === 'in_progress');

  return (
    <AppLayout role={userRole} userName={userDisplayName}>
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
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs px-3 py-1.5 relative"
                    >
                      Unread
                      {unreadCount > 0 && (
                        <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold text-white bg-blue-600 rounded-full">
                          {unreadCount}
                        </span>
                      )}
                    </TabsTrigger>
                    <TabsTrigger 
                      value="favorites"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs px-3 py-1.5 relative"
                    >
                      Favorites
                      {favoritesCount > 0 && (
                        <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold text-white bg-amber-500 rounded-full">
                          {favoritesCount}
                        </span>
                      )}
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
                  
                  {/* Manual Sync Button */}
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => triggerEmailSync(true)}
                    disabled={isSyncing || isAnySyncInProgress}
                    className="h-8 w-8 flex-shrink-0"
                    title="Sync emails"
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", (isSyncing || isAnySyncInProgress) && "animate-spin")} />
                  </Button>
                  
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
                  {!showCheckboxes ? (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 text-xs px-2"
                      onClick={() => setShowCheckboxes(true)}
                    >
                      Select
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <Checkbox 
                          className="h-3.5 w-3.5" 
                          checked={selectedConversations.length === filteredConversations.length && filteredConversations.length > 0}
                          onCheckedChange={handleSelectAll}
                        />
                        <span className="text-xs">Select all</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 hover:bg-muted"
                        onClick={() => {
                          setSelectedConversations([]);
                          setShowCheckboxes(false);
                        }}
                        title="Cancel selection"
                      >
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  )}
                  
                  {showCheckboxes && (
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
                      onClearSelection={() => {
                        setSelectedConversations([]);
                        setShowCheckboxes(false);
                      }}
                    />
                  )}
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
                ) : userRole === 'sdr' && filteredConversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                    <AlertCircle className="h-10 w-10 text-muted-foreground mb-3" />
                    <h3 className="text-sm font-semibold mb-1">No emails assigned</h3>
                    <p className="text-xs text-muted-foreground">
                      Emails will appear here once an admin assigns them to you.
                    </p>
                  </div>
                ) : userRole === 'admin' && connectedAccounts.filter(acc => acc.account_type === 'email').length === 0 ? (
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
                    showCheckboxes={showCheckboxes}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Email View - Takes remaining space */}
          <div 
            className={cn(
              "flex-1 min-w-0 h-full overflow-hidden bg-background relative transition-all duration-300",
              isProfileOpen && "pr-[360px]"
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
                    is_read: selectedConv.is_read,
                    // ✅ MINIMAL FIX: Pass preview for fallback, but EmailView will use messages for body
                    preview: (selectedConv as any).preview || '',
                    email_timestamp: (selectedConv as any).emailTimestamp || (selectedConv as any).email_timestamp || selectedConv.last_message_at,
                    received_account: (selectedConv as any).received_account || (selectedConv as any).receivedAccount || null,
                    email_folder: (selectedConv as any).email_folder || (selectedConv as any).emailFolder || null,
                    derived_folder: (selectedConv as any).derived_folder || (selectedConv as any).derivedFolder || null,
                    folder_name: (selectedConv as any).folder_name || (selectedConv as any).folderName || null,
                    folder_sender_name: (selectedConv as any).folder_sender_name || (selectedConv as any).folderSenderName || null,
                    folder_sender_email: (selectedConv as any).folder_sender_email || (selectedConv as any).folderSenderEmail || null,
                    folder_is_from_lead: (selectedConv as any).folder_is_from_lead ?? (selectedConv as any).folderIsFromLead ?? null,
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
              isProfileOpen ? "translate-x-0 w-[340px]" : "translate-x-[calc(100%-20px)] w-[340px]"
            )}
          >
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className={cn(
                "absolute left-0 top-6 -translate-x-full z-30",
                "flex items-center justify-center w-6 h-10 rounded-l-lg border border-slate-200 bg-white shadow-md",
                "hover:bg-slate-50 transition-colors"
              )}
              title={isProfileOpen ? "Collapse lead profile" : "Expand lead profile"}
            >
              <PanelLeft
                className={cn(
                  "h-4 w-4 text-slate-600 transition-transform duration-200",
                  isProfileOpen ? "rotate-180" : "rotate-0"
                )}
              />
            </button>
            {/* Drawer Content */}
            <div className="h-full relative flex flex-col overflow-hidden">
              <div
                className={cn(
                  "absolute inset-0 bg-card transition-opacity duration-200 pointer-events-none",
                  isProfileOpen ? "opacity-0" : "opacity-100"
                )}
              />
              <div
                className={cn(
                  "h-full flex flex-col transition-opacity duration-200",
                  !isProfileOpen && "opacity-0 pointer-events-none"
                )}
              >
                {/* Drawer Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 flex-shrink-0">
                  <h3 className="font-semibold text-base text-foreground">Lead Profile</h3>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 hover:bg-muted/50"
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                  >
                    {isProfileOpen ? (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                
                {/* Drawer Body */}
                <div className="flex-1 overflow-y-auto overscroll-contain">
                  {selectedConv && leadData ? (
                    <LeadProfilePanel 
                      lead={leadData} 
                      timeline={timeline}
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
      </div>
    </AppLayout>
  );
}
