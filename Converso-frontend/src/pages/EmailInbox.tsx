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
import { useAuth } from "@/hooks/useAuth";
import { LeadProfilePanel } from "@/components/Inbox/LeadProfilePanel";
import { useConversations } from "@/hooks/useConversations";
import { ConnectedAccountFilter } from "@/components/Inbox/ConnectedAccountFilter";
import { toast } from "sonner";
import { useAssignConversation, useUpdateConversationStage, useToggleRead } from "@/hooks/useConversations";
import { useMessages } from "@/hooks/useMessages";
import { useEmailSyncStatus, useInitEmailSync } from "@/hooks/useEmailSync";
import { useConnectedAccounts } from "@/hooks/useConnectedAccounts";
import { useWorkspace } from "@/hooks/useWorkspace";
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

  // Apply filters
  const filteredConversations = conversations
    .filter(conv => {
      // Fix filter logic to use ID if available, fallback to name for robustness
      const accountId = (conv as any).received_on_account_id || (conv as any).receivedAccount?.id;
      const matchesAccount = accountFilter === 'all' || 
        accountId === accountFilter ||
        conv.received_account?.account_name === accountFilter;

      const matchesSearch = searchQuery === '' || 
        (conv.sender_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        conv.subject?.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesAccount && matchesSearch;
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

  const handleBulkDelete = () => {
    toast.info('Bulk delete feature coming soon');
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
        {/* Sync Progress Banner */}
        {isAnySyncInProgress && (
          <div className="bg-blue-50 dark:bg-blue-950 border-b border-blue-200 dark:border-blue-800 px-4 py-2 flex-shrink-0">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
              <span className="font-medium text-blue-700 dark:text-blue-300">🔄 Email sync in progress...</span>
              <span className="text-xs text-muted-foreground ml-2">
                Syncing: {syncStatuses.filter((s: any) => s.status === 'in_progress').map((s: any) => s.accountName).join(', ')}
              </span>
            </div>
          </div>
        )}
        
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
                <EmailSidebar onFolderChange={setSelectedFolder} isCollapsed={isSidebarCollapsed} />
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
                <Tabs defaultValue="all" className="w-full">
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
                  <Button variant="outline" size="icon" className="h-8 w-8 flex-shrink-0">
                    <Filter className="h-3.5 w-3.5" />
                  </Button>
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
          <div className="flex-1 min-w-0 h-full overflow-hidden bg-background relative">
            {selectedConv ? (
              <div className="h-full flex flex-col">
                <EmailView 
                  conversation={{
                    id: selectedConv.id,
                    senderName: (selectedConv as any).senderName || selectedConv.sender_name || '',
                    senderEmail: (selectedConv as any).senderEmail || selectedConv.sender_email || '',
                    subject: selectedConv.subject || '',
                    status: selectedConv.status,
                    assigned_to: selectedConv.assigned_to,
                    custom_stage_id: selectedConv.custom_stage_id,
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

            {/* Toggle Button for Profile Drawer - Moved to top-right */}
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className={cn(
                "absolute top-4 z-30 flex items-center justify-center",
                "w-8 h-8 bg-card border rounded-l-lg shadow-md",
                "hover:bg-accent transition-colors",
                isProfileOpen ? "right-[340px] border-r-0" : "right-0"
              )}
              title={isProfileOpen ? "Close profile" : "Open profile"}
            >
              {isProfileOpen ? (
                <PanelRightClose className="h-4 w-4 text-muted-foreground" />
              ) : (
                <PanelRightOpen className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </div>

          {/* Right Profile Drawer - Slides in/out */}
          <div 
            className={cn(
              "absolute top-0 right-0 h-full bg-card border-l shadow-lg transition-transform duration-300 ease-in-out z-20",
              isProfileOpen ? "translate-x-0" : "translate-x-full"
            )}
            style={{ width: '340px' }}
          >
            {/* Drawer Content */}
            <div className="h-full flex flex-col">
              {/* Drawer Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 flex-shrink-0">
                <h3 className="font-semibold text-sm text-foreground">Lead Profile</h3>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 hover:bg-muted/50"
                  onClick={() => setIsProfileOpen(false)}
                >
                  <PanelRightClose className="h-4 w-4 text-muted-foreground" />
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
                  <div className="flex flex-col items-center justify-center h-full text-center p-4">
                    <User className="h-12 w-12 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">No lead selected</p>
                    <p className="text-xs text-muted-foreground mt-1">Select an email to view lead details</p>
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
