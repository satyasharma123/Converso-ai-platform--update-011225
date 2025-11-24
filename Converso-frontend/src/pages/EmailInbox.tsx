import { AppLayout } from "@/components/Layout/AppLayout";
import { ConversationList } from "@/components/Inbox/ConversationList";
import { EmailView } from "@/components/Inbox/EmailView";
import { EmailSidebar } from "@/components/Inbox/EmailSidebar";
import { BulkActions } from "@/components/Inbox/BulkActions";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, Filter, ChevronLeft, ChevronRight } from "lucide-react";
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

export default function EmailInbox() {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [accountFilter, setAccountFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConversations, setSelectedConversations] = useState<string[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState('inbox');
  
  const { user, userRole } = useAuth();
  const { data: conversations = [], isLoading } = useConversations('email');
  const assignConversation = useAssignConversation();
  const updateStage = useUpdateConversationStage();
  const toggleRead = useToggleRead();

  // Apply filters
  const filteredConversations = conversations
    .filter(conv => {
      // SDR role filtering is handled by backend service
      const matchesAccount = accountFilter === 'all' || 
        conv.received_account?.account_name === accountFilter;
      const matchesSearch = searchQuery === '' || 
        (conv.senderName || conv.sender_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
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
      if (conv && !conv.isRead) {
        toggleRead.mutate({ conversationId: id, isRead: false });
      }
    });
  };

  const handleBulkMarkUnread = () => {
    selectedConversations.forEach(id => {
      const conv = conversations.find(c => c.id === id);
      if (conv && conv.isRead) {
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
    name: selectedConv.senderName || selectedConv.sender_name,
    email: selectedConv.senderEmail || selectedConv.sender_email,
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

  return (
    <AppLayout role={userRole} userName={user?.email}>
      <div className="flex gap-3 h-[calc(100vh-120px)] overflow-x-hidden">
        {/* Email Sidebar - 15% width */}
        <div className={`${sidebarCollapsed ? 'w-12' : 'w-[15%] min-w-[180px]'} transition-all duration-300 flex-shrink-0 relative`}>
          <div className="h-full flex">
            <div className={`${sidebarCollapsed ? 'w-0 opacity-0' : 'flex-1'} transition-all duration-300 overflow-hidden`}>
              <div className="h-full rounded-lg border bg-background">
                <EmailSidebar onFolderChange={setSelectedFolder} />
              </div>
            </div>
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="group absolute top-2 -right-3 z-10 h-10 w-6 flex items-center justify-center bg-background hover:bg-muted border rounded-md shadow-sm transition-all"
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="h-4 w-4 text-foreground" />
              ) : (
                <ChevronLeft className="h-4 w-4 text-foreground" />
              )}
            </button>
          </div>
        </div>

        {/* Conversation List - 25% width */}
        <div className="w-[25%] min-w-[280px] flex-shrink-0 overflow-hidden flex flex-col">
          <div className="space-y-2 mb-3">
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
              <Button variant="outline" size="icon" className="h-8 w-8">
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
                  <p className="text-xs text-muted-foreground mt-2">See QUICK_SEED.sql in the project root.</p>
                </div>
              ) : (
                <ConversationList
                  conversations={filteredConversations}
                  onConversationClick={setSelectedConversation}
                  selectedId={selectedConversation || undefined}
                  onToggleSelect={handleToggleSelect}
                />
              )}
            </div>
          </div>
        </div>

        {/* Email View & Lead Profile - combined */}
        <div className="flex-1 min-w-0 flex gap-3 overflow-hidden">
          {/* Email View */}
          <div className="flex-[3] min-w-0 overflow-hidden flex flex-col">
            {selectedConv ? (
              <div className="h-full bg-background rounded-lg border flex flex-col">
                <EmailView 
                  conversation={{
                    id: selectedConv.id,
                    senderName: selectedConv.senderName,
                    senderEmail: selectedConv.senderEmail,
                    subject: selectedConv.subject,
                    status: selectedConv.status,
                  }} 
                  messages={messagesForSelected}
                />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground bg-background rounded-lg border">
                Select an email to view
              </div>
            )}
          </div>

          {/* Lead Profile Panel */}
          <div className="flex-[2] min-w-[280px] max-w-[320px] overflow-y-auto flex flex-col py-6 pr-4">
            {selectedConv && mockLead && (
               <LeadProfilePanel 
                lead={mockLead} 
                timeline={mockTimeline}
                conversationId={selectedConv.id}
              />
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
