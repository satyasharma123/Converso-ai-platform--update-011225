import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Mail, Linkedin, User, Clock, LayoutList, UserCheck, MessageSquare, Reply } from "lucide-react";
import { Conversation } from "@/hooks/useConversations";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useMessages } from "@/hooks/useMessages";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { LeadProfilePanel } from "@/components/Inbox/LeadProfilePanel";
import { format, formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";

interface LeadDetailsModalProps {
  conversation: Conversation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Safe timestamp formatter
const formatTimestamp = (timestamp: string | undefined | null): string => {
  if (!timestamp) return 'No date';
  
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }
    return formatDistanceToNow(date, { addSuffix: true });
  } catch (error) {
    console.error('Error formatting timestamp:', error);
    return 'Invalid date';
  }
};

export function LeadDetailsModal({ conversation, open, onOpenChange }: LeadDetailsModalProps) {
  const navigate = useNavigate();
  const { data: teamMembers = [] } = useTeamMembers();
  const { data: messages = [], isLoading: messagesLoading, error: messagesError } = useMessages(conversation?.id || null);
  const { data: pipelineStages = [] } = usePipelineStages();
  const [activeTab, setActiveTab] = useState<string>("activities");

  if (!conversation) return null;
  
  console.log('[LeadDetailsModal] Rendering with conversation:', {
    id: conversation.id,
    type: conversation.conversation_type,
    sender: conversation.sender_name,
    hasMessages: messages.length,
    messagesLoading,
    messagesError
  });

  // Handle reply button click
  const handleReply = () => {
    onOpenChange(false); // Close modal first
    
    if (conversation.conversation_type === 'linkedin') {
      // Navigate to LinkedIn inbox with this conversation selected
      navigate('/linkedin-inbox', { state: { selectedConversationId: conversation.id } });
    } else {
      // Navigate to Email inbox with this conversation selected
      navigate('/inbox', { state: { selectedConversationId: conversation.id } });
    }
  };

  const assignedSDR = teamMembers?.find(member => member.id === conversation.assigned_to);
  const currentStage = pipelineStages.find(stage => stage.id === conversation.custom_stage_id);

  // Generate activity log from available data
  const generateActivityLog = () => {
    const activities: Array<{
      id: string;
      type: 'message' | 'stage_change' | 'assignment' | 'created';
      timestamp: string;
      description: string;
      icon: any;
      details?: string;
    }> = [];

    // Add conversation creation
    if (conversation.last_message_at) {
      activities.push({
        id: 'created',
        type: 'created',
        timestamp: conversation.last_message_at,
        description: `Lead created from ${conversation.conversation_type === 'email' ? 'Email' : 'LinkedIn'}`,
        icon: conversation.conversation_type === 'email' ? Mail : Linkedin,
        details: `Initial contact received`
      });
    }

    // Add stage assignment if exists
    if ((conversation as any).stage_assigned_at && currentStage) {
      activities.push({
        id: 'stage_assigned',
        type: 'stage_change',
        timestamp: (conversation as any).stage_assigned_at,
        description: `Stage changed to "${currentStage.name}"`,
        icon: LayoutList,
        details: `Moved to ${currentStage.name} stage`
      });
    }

    // Add SDR assignment if exists
    if (assignedSDR) {
      activities.push({
        id: 'sdr_assigned',
        type: 'assignment',
        timestamp: conversation.last_message_at,
        description: `Assigned to ${assignedSDR.full_name}`,
        icon: UserCheck,
        details: `SDR: ${assignedSDR.full_name}`
      });
    }

    // Add messages as activities
    messages.forEach((message) => {
      activities.push({
        id: message.id,
        type: 'message',
        timestamp: message.created_at,
        description: message.is_from_lead 
          ? `Message received from ${message.sender_name}` 
          : `Message sent by ${message.sender_name}`,
        icon: message.is_from_lead ? MessageSquare : User,
        details: message.content.substring(0, 100) + (message.content.length > 100 ? '...' : '')
      });
    });

    // Sort by timestamp (most recent first)
    return activities.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  };

  const activityLog = generateActivityLog();

  // Create lead data for LeadProfilePanel - with safe defaults
  const leadData = {
    name: conversation.sender_name || 'Unknown',
    email: conversation.sender_email || '',
    mobile: (conversation as any).mobile || null,
    profilePictureUrl: (conversation as any).sender_profile_picture_url || null,
    linkedinUrl: (conversation as any).sender_linkedin_url || null,
    company: conversation.company_name || null,
    location: conversation.location || null,
    stage: currentStage?.name || null,
    stageId: conversation.custom_stage_id || null,
    score: 50,
    source: conversation.conversation_type === 'linkedin' ? 'LinkedIn' : 'Email',
    channel: conversation.conversation_type === 'linkedin' ? 'LinkedIn' : 'Email',
    lastMessageAt: conversation.last_message_at || null,
    assignedTo: assignedSDR?.full_name || null,
    assignedToId: conversation.assigned_to || null,
  };
  
  console.log('[LeadDetailsModal] Lead data prepared:', leadData);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 gap-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Lead Details</h2>
        </div>

        <div className="flex h-[calc(90vh-80px)]">
          {/* Left Panel - Activities & Conversation History */}
          <div className="flex-1 flex flex-col border-r overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <div className="border-b px-4 pt-2">
                <TabsList className="w-full justify-start h-12">
                  <TabsTrigger value="activities" className="flex-1 max-w-[200px]">
                    Activities
                  </TabsTrigger>
                  <TabsTrigger value="conversation" className="flex-1 max-w-[200px]">
                    Conversation History
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Activities Tab */}
              <TabsContent value="activities" className="flex-1 m-0 p-0 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="px-4 py-4">
                    {activityLog.length > 0 ? (
                      <div className="space-y-2">
                        {activityLog.map((activity, index) => {
                          const Icon = activity.icon;
                          return (
                            <div key={activity.id} className="flex gap-2.5">
                              {/* Timeline */}
                              <div className="flex flex-col items-center">
                                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                  <Icon className="h-3.5 w-3.5 text-primary" />
                                </div>
                                {index < activityLog.length - 1 && (
                                  <div className="w-px flex-1 bg-border mt-1.5 min-h-[16px]" />
                                )}
                              </div>

                              {/* Content */}
                              <div className="flex-1 pb-2 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium leading-snug">{activity.description}</p>
                                    {activity.details && (
                                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                                        {activity.details}
                                      </p>
                                    )}
                                  </div>
                                  <span className="text-[11px] text-muted-foreground whitespace-nowrap flex-shrink-0">
                                    {formatTimestamp(activity.timestamp)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-[400px] text-center">
                        <Clock className="h-12 w-12 text-muted-foreground/50 mb-4" />
                        <p className="text-sm text-muted-foreground">No activities yet</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Conversation History Tab */}
              <TabsContent value="conversation" className="flex-1 m-0 p-0 flex flex-col overflow-hidden">
                <ScrollArea className="flex-1">
                  <div className="px-4 py-4 space-y-3">
                    {messages.length > 0 ? (
                      <>
                        {messages.map((message) => {
                          const senderName = message.sender_name || conversation.sender_name || 'Unknown';
                          const initials = senderName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'UN';
                          const isFromLead = message.is_from_lead;
                          
                          return (
                            <div
                              key={message.id}
                              className={`flex gap-2 ${isFromLead ? '' : 'flex-row-reverse'}`}
                            >
                              <Avatar className="h-8 w-8 flex-shrink-0">
                                <AvatarFallback className="text-xs">
                                  {initials}
                                </AvatarFallback>
                              </Avatar>
                              
                              <div className={`flex flex-col gap-1 max-w-[75%] ${isFromLead ? 'items-start' : 'items-end'}`}>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium">{senderName}</span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {format(new Date(message.created_at), 'h:mm a')}
                                  </span>
                                </div>
                                
                                <div 
                                  className={`rounded-2xl px-3 py-2 ${
                                    isFromLead 
                                      ? 'bg-muted/50 rounded-tl-sm' 
                                      : 'bg-primary text-primary-foreground rounded-tr-sm'
                                  }`}
                                >
                                  <p className="text-sm whitespace-pre-wrap leading-relaxed break-words">
                                    {message.content}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-[400px] text-center">
                        <Mail className="h-12 w-12 text-muted-foreground/50 mb-4" />
                        <p className="text-sm text-muted-foreground">No messages in this conversation yet</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
                
                {/* Reply Button - Fixed at bottom, right-aligned */}
                <div className="border-t px-4 py-3 bg-background flex justify-end flex-shrink-0">
                  <Button 
                    onClick={handleReply}
                    className="h-9 px-6"
                    variant="default"
                  >
                    <Reply className="h-3.5 w-3.5 mr-2" />
                    Reply
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Panel - Lead Profile */}
          <div className="w-[380px] flex-shrink-0">
            {conversation?.id ? (
              <LeadProfilePanel 
                lead={leadData}
                conversationId={conversation.id}
              />
            ) : (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Unable to load lead profile
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
