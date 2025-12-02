import { AppLayout } from "@/components/Layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useConversations, useUpdateConversationStatus, useToggleRead } from "@/hooks/useConversations";
import { useMessages, useSendMessage } from "@/hooks/useMessages";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Search, Mail, Linkedin, Clock, Send, User, Building2, MapPin, TrendingUp, MessageSquare } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ReceivedAccountBadge } from "@/components/Inbox/ReceivedAccountBadge";
import { AssignmentDropdown } from "@/components/Inbox/AssignmentDropdown";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import "@/components/Inbox/email-editor.css";

export default function ConversationsInbox() {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [readFilter, setReadFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [replyContent, setReplyContent] = useState('');
  
  const { user, userRole } = useAuth();
  const { data: userProfile } = useProfile();
  const { data: teamMembers = [] } = useTeamMembers();
  const { data: conversations = [], isLoading } = useConversations();
  const { data: messages = [], isLoading: messagesLoading } = useMessages(selectedConversation);
  
  const updateStatus = useUpdateConversationStatus();
  const toggleRead = useToggleRead();
  const sendMessage = useSendMessage();
  
  const currentUserMember = teamMembers.find(m => m.id === user?.id);
  const userDisplayName = userProfile?.full_name || currentUserMember?.full_name || user?.email || "User";

  // Apply filters
  const filteredConversations = conversations.filter(conv => {
    const matchesStatus = statusFilter === 'all' || conv.status === statusFilter;
    const matchesRead = readFilter === 'all' || 
      (readFilter === 'read' && conv.is_read) || 
      (readFilter === 'unread' && !conv.is_read);
    const matchesSearch = searchQuery === '' || 
      (conv.sender_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.sender_email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = activeTab === 'all' || conv.conversation_type === activeTab;
    
    return matchesStatus && matchesRead && matchesSearch && matchesType;
  });

  const emailCount = conversations.filter(c => c.conversation_type === 'email').length;
  const linkedinCount = conversations.filter(c => c.conversation_type === 'linkedin').length;

  const selectedConv = conversations.find(c => c.id === selectedConversation);

  // Mark conversation as read when selected
  useEffect(() => {
    if (selectedConv && !selectedConv.is_read) {
      toggleRead.mutate({ conversationId: selectedConv.id, isRead: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConv?.id]);

  const handleConversationClick = (id: string) => {
    setSelectedConversation(id);
    setReplyContent('');
  };

  const handleStatusChange = (status: 'new' | 'engaged' | 'qualified' | 'converted' | 'not_interested') => {
    if (selectedConv) {
      updateStatus.mutate({ conversationId: selectedConv.id, status });
    }
  };

  const handleSendReply = async () => {
    if (!selectedConv || !replyContent.trim()) {
      toast.error('Please enter a message');
      return;
    }

    sendMessage.mutate(
      { conversationId: selectedConv.id, content: replyContent },
      {
        onSuccess: () => {
          setReplyContent('');
        },
      }
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new": return "bg-blue-500 text-white";
      case "engaged": return "bg-yellow-500 text-white";
      case "qualified": return "bg-purple-500 text-white";
      case "converted": return "bg-green-500 text-white";
      case "not_interested": return "bg-red-500 text-white";
      default: return "bg-gray-500 text-white";
    }
  };

  const getStatusLabel = (status: string) => {
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (error) {
      return timestamp;
    }
  };

  const formatMessageTimestamp = (timestamp: string) => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      return timestamp;
    }
  };

  const getSdrDisplayName = (assignedToId?: string): string => {
    if (!assignedToId) return 'Unassigned';
    const member = teamMembers.find(m => m.id === assignedToId);
    if (!member) return 'Unknown';
    return member.full_name.split(' ')[0];
  };

  const stripHtml = (html: string): string => {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  return (
    <AppLayout role={userRole} userName={userDisplayName}>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Conversations</h1>
          <p className="text-sm text-muted-foreground">Manage all email and LinkedIn conversations</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsContent value={activeTab} className="mt-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-[calc(100vh-180px)]">
                <p className="text-muted-foreground">Loading conversations...</p>
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[calc(100vh-180px)] p-8 text-center bg-background rounded-lg border">
                <p className="text-sm text-muted-foreground mb-2">No conversations found</p>
                <p className="text-xs text-muted-foreground">Connect email or LinkedIn accounts to start receiving conversations.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-180px)]">
                {/* Left Panel - Conversation List (Reduced Width) */}
                <div className="lg:col-span-3 flex flex-col bg-background rounded-lg border overflow-hidden">
                  <div className="p-3 border-b space-y-2.5">
                    <TabsList className="bg-muted w-full h-8">
                      <TabsTrigger value="all" className="flex-1 text-xs py-1">
                        All
                      </TabsTrigger>
                      <TabsTrigger value="email" className="flex-1 text-xs py-1">
                        <Mail className="h-3 w-3 mr-1" />
                        {emailCount}
                      </TabsTrigger>
                      <TabsTrigger value="linkedin" className="flex-1 text-xs py-1">
                        <Linkedin className="h-3 w-3 mr-1" />
                        {linkedinCount}
                      </TabsTrigger>
                    </TabsList>

                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input 
                        placeholder="Search..." 
                        className="pl-7 h-8 text-xs"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>

                    <div className="flex gap-1.5">
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
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="unread">Unread</SelectItem>
                          <SelectItem value="read">Read</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <ScrollArea className="flex-1">
                    {filteredConversations.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-xs text-muted-foreground p-4">
                        No conversations
                      </div>
                    ) : (
                      <div className="divide-y">
                        {filteredConversations.map((conv) => (
                          <div
                            key={conv.id}
                            className={cn(
                              "flex items-start gap-2 p-2.5 hover:bg-accent/50 transition-colors cursor-pointer",
                              selectedConversation === conv.id && "bg-accent",
                              !conv.is_read && "bg-muted/30"
                            )}
                            onClick={() => handleConversationClick(conv.id)}
                          >
                            <Avatar className="h-8 w-8 flex-shrink-0">
                              <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                                {conv.sender_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'UN'}
                              </AvatarFallback>
                            </Avatar>

                            <div className="flex-1 min-w-0 space-y-0.5">
                              <div className="flex items-start justify-between gap-1">
                                <div className="flex items-center gap-1 flex-1 min-w-0">
                                  <span className={cn(
                                    "text-xs font-medium truncate",
                                    !conv.is_read && "font-semibold"
                                  )}>
                                    {conv.sender_name || 'Unknown'}
                                  </span>
                                  {conv.conversation_type === "email" ? (
                                    <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                  ) : (
                                    <Linkedin className="h-3 w-3 text-blue-600 flex-shrink-0" />
                                  )}
                                </div>
                                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                  {formatTimestamp(conv.last_message_at)}
                                </span>
                              </div>

                              {conv.subject && (
                                <p className={cn(
                                  "text-xs line-clamp-1",
                                  !conv.is_read ? "font-medium" : "text-muted-foreground"
                                )}>
                                  {conv.subject}
                                </p>
                              )}

                              <p className="text-[11px] text-muted-foreground line-clamp-1">
                                {stripHtml(conv.preview || '')}
                              </p>

                              <div className="flex items-center gap-1 flex-wrap pt-0.5">
                                <Badge 
                                  variant="secondary" 
                                  className={cn("text-[9px] px-1 py-0 h-4", getStatusColor(conv.status))}
                                >
                                  {getStatusLabel(conv.status)}
                                </Badge>
                                {conv.assigned_to && (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                                    {getSdrDisplayName(conv.assigned_to)}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>

                {/* Middle Panel - Conversation Messages (Expanded Width) */}
                <div className="lg:col-span-6 flex flex-col bg-background rounded-lg border overflow-hidden">
                  {selectedConv ? (
                    <>
                      {/* Header */}
                      <div className="p-3 border-b space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 flex-1 min-w-0">
                            <Avatar className="h-9 w-9 flex-shrink-0">
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                {selectedConv.sender_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'UN'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <h2 className="text-base font-semibold truncate">{selectedConv.sender_name}</h2>
                              {selectedConv.subject && (
                                <p className="text-sm text-muted-foreground truncate">{selectedConv.subject}</p>
                              )}
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {selectedConv.conversation_type === "email" ? (
                                  <Mail className="h-3 w-3 text-muted-foreground" />
                                ) : (
                                  <Linkedin className="h-3 w-3 text-blue-600" />
                                )}
                                <span className="text-xs text-muted-foreground truncate">
                                  {selectedConv.sender_email || selectedConv.sender_linkedin_url || "LinkedIn Profile"}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1.5 items-end flex-shrink-0">
                            <AssignmentDropdown
                              conversationId={selectedConv.id}
                              currentAssignment={selectedConv.assigned_to}
                            />
                            <Select 
                              value={selectedConv.status} 
                              onValueChange={handleStatusChange}
                            >
                              <SelectTrigger className="w-32 h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="new">New</SelectItem>
                                <SelectItem value="engaged">Engaged</SelectItem>
                                <SelectItem value="qualified">Qualified</SelectItem>
                                <SelectItem value="converted">Converted</SelectItem>
                                <SelectItem value="not_interested">Not Interested</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        {selectedConv.received_account && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span>Received on:</span>
                            <ReceivedAccountBadge
                              accountName={selectedConv.received_account.account_name}
                              accountEmail={selectedConv.received_account.account_email || ''}
                              accountType={selectedConv.received_account.account_type}
                            />
                          </div>
                        )}
                      </div>

                      {/* Messages */}
                      <ScrollArea className="flex-1 p-4">
                        {messagesLoading ? (
                          <div className="flex items-center justify-center h-full">
                            <p className="text-sm text-muted-foreground">Loading messages...</p>
                          </div>
                        ) : messages.length === 0 ? (
                          <div className="flex items-center justify-center h-full">
                            <p className="text-sm text-muted-foreground">No messages yet</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {messages.map((message) => (
                              <div
                                key={message.id}
                                className={cn(
                                  "flex",
                                  message.is_from_lead ? "justify-start" : "justify-end"
                                )}
                              >
                                <div className={cn(
                                  "max-w-[85%] rounded-lg p-3 space-y-1",
                                  message.is_from_lead
                                    ? "bg-muted"
                                    : "bg-primary text-primary-foreground"
                                )}>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-semibold">
                                      {message.sender_name}
                                    </span>
                                    <span className={cn(
                                      "text-xs",
                                      message.is_from_lead ? "text-muted-foreground" : "opacity-70"
                                    )}>
                                      {formatMessageTimestamp(message.created_at)}
                                    </span>
                                  </div>
                                  {/* Render HTML content for emails */}
                                  {selectedConv.conversation_type === 'email' ? (
                                    <div 
                                      className="email-body-content text-sm"
                                      dangerouslySetInnerHTML={{ __html: message.content }}
                                    />
                                  ) : (
                                    <p className="text-sm whitespace-pre-wrap break-words">
                                      {message.content}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </ScrollArea>

                      {/* Reply Box */}
                      <div className="p-3 border-t bg-muted/30 space-y-2">
                        <Textarea
                          placeholder="Type your reply..."
                          value={replyContent}
                          onChange={(e) => setReplyContent(e.target.value)}
                          className="min-h-[70px] resize-none text-sm"
                          rows={3}
                        />
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="outline"
                            size="sm"
                            onClick={() => setReplyContent('')}
                            disabled={!replyContent.trim() || sendMessage.isPending}
                            className="h-8"
                          >
                            Clear
                          </Button>
                          <Button 
                            size="sm"
                            onClick={handleSendReply}
                            disabled={!replyContent.trim() || sendMessage.isPending}
                            className="h-8"
                          >
                            <Send className="h-3.5 w-3.5 mr-1.5" />
                            {sendMessage.isPending ? 'Sending...' : 'Send'}
                          </Button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
                      <MessageSquare className="h-16 w-16 mb-4 opacity-20" />
                      <h3 className="text-lg font-medium mb-2">No conversation selected</h3>
                      <p className="text-sm">Select a conversation from the list to view messages and reply</p>
                    </div>
                  )}
                </div>

                {/* Right Panel - Lead Profile */}
                <div className="lg:col-span-3 flex flex-col bg-background rounded-lg border overflow-hidden">
                  {selectedConv ? (
                    <ScrollArea className="flex-1">
                      <div className="p-4 space-y-4">
                        {/* Lead Info */}
                        <div className="space-y-2.5">
                          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Lead Information
                          </h3>
                          <div className="space-y-2.5">
                            <div className="flex items-start gap-2.5">
                              <User className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] text-muted-foreground uppercase">Name</p>
                                <p className="text-sm font-medium truncate">{selectedConv.sender_name || 'Unknown'}</p>
                              </div>
                            </div>
                            {selectedConv.sender_email && (
                              <div className="flex items-start gap-2.5">
                                <Mail className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px] text-muted-foreground uppercase">Email</p>
                                  <p className="text-xs font-medium truncate">{selectedConv.sender_email}</p>
                                </div>
                              </div>
                            )}
                            {selectedConv.company_name && (
                              <div className="flex items-start gap-2.5">
                                <Building2 className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px] text-muted-foreground uppercase">Company</p>
                                  <p className="text-sm font-medium truncate">{selectedConv.company_name}</p>
                                </div>
                              </div>
                            )}
                            {selectedConv.location && (
                              <div className="flex items-start gap-2.5">
                                <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px] text-muted-foreground uppercase">Location</p>
                                  <p className="text-sm font-medium truncate">{selectedConv.location}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <Separator />

                        {/* Conversation Stats */}
                        <div className="space-y-2.5">
                          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Stats
                          </h3>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-xs">Status</span>
                              </div>
                              <Badge className={cn("text-[10px] h-5 px-1.5", getStatusColor(selectedConv.status))}>
                                {getStatusLabel(selectedConv.status)}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-xs">Messages</span>
                              </div>
                              <span className="text-xs font-medium">{messages.length}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-xs">Last Activity</span>
                              </div>
                              <span className="text-xs font-medium">
                                {formatTimestamp(selectedConv.last_message_at)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <User className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-xs">Assigned To</span>
                              </div>
                              <span className="text-xs font-medium">
                                {getSdrDisplayName(selectedConv.assigned_to)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <Separator />

                        {/* Source */}
                        <div className="space-y-2.5">
                          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Source
                          </h3>
                          <div className="flex items-center gap-2">
                            {selectedConv.conversation_type === "email" ? (
                              <>
                                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-sm">Email</span>
                              </>
                            ) : (
                              <>
                                <Linkedin className="h-3.5 w-3.5 text-blue-600" />
                                <span className="text-sm">LinkedIn Outreach</span>
                              </>
                            )}
                          </div>
                          {selectedConv.received_account && (
                            <div className="text-xs text-muted-foreground">
                              <p className="truncate">Received on: {selectedConv.received_account.account_name}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="flex items-center justify-center h-full text-center p-8 text-muted-foreground">
                      <div>
                        <User className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p className="text-sm">Select a conversation to view lead details</p>
                      </div>
                    </div>
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
