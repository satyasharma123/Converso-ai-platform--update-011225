import { AppLayout } from "@/components/Layout/AppLayout";
import { LinkedInConversationList } from "@/components/Inbox/LinkedInConversationList";
import { ConversationView } from "@/components/Inbox/ConversationView";
import { useState, useCallback, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Search, Filter, Tag, Send, Archive, RefreshCcw } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { LeadProfilePanel } from "@/components/Inbox/LeadProfilePanel";
import { ConnectedAccountFilter } from "@/components/Inbox/ConnectedAccountFilter";
import { useConversations, useToggleRead } from "@/hooks/useConversations";
import { useMessages } from "@/hooks/useMessages";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export default function LinkedInInbox() {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [accountFilter, setAccountFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConversations, setSelectedConversations] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('all');
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  
  const { user, userRole } = useAuth();
  const { data: userProfile } = useProfile();
  const { data: teamMembers = [] } = useTeamMembers();
  const { data: conversations = [], isLoading } = useConversations('linkedin');
  const toggleRead = useToggleRead();
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

    return {
      ...conv,
      senderName: conv.senderName || conv.sender_name,
      senderEmail: conv.senderEmail || conv.sender_email,
      type: conv.type || conv.conversation_type,
      isRead,
    };
  });

  const currentUserMember = teamMembers.find(m => m.id === user?.id);
  const userDisplayName = userProfile?.full_name || currentUserMember?.full_name || user?.email || "User";

  // Live updates via SSE for new LinkedIn messages
  useEffect(() => {
    const base = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const es = new EventSource(`${base}/api/events/stream`);

    const handler = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
        if (data?.conversation_id) {
          queryClient.invalidateQueries({ queryKey: ['messages', data.conversation_id] });
        }
      } catch {
        // ignore parse errors
      }
    };

    es.addEventListener('linkedin_message', handler);

    es.onerror = () => {
      // connection errors: allow browser to retry automatically
    };

    return () => {
      es.removeEventListener('linkedin_message', handler);
      es.close();
    };
  }, [queryClient]);

  // Handle conversation click - select and mark as read if unread
  const handleConversationClick = useCallback((conversationId: string) => {
    setSelectedConversation(conversationId);
    
    // Find the conversation and mark as read if it's unread
    const conv = normalizedConversations.find(c => c.id === conversationId);
    if (conv) {
      if (!conv.isRead) {
        toggleRead.mutate({ conversationId, isRead: true });
      }
    }
  }, [normalizedConversations, toggleRead]);

  const handleManualRefresh = useCallback(async () => {
    setIsManualRefreshing(true);
    try {
      // Get workspace ID
      const workspaceId = userProfile?.workspace_id || (user as any)?.workspace_id;
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

  // Calculate unread count
  const unreadCount = normalizedConversations.filter(conv => !conv.isRead).length;

  // Apply filters
  const filteredConversations = normalizedConversations
    .filter(conv => {
      // SDR role filtering is handled by backend service
      const matchesAccount = accountFilter === 'all' || 
        conv.received_account?.account_name === accountFilter;
      
      const senderName = conv.senderName || '';
      const matchesSearch = searchQuery === '' || 
        senderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conv.subject?.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Tab filtering
      const isUnread = !conv.isRead;
      const matchesTab = 
        activeTab === 'all' ? true :
        activeTab === 'unread' ? isUnread :
        activeTab === 'favorites' ? false : // Favorites not yet implemented
        true;
      
      return matchesAccount && matchesSearch && matchesTab;
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
    email: (selectedConv as any).senderEmail || (selectedConv as any).sender_email || '',
    profilePictureUrl: (selectedConv as any).sender_profile_picture_url,
    linkedinUrl: (selectedConv as any).sender_linkedin_url,
    company: "TechCorp Inc",
    dealSize: "$50k",
    stage: selectedConv.status,
    engagementScore: 85,
    lastResponseTime: "2 hours ago",
    messageCount: dedupedMessagesForSelected.length,
  } : null;

  return (
    <AppLayout role={userRole} userName={userDisplayName}>
      <div className="flex flex-col lg:flex-row gap-2 h-[calc(100vh-120px)]">
        <div className="overflow-hidden flex flex-col lg:w-[28%]">
          <div className="space-y-2 mb-3">
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
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs px-3 py-1.5"
                >
                  Favorites
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
              <Button variant="outline" size="icon" className="h-8 w-8">
                <Filter className="h-3.5 w-3.5" />
              </Button>
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
                <div className="flex items-center gap-0.5">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7"
                    onClick={() => toast.info('Tag feature coming soon')}
                  >
                    <Tag className="h-3.5 w-3.5" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7"
                    onClick={() => toast.info('Bulk send feature coming soon')}
                  >
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7"
                    onClick={() => toast.info('Archive feature coming soon')}
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </Button>
                </div>
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
                  <p className="text-sm text-muted-foreground mb-2">No conversations found</p>
                  <p className="text-xs text-muted-foreground">The database is empty. Please seed the database.</p>
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

        <div className="overflow-hidden flex flex-col lg:w-[52%]">
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
                    unipile_account_id: selectedConv.received_account?.unipile_account_id,
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

        <div className="lg:w-[20%] overflow-y-auto flex flex-col">
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
