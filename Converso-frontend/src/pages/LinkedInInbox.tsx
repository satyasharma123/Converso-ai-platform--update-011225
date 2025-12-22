import { AppLayout } from "@/components/Layout/AppLayout";
import { LinkedInConversationList } from "@/components/Inbox/LinkedInConversationList";
import { ConversationView } from "@/components/Inbox/ConversationView";
import { BulkActions } from "@/components/Inbox/BulkActions";
import { useState, useCallback, useEffect, useMemo } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Search, Filter, RefreshCcw, X } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { LeadProfilePanel } from "@/components/Inbox/LeadProfilePanel";
import { ConnectedAccountFilter } from "@/components/Inbox/ConnectedAccountFilter";
import { useConversations, useToggleRead, useAssignConversation, useUpdateConversationStage, useToggleFavoriteConversation, useDeleteConversation } from "@/hooks/useConversations";
import { useMessages } from "@/hooks/useMessages";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useUrlState } from "@/hooks/useUrlState";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function LinkedInInbox() {
  const location = useLocation();
  const { conversationId } = useParams();
  const navigate = useNavigate();
  
  // URL state management for filters
  const urlState = useUrlState<{
    tab: string;
    account: string;
    q: string;
  }>();
  
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [accountFilter, setAccountFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedConversations, setSelectedConversations] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('all');
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterState, setFilterState] = useState<{ sdr: string; stage: string }>({
    sdr: 'all',
    stage: 'all',
  });
  
  const { user, userRole } = useAuth();

  const activeFilterCount =
    (filterState.sdr !== 'all' ? 1 : 0) +
    (filterState.stage !== 'all' ? 1 : 0);

  const handleFilterChange = (key: 'sdr' | 'stage', value: string) => {
    setFilterState((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  const clearFilters = () => {
    setFilterState({ sdr: 'all', stage: 'all' });
  };
  
  // Hydrate filters from URL on mount (once)
  useEffect(() => {
    setActiveTab(urlState.get("tab", "all"));
    setAccountFilter(urlState.get("account", "all"));
    const urlSearch = urlState.get("q", "");
    setSearchQuery(urlSearch);
    setDebouncedSearch(urlSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  // Sync UI state -> URL (non-default values only)
  useEffect(() => {
    urlState.set({
      tab: activeTab !== "all" ? activeTab : undefined,
      account: accountFilter !== "all" ? accountFilter : undefined,
      q: debouncedSearch || undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, accountFilter, debouncedSearch]);
  
  // Sync URL conversationId -> state
  useEffect(() => {
    setSelectedConversation(conversationId || null);
  }, [conversationId]);
  
  // Handle navigation from Sales Pipeline (preserve existing behavior)
  // Priority: URL conversationId > location.state > null
  useEffect(() => {
    if (!conversationId && location.state?.selectedConversationId) {
      const convId = location.state.selectedConversationId;
      setSelectedConversation(convId);
      navigate(`/inbox/linkedin/${convId}`, { replace: true });
      window.history.replaceState({}, document.title);
    }
  }, [conversationId, location.state, navigate]);
  const { data: userProfile } = useProfile();
  const { data: teamMembers = [] } = useTeamMembers();
  const { data: pipelineStages = [] } = usePipelineStages();
  const { data: conversations = [], isLoading } = useConversations('linkedin');
  const toggleRead = useToggleRead();
  const assignConversation = useAssignConversation();
  const updateStage = useUpdateConversationStage();
  const toggleFavoriteConversation = useToggleFavoriteConversation();
  const deleteConversation = useDeleteConversation();
  const queryClient = useQueryClient();
  
  const parseBoolean = (value: any) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    if (typeof value === 'number') return value === 1;
    return Boolean(value);
  };

  const normalizedConversations = conversations.map((conv: any) => {
    const rawIsRead = conv.isRead ?? conv.is_read;
    const isRead = rawIsRead === undefined ? true : parseBoolean(rawIsRead);
    
    // Use backend-calculated unread_count (from database trigger)
    // This gives us the actual count of unread messages from leads
    const unreadCount =
      conv.unreadCount ??
      conv.unread_count ??
      // Fallback: if no count available and conversation is unread, show 1
      (isRead ? 0 : 1);

    return {
      ...conv,
      senderName: conv.senderName || conv.sender_name,
      senderEmail: conv.senderEmail || conv.sender_email,
      type: conv.type || conv.conversation_type,
      isRead,
      unreadCount,
    };
  });

  const currentUserMember = teamMembers.find(m => m.id === user?.id);
  const userDisplayName = userProfile?.full_name || currentUserMember?.full_name || user?.email || "User";

  // Live updates via SSE for new LinkedIn messages
  const bumpUnread = useCallback(
    (conversationId: string, timestamp?: string, content?: string) => {
      queryClient.setQueriesData(
        { queryKey: ['conversations'] },
        (oldData: any) => {
          if (!Array.isArray(oldData)) return oldData;
          
          // Update the conversation with new unread count and timestamp
          const updatedData = oldData.map((conv: any) => {
            if (conv.id !== conversationId) return conv;
            const currentUnread =
              conv.unreadCount ??
              conv.unread_count ??
              (conv.isRead ?? conv.is_read ? 0 : 0);
            return {
              ...conv,
              is_read: false,
              isRead: false,
              // Increment the unread count optimistically
              // The actual count will be updated when the query refetches from backend
              unreadCount: (currentUnread || 0) + 1,
              unread_count: (currentUnread || 0) + 1,
              // Update last_message_at to current time for proper sorting
              last_message_at: timestamp || new Date().toISOString(),
              lastMessageAt: timestamp || new Date().toISOString(),
              // Update preview with latest message content
              preview: content || conv.preview,
              // Track who sent the last message (true = from lead, false = from you)
              last_message_from_lead: true,
            };
          });
          
          // Sort by last_message_at descending (newest first)
          return updatedData.sort((a: any, b: any) => {
            const aTime = new Date(a.last_message_at || a.lastMessageAt || 0).getTime();
            const bTime = new Date(b.last_message_at || b.lastMessageAt || 0).getTime();
            return bTime - aTime; // Descending order
          });
        }
      );
    },
    [queryClient]
  );

  const markReadLocally = useCallback(
    (conversationId: string) => {
      queryClient.setQueriesData(
        { queryKey: ['conversations'] },
        (oldData: any) => {
          if (!Array.isArray(oldData)) return oldData;
          return oldData.map((conv: any) =>
            conv.id === conversationId
              ? {
                  ...conv,
                  is_read: true,
                  isRead: true,
                  unreadCount: 0,
                }
              : conv
          );
        }
      );
    },
    [queryClient]
  );

  useEffect(() => {
    const base = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const es = new EventSource(`${base}/api/events/stream`);

    const handler = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[SSE] Received linkedin_message event:', data);
        
        if (data?.conversation_id) {
          // Only bump unread count if the message is from the lead (not from you)
          // This prevents the badge from appearing when you send a reply
          if (data.is_from_lead !== false) {
            // If is_from_lead is true or undefined (for backwards compatibility), bump unread
            bumpUnread(data.conversation_id, data.timestamp, data.content);
          } else {
            // Even if it's your own message, update the timestamp and preview to move conversation to top
            queryClient.setQueriesData(
              { queryKey: ['conversations'] },
              (oldData: any) => {
                if (!Array.isArray(oldData)) return oldData;
                
                const updatedData = oldData.map((conv: any) => {
                  if (conv.id !== data.conversation_id) return conv;
                  return {
                    ...conv,
                    last_message_at: data.timestamp || new Date().toISOString(),
                    lastMessageAt: data.timestamp || new Date().toISOString(),
                    preview: data.content || conv.preview,
                    // Track who sent the last message (false = from you when is_from_lead is false)
                    last_message_from_lead: false,
                  };
                });
                
                // Sort by last_message_at descending (newest first)
                return updatedData.sort((a: any, b: any) => {
                  const aTime = new Date(a.last_message_at || a.lastMessageAt || 0).getTime();
                  const bTime = new Date(b.last_message_at || b.lastMessageAt || 0).getTime();
                  return bTime - aTime;
                });
              }
            );
          }
          
          // Always invalidate queries to refresh the conversation list and messages
          queryClient.invalidateQueries({
            predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'conversations',
          });
          
          // Invalidate messages for this conversation
          queryClient.invalidateQueries({ queryKey: ['messages', data.conversation_id] });
        }
      } catch (err) {
        console.error('[SSE] Failed to parse event:', err);
      }
    };

    es.addEventListener('linkedin_message', handler);

    es.onopen = () => {
      console.log('[SSE] Connection established');
    };

    es.onerror = (err) => {
      console.error('[SSE] Connection error:', err);
    };

    return () => {
      es.removeEventListener('linkedin_message', handler);
      es.close();
    };
  }, [bumpUnread, queryClient]);

  // Handle conversation click - select and mark as read if unread
  const handleConversationClick = useCallback(
    async (conversationId: string) => {
      setSelectedConversation(conversationId);
      navigate(`/inbox/linkedin/${conversationId}`);

      // Find the conversation and mark as read if it's unread
      const conv = normalizedConversations.find((c) => c.id === conversationId);
      if (conv) {
        if (!conv.isRead) {
          markReadLocally(conversationId);
          toggleRead.mutate({ conversationId, isRead: true });
        } else {
          // Ensure local unread counter clears even if backend already thinks it's read
          markReadLocally(conversationId);
        }
      }

      // Force-refresh messages for the selected conversation (WhatsApp-style)
      await queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
    },
    [markReadLocally, navigate, normalizedConversations, queryClient, toggleRead]
  );

  const handleManualRefresh = useCallback(async () => {
    setIsManualRefreshing(true);
    try {
      // Get workspace ID
      const workspaceId = (userProfile as any)?.workspace_id || (user as any)?.workspace_id;
      if (!workspaceId) {
        toast.error('Workspace not found');
        return;
      }

      // Get all LinkedIn accounts for this workspace (prefer workspace-based endpoint)
      const base = import.meta.env.VITE_API_URL || 'http://localhost:3001';

      // Try workspace-based list first
      let linkedInAccounts: any[] = [];
      try {
        const wsRes = await fetch(`${base}/api/linkedin/accounts?workspace_id=${workspaceId}`);
        const wsData = await wsRes.json();
        linkedInAccounts = (wsData.accounts || []).filter((acc: any) => acc.account_type === 'linkedin' && acc.is_active);
      } catch (err) {
        console.error('Workspace accounts fetch failed, falling back to user-based', err);
      }

      // Fallback to user-based connected-accounts if workspace query returned nothing
      if (linkedInAccounts.length === 0) {
        const accountsRes = await fetch(`${base}/api/connected-accounts?userId=${user?.id}`);
        const accountsData = await accountsRes.json();
        linkedInAccounts = (accountsData.data || []).filter((acc: any) => acc.account_type === 'linkedin' && acc.is_active);
      }

      if (linkedInAccounts.length === 0) {
        toast.error('No LinkedIn accounts connected');
        return;
      }

      toast.info('Starting LinkedIn sync...');

      // Trigger sync for each LinkedIn account
      let successCount = 0;
      for (const account of linkedInAccounts) {
        try {
          const syncRes = await fetch(`${base}/api/linkedin/accounts/${account.id}/initial-sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          
          if (syncRes.ok) {
            successCount++;
          } else {
            const errorData = await syncRes.json();
            console.error('Sync failed for account', account.id, errorData);
          }
        } catch (err) {
          console.error('Sync error for account', account.id, err);
        }
      }

      // Refresh data
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
      if (selectedConversation) {
        await queryClient.invalidateQueries({ queryKey: ['messages', selectedConversation] });
      }

      if (successCount > 0) {
        toast.success(`Synced ${successCount} LinkedIn account(s)`);
      } else {
        toast.error('Sync failed. Check console for details.');
      }
    } catch (err) {
      console.error('Manual refresh error', err);
      toast.error('Failed to sync LinkedIn accounts');
    } finally {
      setIsManualRefreshing(false);
    }
  }, [queryClient, selectedConversation, user, userProfile]);

  // Calculate unread count and favorites count
  const unreadCount = normalizedConversations.filter(conv => !conv.isRead).length;
  const favoritesCount = normalizedConversations.filter(conv => 
    Boolean((conv as any).is_favorite ?? (conv as any).isFavorite)
  ).length;

  // Apply filters and sort by last_message_at
  const filteredConversations = normalizedConversations
    .filter(conv => {
      // Account filter
      const accountId =
        (conv as any).received_on_account_id ||
        (conv as any).receivedOnAccountId ||
        (conv as any).received_account?.id;
      const matchesAccount = accountFilter === 'all' || 
        accountId === accountFilter;
      
      // Search filter
      const senderName = conv.senderName || '';
      const matchesSearch = searchQuery === '' || 
        senderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conv.subject?.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Tab filtering
      const isUnread = !conv.isRead;
      const isFavorite = Boolean((conv as any).is_favorite ?? (conv as any).isFavorite);
      const matchesTab = 
        activeTab === 'all' ? true :
        activeTab === 'unread' ? isUnread :
        activeTab === 'favorites' ? isFavorite :
        true;
      
      // Stage filter
      const convStageId = (conv as any).customStageId || (conv as any).custom_stage_id;
      const matchesStage = filterState.stage === 'all' || convStageId === filterState.stage;
      
      // SDR filter
      const convSdrId = (conv as any).assignedTo || (conv as any).assigned_to;
      const matchesSDR = 
        filterState.sdr === 'all' ? true :
        filterState.sdr === 'unassigned' ? !convSdrId :
        convSdrId === filterState.sdr;
      
      return matchesAccount && matchesSearch && matchesTab && matchesStage && matchesSDR;
    })
    .sort((a, b) => {
      // Sort by last_message_at descending (newest first)
      const aTime = new Date(a.last_message_at || a.lastMessageAt || 0).getTime();
      const bTime = new Date(b.last_message_at || b.lastMessageAt || 0).getTime();
      return bTime - aTime;
    })
    .map(conv => ({
      ...conv,
      selected: selectedConversations.includes(conv.id),
    }));

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
        toggleRead.mutate({ conversationId: id, isRead: true });
      }
    });
    setSelectedConversations([]);
  };

  const handleBulkMarkUnread = () => {
    selectedConversations.forEach(id => {
      const conv = conversations.find(c => c.id === id);
      if (conv && (conv.is_read || (conv as any).isRead)) {
        toggleRead.mutate({ conversationId: id, isRead: false });
      }
    });
    setSelectedConversations([]);
  };

  const handleBulkAssignSDR = (sdrId: string | null) => {
    selectedConversations.forEach(id => {
      assignConversation.mutate({ conversationId: id, sdrId });
    });
    setSelectedConversations([]);
  };

  const handleBulkChangeStage = (stageId: string) => {
    selectedConversations.forEach(id => {
      updateStage.mutate({ conversationId: id, stageId });
    });
    setSelectedConversations([]);
  };

  const handleBulkArchive = () => {
    toast.info('Bulk archive feature coming soon');
    setSelectedConversations([]);
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

    const confirmed = window.confirm('Delete selected conversations? This cannot be undone.');
    if (!confirmed) return;

    await Promise.all(selectedConversations.map(id => deleteConversation.mutateAsync(id)));
    setSelectedConversations([]);
    toast.success('Conversations deleted successfully');
  };

  const selectedConv = normalizedConversations.find((c) => c.id === selectedConversation);
  const { data: messagesForSelected = [] } = useMessages(selectedConversation);
  const dedupedMessagesForSelected = useMemo(() => {
    const seen = new Set<string>();
    const unique: typeof messagesForSelected = [];
    for (const msg of messagesForSelected) {
      const rawKey =
        (msg as any).linkedin_message_id ||
        (msg as any).linkedinMessageId ||
        (msg as any).id ||
        null;

      const fallbackKey = [
        (msg as any).content ?? '',
        (msg as any).created_at || (msg as any).timestamp || '',
        String((msg as any).is_from_lead ?? (msg as any).isFromLead ?? ''),
      ].join('|');

      const key = rawKey || fallbackKey;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      unique.push(msg);
    }
    return unique;
  }, [messagesForSelected]);

  const mockLead = selectedConv ? {
    name: (selectedConv as any).senderName || (selectedConv as any).sender_name || 'Unknown',
    email: (selectedConv as any).senderEmail || (selectedConv as any).sender_email,
    mobile: (selectedConv as any).mobile || null,
    profilePictureUrl: (selectedConv as any).sender_profile_picture_url,
    linkedinUrl: (selectedConv as any).sender_linkedin_url,
    company: (selectedConv as any).company_name || "TechCorp Inc",
    location: (selectedConv as any).location,
    stage: pipelineStages.find(s => s.id === (selectedConv as any).customStageId || (selectedConv as any).custom_stage_id)?.name,
    stageId: (selectedConv as any).customStageId || (selectedConv as any).custom_stage_id,
    score: Math.min(100, messagesForSelected?.length * 10 || 0),
    source: 'LinkedIn',
    channel: 'LinkedIn',
    lastMessageAt: messagesForSelected?.length
      ? messagesForSelected[messagesForSelected.length - 1]?.created_at || null
      : null,
    assignedTo: teamMembers.find(m => m.id === (selectedConv as any).assignedTo || (selectedConv as any).assigned_to)?.full_name,
    assignedToId: (selectedConv as any).assignedTo || (selectedConv as any).assigned_to,
  } : null;

  return (
    <AppLayout role={userRole} userName={userDisplayName}>
      <div className="flex flex-col lg:flex-row gap-2 h-[calc(100vh-120px)]">
        <div className="overflow-hidden flex flex-col lg:w-[27%]">
          <div className="sticky top-0 z-10 bg-background space-y-2 mb-3">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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
              type="linkedin"
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
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={handleManualRefresh}
                disabled={isManualRefreshing}
                title="Refresh conversations"
              >
                <RefreshCcw className={`h-3.5 w-3.5 ${isManualRefreshing ? 'animate-spin' : ''}`} />
              </Button>
              <Popover open={filterOpen} onOpenChange={setFilterOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8 flex-shrink-0 relative overflow-visible">
                    <Filter className="h-3.5 w-3.5" />
                    {activeFilterCount > 0 && (
                      <Badge className="absolute -top-1.5 -right-1.5 text-[10px] px-1.5 py-0.5 min-w-[18px] h-[18px] flex items-center justify-center leading-none">
                        {activeFilterCount}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 space-y-4" align="end">
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
                            {member.full_name || member.email}
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
                        {pipelineStages.map(stage => (
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
                    <Button size="sm" className="text-xs" onClick={() => setFilterOpen(false)}>
                      Apply
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 pl-2">
                <Checkbox 
                  className="h-3.5 w-3.5" 
                  checked={selectedConversations.length === filteredConversations.length && filteredConversations.length > 0}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-xs">
                  {selectedConversations.length > 0 
                    ? `${selectedConversations.length} Selected` 
                    : 'Select all'}
                </span>
              </div>
              {selectedConversations.length > 0 && (
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
              )}
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <div className="h-full overflow-y-auto bg-background rounded-lg border">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-muted-foreground">Loading conversations...</p>
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <p className="text-sm text-muted-foreground mb-2">
                    {userRole === 'sdr' ? 'No Assigned Conversations' : 'No conversations found'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {userRole === 'sdr' 
                      ? 'You don\'t have any LinkedIn conversations assigned to you yet.'
                      : 'The database is empty. Please seed the database.'}
                  </p>
                </div>
              ) : (
                <LinkedInConversationList
                  conversations={filteredConversations}
                  onConversationClick={handleConversationClick}
                  selectedId={selectedConversation || undefined}
                  onToggleSelect={handleToggleSelect}
                />
              )}
            </div>
          </div>
        </div>

        <div className="overflow-hidden flex flex-col lg:w-[49%]">
            {selectedConv ? (
              <div className="h-full bg-background rounded-lg border">
                <ConversationView 
                  conversation={{
                    id: selectedConv.id,
                    senderName: (selectedConv as any).senderName || (selectedConv as any).sender_name || 'Unknown',
                    senderEmail: (selectedConv as any).senderEmail || (selectedConv as any).sender_email,
                    status: selectedConv.status,
                    sender_profile_picture_url: (selectedConv as any).sender_profile_picture_url,
                    sender_linkedin_url: (selectedConv as any).sender_linkedin_url,
                    account_name: (selectedConv as any).account_name,
                    is_account_connected: (selectedConv as any).is_account_connected,
                    is_read: (selectedConv as any).isRead ?? (selectedConv as any).is_read ?? true,
                    assignedTo: (selectedConv as any).assignedTo || (selectedConv as any).assigned_to,
                    customStageId: (selectedConv as any).customStageId || (selectedConv as any).custom_stage_id,
                    chat_id: (selectedConv as any).chat_id,
                    received_on_account_id: (selectedConv as any).received_on_account_id || (selectedConv as any).receivedOnAccountId,
                    is_favorite: (selectedConv as any).is_favorite,
                    isFavorite: (selectedConv as any).isFavorite,
                  }} 
                  messages={dedupedMessagesForSelected.map(msg => {
                    const rawIsFromLead = (msg as any).isFromLead ?? (msg as any).is_from_lead;
                    const fallbackSender = (msg as any).senderName || (msg as any).sender_name;
                    const isFromLead = typeof rawIsFromLead === 'boolean'
                      ? rawIsFromLead
                      : (fallbackSender ? fallbackSender.toLowerCase() !== 'you' : true);

                    const senderName = isFromLead 
                      ? ((selectedConv as any).senderName || (selectedConv as any).sender_name || 'Unknown')
                      : 'You';

                    const deliveryStatus = isFromLead
                      ? undefined
                      : ((msg as any).deliveryStatus as 'sending' | 'sent' | 'delivered') ?? 'delivered';
                    
                    return {
                      ...msg,
                      senderName,
                      senderProfilePictureUrl:
                        (msg as any).senderProfilePictureUrl ||
                        (msg as any).sender_profile_picture_url ||
                        (selectedConv as any).sender_profile_picture_url,
                      senderLinkedinUrl:
                        (msg as any).senderLinkedinUrl ||
                        (msg as any).sender_linkedin_url ||
                        (selectedConv as any).sender_linkedin_url,
                      timestamp: (msg as any).timestamp || (msg as any).created_at || '',
                      isFromLead,
                      deliveryStatus,
                    };
                  })}
                />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground bg-background rounded-lg border">
                Select a conversation to view
              </div>
            )}
          </div>

        <div className="lg:w-[24%] overflow-y-auto flex flex-col">
          {selectedConv && mockLead && (
            <LeadProfilePanel 
              lead={mockLead}
              conversationId={selectedConv.id}
            />
          )}
        </div>
      </div>
    </AppLayout>
  );
}
