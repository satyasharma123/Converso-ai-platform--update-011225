import { AppLayout } from "@/components/Layout/AppLayout";
import { ConversationList } from "@/components/Inbox/ConversationList";
import { ConversationView } from "@/components/Inbox/ConversationView";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, Filter, Tag, Send, Archive } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { LeadProfilePanel } from "@/components/Inbox/LeadProfilePanel";
import { useConversations } from "@/hooks/useConversations";
import { ConnectedAccountFilter } from "@/components/Inbox/ConnectedAccountFilter";
import { useMessages } from "@/hooks/useMessages";

export default function LinkedInInbox() {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [accountFilter, setAccountFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConversations, setSelectedConversations] = useState<string[]>([]);
  
  const { user, userRole } = useAuth();
  const { data: conversations = [], isLoading } = useConversations('linkedin');

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

  const selectedConv = conversations.find((c) => c.id === selectedConversation);
  const { data: messagesForSelected = [] } = useMessages(selectedConversation);

  const mockLead = selectedConv ? {
    name: selectedConv.senderName || selectedConv.sender_name,
    email: selectedConv.senderEmail || selectedConv.sender_email,
    company: "TechCorp Inc",
    dealSize: "$50k",
    stage: selectedConv.status,
    engagementScore: 85,
    lastResponseTime: "2 hours ago",
    messageCount: messagesForSelected.length,
  } : null;

  const mockTimeline = selectedConv ? [
    { id: "1", type: "message" as const, description: "LinkedIn DM received", timestamp: "2 hours ago", actor: "System" },
    { id: "2", type: "assignment" as const, description: "Assigned to John SDR", timestamp: "2 hours ago", actor: "Admin User" },
  ] : [];

  return (
    <AppLayout role={userRole} userName={user?.email}>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-120px)]">
        <div className="overflow-hidden lg:col-span-3 flex flex-col">
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
              <div className="flex items-center gap-0.5">
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Tag className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Send className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Archive className="h-3.5 w-3.5" />
                </Button>
              </div>
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

        <div className="overflow-hidden lg:col-span-6 flex flex-col">
            {selectedConv ? (
              <div className="h-full bg-background rounded-lg border">
                <ConversationView 
                  conversation={{
                    id: selectedConv.id,
                    senderName: selectedConv.senderName,
                    senderEmail: selectedConv.senderEmail,
                    status: selectedConv.status,
                  }} 
                  messages={messagesForSelected}
                />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground bg-background rounded-lg border">
                Select a conversation to view
              </div>
            )}
          </div>

        <div className="lg:col-span-3 overflow-y-auto flex flex-col">
          {selectedConv && mockLead && (
            <LeadProfilePanel 
              lead={mockLead} 
              timeline={mockTimeline}
              conversationId={selectedConv.id}
            />
          )}
        </div>
      </div>
    </AppLayout>
  );
}
