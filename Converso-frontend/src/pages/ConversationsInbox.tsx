import { AppLayout } from "@/components/Layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useConversations } from "@/hooks/useConversations";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, Mail, Linkedin, Clock } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ReceivedAccountBadge } from "@/components/Inbox/ReceivedAccountBadge";
import { AssignmentDropdown } from "@/components/Inbox/AssignmentDropdown";
import { LeadProfilePanel } from "@/components/Inbox/LeadProfilePanel";
import { useMessages } from "@/hooks/useMessages";

export default function ConversationsInbox() {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [readFilter, setReadFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  
  const { user, userRole } = useAuth();
  const { data: userProfile } = useProfile();
  const { data: teamMembers = [] } = useTeamMembers();
  const { data: conversations = [], isLoading } = useConversations();
  
  const currentUserMember = teamMembers.find(m => m.id === user?.id);
  const userDisplayName = userProfile?.full_name || currentUserMember?.full_name || user?.email || "User";

  // Apply filters
  const filteredConversations = conversations.filter(conv => {
    // SDR role filtering is handled by backend service
    const matchesStatus = statusFilter === 'all' || conv.status === statusFilter;
    const matchesRead = readFilter === 'all' || 
      (readFilter === 'read' && conv.is_read) || 
      (readFilter === 'unread' && !conv.is_read);
    const matchesSearch = searchQuery === '' || 
      (conv.senderName || conv.sender_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.subject?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = activeTab === 'all' || conv.conversation_type === activeTab;
    
    return matchesStatus && matchesRead && matchesSearch && matchesType;
  });

  const emailCount = conversations.filter(c => c.conversation_type === 'email').length;
  const linkedinCount = conversations.filter(c => c.conversation_type === 'linkedin').length;

  const selectedConv = conversations.find(c => c.id === selectedConversation);

  const handleConversationClick = (id: string) => {
    setSelectedConversation(id);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new": return "bg-blue-500";
      case "engaged": return "bg-yellow-500";
      case "qualified": return "bg-purple-500";
      case "converted": return "bg-green-500";
      case "not_interested": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  return (
    <AppLayout role={userRole} userName={userDisplayName}>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Conversations</h1>
          <p className="text-xs text-muted-foreground">Manage all email and LinkedIn conversations</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsContent value={activeTab}>
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">Loading conversations...</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 p-8 text-center">
                <p className="text-sm text-muted-foreground mb-2">No conversations found</p>
                <p className="text-xs text-muted-foreground">The database is empty. Please seed the database.</p>
                <p className="text-xs text-muted-foreground mt-2">See QUICK_SEED.sql in the project root.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-200px)]">
                <div className="overflow-hidden lg:col-span-3 flex flex-col">
                  <TabsList className="mb-3 bg-transparent border-b rounded-none w-full justify-start h-auto p-0">
                    <TabsTrigger 
                      value="all"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs px-3 py-1.5"
                    >
                      All ({conversations.length})
                    </TabsTrigger>
                    <TabsTrigger 
                      value="email"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs px-3 py-1.5"
                    >
                      Email ({emailCount})
                    </TabsTrigger>
                    <TabsTrigger 
                      value="linkedin"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs px-3 py-1.5"
                    >
                      LinkedIn ({linkedinCount})
                    </TabsTrigger>
                  </TabsList>

                  <div className="space-y-2 mb-3">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                      <Input 
                        placeholder="Search conversations..." 
                        className="pl-7 h-8 text-xs placeholder:text-xs"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-8 text-xs flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="engaged">Engaged</SelectItem>
                          <SelectItem value="qualified">Qualified</SelectItem>
                          <SelectItem value="converted">Converted</SelectItem>
                          <SelectItem value="not_interested">Not Interested</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={readFilter} onValueChange={setReadFilter}>
                        <SelectTrigger className="h-8 text-xs flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Messages</SelectItem>
                          <SelectItem value="unread">Unread</SelectItem>
                          <SelectItem value="read">Read</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto bg-background rounded-lg border">
                    {filteredConversations.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        No conversations found
                      </div>
                    ) : (
                      <>
                        {filteredConversations.map((conv) => (
                          <div
                            key={conv.id}
                            className={cn(
                              "flex items-start gap-2 p-3 hover:bg-accent/50 transition-colors border-b cursor-pointer",
                              selectedConversation === conv.id && "bg-accent/50",
                              !conv.isRead && "bg-muted/30"
                            )}
                            onClick={() => handleConversationClick(conv.id)}
                          >
                            <div className="flex-1 min-w-0 space-y-1.5">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                  <span className={cn("text-xs font-semibold", !conv.isRead && "font-bold")}>
                                    {conv.senderName}
                                  </span>
                                  {conv.type === "email" ? (
                                    <Mail className="h-3 w-3 text-muted-foreground" />
                                  ) : (
                                    <Linkedin className="h-3 w-3 text-blue-600" />
                                  )}
                                  <Badge 
                                    variant="outline" 
                                    className={cn("text-[10px] px-1 py-0", getStatusColor(conv.status))}
                                  >
                                    {conv.status}
                                  </Badge>
                                </div>
                                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                  {conv.timestamp}
                                </span>
                              </div>

                              {conv.subject && (
                                <p className="text-xs font-medium line-clamp-1">
                                  {conv.subject}
                                </p>
                              )}

                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {conv.preview}
                              </p>

                              <div className="flex items-center gap-1.5 flex-wrap">
                                {conv.receivedAccount && (
                                  <ReceivedAccountBadge
                                    accountName={conv.receivedAccount.account_name}
                                    accountEmail={conv.receivedAccount.account_email}
                                    accountType={conv.receivedAccount.account_type}
                                  />
                                )}
                                {conv.senderEmail && (
                                  <Badge variant="secondary" className="text-[10px] px-1 py-0">
                                    {conv.senderEmail}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>

                <div className="overflow-hidden lg:col-span-6">
                  {selectedConv ? (
                    <div className="h-full bg-background rounded-lg border p-3 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1.5">
                          <h2 className="text-base font-bold">{selectedConv.senderName}</h2>
                          {selectedConv.subject && (
                            <p className="text-xs text-muted-foreground">{selectedConv.subject}</p>
                          )}
                          <div className="flex items-center gap-1.5">
                            {selectedConv.type === "email" ? (
                              <Mail className="h-3 w-3" />
                            ) : (
                              <Linkedin className="h-3 w-3 text-blue-600" />
                            )}
                            <span className="text-xs">{selectedConv.senderEmail || "LinkedIn Profile"}</span>
                          </div>
                          {selectedConv.receivedAccount && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-muted-foreground">Received on:</span>
                              <ReceivedAccountBadge
                                accountName={selectedConv.receivedAccount.account_name}
                                accountEmail={selectedConv.receivedAccount.account_email}
                                accountType={selectedConv.receivedAccount.account_type}
                              />
                            </div>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <Badge className={cn("text-[10px] px-1 py-0", getStatusColor(selectedConv.status))}>
                            {selectedConv.status}
                          </Badge>
                          <AssignmentDropdown
                            conversationId={selectedConv.id}
                            currentAssignment={selectedConv.assignedTo}
                          />
                        </div>
                      </div>
                      
                      <div className="text-xs text-muted-foreground">
                        <Clock className="h-3 w-3 inline mr-1.5" />
                        {selectedConv.timestamp}
                      </div>

                      <div className="border-t pt-3">
                        <p className="text-xs">{selectedConv.preview}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground bg-background rounded-lg border">
                      Select a conversation to view details
                    </div>
                  )}
                </div>

                <div className="lg:col-span-3 overflow-y-auto flex flex-col p-6">
                  {selectedConv && (
                    <LeadProfilePanel 
                      lead={{
                        name: selectedConv.senderName,
                        email: selectedConv.senderEmail,
                        company: "Sample Corp",
                        stage: selectedConv.status,
                        engagementScore: 75,
                        lastResponseTime: selectedConv.timestamp,
                        messageCount: 3,
                        source: "LinkedIn Outreach",
                        assignedTo: selectedConv.assignedTo || undefined,
                      }}
                      timeline={[
                        { id: "1", type: "message" as const, description: `${selectedConv.type === 'email' ? 'Email' : 'LinkedIn DM'} received`, timestamp: selectedConv.timestamp, actor: "System" },
                        { id: "2", type: "assignment" as const, description: selectedConv.assignedTo ? `Assigned to ${selectedConv.assignedTo}` : "Unassigned", timestamp: selectedConv.timestamp, actor: "System" },
                      ]}
                      conversationId={selectedConv.id}
                    />
                  )}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
