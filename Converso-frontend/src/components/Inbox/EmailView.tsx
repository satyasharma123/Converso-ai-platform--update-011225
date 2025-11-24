import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Reply, Paperclip, MoreVertical, Forward, Maximize2, ReplyAll, Bold, Italic, Underline, List, ListOrdered, Link2, Image, Smile, Highlighter, Type, Palette } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { useAssignConversation, useUpdateConversationStage } from "@/hooks/useConversations";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SavedReplies } from "@/components/Inbox/SavedReplies";

interface Message {
  id: string;
  senderName: string;
  senderEmail?: string;
  content: string;
  timestamp: string;
  isFromLead: boolean;
}

interface EmailViewProps {
  conversation: {
    id: string;
    senderName: string;
    senderEmail: string;
    subject?: string;
    status: string;
    assigned_to?: string;
    custom_stage_id?: string;
  };
  messages: Message[];
}

export function EmailView({ conversation, messages }: EmailViewProps) {
  const [replyText, setReplyText] = useState("");
  const [showReply, setShowReply] = useState(false);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [ccText, setCcText] = useState("");
  const [bccText, setBccText] = useState("");
  const [expandedCompose, setExpandedCompose] = useState(false);
  const [replyType, setReplyType] = useState<"reply" | "replyAll" | "forward">("reply");
  
  const { data: teamMembers } = useTeamMembers();
  const { data: pipelineStages } = usePipelineStages();
  const assignMutation = useAssignConversation();
  const updateStageMutation = useUpdateConversationStage();
  
  const sdrs = teamMembers?.filter(member => member.role === 'sdr') || [];
  const assignedSdr = sdrs.find(sdr => sdr.id === conversation.assigned_to);
  const currentStage = pipelineStages?.find(stage => stage.id === conversation.custom_stage_id);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSend = () => {
    if (!replyText.trim()) return;
    // Handle sending logic here
    setReplyText("");
    setShowReply(false);
    setShowCc(false);
    setShowBcc(false);
    setCcText("");
    setBccText("");
    setExpandedCompose(false);
  };

  const handleReplyClick = (type: "reply" | "replyAll" | "forward") => {
    setReplyType(type);
    setShowReply(true);
  };

  const handleExpand = () => {
    setExpandedCompose(true);
  };

  const handleSelectTemplate = (content: string) => {
    // Insert template at cursor position or append if no selection
    setReplyText((prev) => {
      if (prev) {
        return prev + "\n\n" + content;
      }
      return content;
    });
  };

  const getReplyLabel = () => {
    switch (replyType) {
      case "replyAll":
        return "Reply All";
      case "forward":
        return "Forward";
      default:
        return "Reply";
    }
  };

  const ReplyComposer = ({ isExpanded = false }: { isExpanded?: boolean }) => (
    <div className={isExpanded ? "space-y-4" : ""}>
      <div className={`border-t bg-background ${isExpanded ? "p-0" : ""}`}>
        <div className="px-6 py-3 border-b bg-muted/30 space-y-2">
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-muted-foreground font-medium">To:</span>
              <span className="text-foreground">{conversation.senderEmail}</span>
            </div>
            <div className="flex items-center gap-2">
              {!showCc && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCc(true)}
                  className="h-6 text-xs px-2"
                >
                  Cc
                </Button>
              )}
              {!showBcc && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowBcc(true)}
                  className="h-6 text-xs px-2"
                >
                  Bcc
                </Button>
              )}
            </div>
          </div>
          
          {showCc && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground font-medium">Cc:</span>
              <Input
                value={ccText}
                onChange={(e) => setCcText(e.target.value)}
                placeholder="Add recipients"
                className="h-7 text-xs border-0 bg-transparent focus-visible:ring-0 px-0"
              />
            </div>
          )}
          
          {showBcc && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground font-medium">Bcc:</span>
              <Input
                value={bccText}
                onChange={(e) => setBccText(e.target.value)}
                placeholder="Add recipients"
                className="h-7 text-xs border-0 bg-transparent focus-visible:ring-0 px-0"
              />
            </div>
          )}
        </div>
        
        <div className="px-6 py-4">
          <Textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Type your reply..."
            className={`resize-none border-0 focus-visible:ring-0 text-sm p-0 ${
              isExpanded ? "min-h-[400px]" : "min-h-[120px]"
            }`}
          />
        </div>

        {/* Formatting Toolbar */}
        <div className="px-6 py-2 bg-muted/30 border-y">
          <div className="flex items-center gap-1">
            <Select defaultValue="sans">
              <SelectTrigger className="w-[100px] h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sans">Sans Serif</SelectItem>
                <SelectItem value="serif">Serif</SelectItem>
                <SelectItem value="mono">Mono</SelectItem>
              </SelectContent>
            </Select>
            
            <Select defaultValue="14">
              <SelectTrigger className="w-[70px] h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12">12</SelectItem>
                <SelectItem value="14">14</SelectItem>
                <SelectItem value="16">16</SelectItem>
                <SelectItem value="18">18</SelectItem>
                <SelectItem value="20">20</SelectItem>
              </SelectContent>
            </Select>
            
            <Separator orientation="vertical" className="h-5 mx-1" />
            
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Bold">
              <Bold className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Italic">
              <Italic className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Underline">
              <Underline className="h-3.5 w-3.5" />
            </Button>
            
            <Separator orientation="vertical" className="h-5 mx-1" />
            
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Text Color">
              <Palette className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Highlight">
              <Highlighter className="h-3.5 w-3.5" />
            </Button>
            
            <Separator orientation="vertical" className="h-5 mx-1" />
            
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Bulleted List">
              <List className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Numbered List">
              <ListOrdered className="h-3.5 w-3.5" />
            </Button>
            
            <Separator orientation="vertical" className="h-5 mx-1" />
            
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Insert Link">
              <Link2 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Insert Image">
              <Image className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Insert Emoji">
              <Smile className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Attach File">
              <Paperclip className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <SavedReplies onSelectReply={handleSelectTemplate} />
            {!isExpanded && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExpand}
                className="h-7 text-xs px-2"
              >
                <Maximize2 className="h-3.5 w-3.5 mr-1.5" />
                Expand
              </Button>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowReply(false);
                setShowCc(false);
                setShowBcc(false);
                setExpandedCompose(false);
              }}
              className="h-7 text-xs px-3"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSend}
              disabled={!replyText.trim()}
              className="h-7 text-xs px-3"
            >
              <Send className="h-3 w-3 mr-1.5" />
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  const handleAssign = (sdrId: string) => {
    assignMutation.mutate({ 
      conversationId: conversation.id, 
      sdrId: sdrId === 'unassigned' ? null : sdrId 
    });
  };

  const handleStageChange = (stageId: string) => {
    updateStageMutation.mutate({
      conversationId: conversation.id,
      stageId: stageId === 'none' ? null : stageId
    });
  };

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Email Header */}
        <div className="px-6 py-4 border-b bg-background">
          {/* Assign and Stage Dropdowns */}
          <div className="flex items-center gap-2 mb-3">
            <Select value={conversation.assigned_to || 'unassigned'} onValueChange={handleAssign}>
              <SelectTrigger className="w-[140px] h-7 text-xs">
                <SelectValue placeholder="Assign" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Assign</SelectItem>
                {sdrs.map((sdr) => (
                  <SelectItem key={sdr.id} value={sdr.id}>
                    {sdr.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={conversation.custom_stage_id || 'none'} onValueChange={handleStageChange}>
              <SelectTrigger className="w-[140px] h-7 text-xs">
                <SelectValue placeholder="Stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Stage</SelectItem>
                {pipelineStages?.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-start justify-between mb-2">
            <h2 className="text-lg font-semibold">{conversation.subject || "No Subject"}</h2>
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => handleReplyClick("reply")}
                title="Reply"
              >
                <Reply className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => handleReplyClick("reply")} className="cursor-pointer">
                    <Reply className="h-4 w-4 mr-2" />
                    Reply
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleReplyClick("replyAll")} className="cursor-pointer">
                    <ReplyAll className="h-4 w-4 mr-2" />
                    Reply All
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleReplyClick("forward")} className="cursor-pointer">
                    <Forward className="h-4 w-4 mr-2" />
                    Forward
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Email Thread */}
        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-0">
            {[...messages].reverse().map((message, index) => (
              <div key={message.id}>
                {/* Latest message - full display */}
                {index === 0 && (
                  <div className="space-y-4 mb-6">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-primary text-primary-foreground text-base">
                          {getInitials(message.senderName)}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-1">
                          <div>
                            <p className="text-base font-semibold text-foreground">
                              {message.senderName} &lt;{message.senderEmail || conversation.senderEmail}&gt;
                            </p>
                            <p className="text-sm text-foreground mt-1">
                              <span className="font-medium">To:</span> {conversation.senderEmail}
                            </p>
                          </div>
                          <span className="text-sm text-muted-foreground whitespace-nowrap ml-4">{message.timestamp}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                      {message.content}
                    </div>
                  </div>
                )}

                {/* Previous messages in thread */}
                {index > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-foreground mb-3">
                      On {message.timestamp}, {message.senderName} &lt;
                      <a href={`mailto:${message.senderEmail || conversation.senderEmail}`} className="text-primary">
                        {message.senderEmail || conversation.senderEmail}
                      </a>
                      &gt; wrote:
                    </p>
                    
                    <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                      {message.content}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Reply Composition */}
        {showReply && <ReplyComposer />}
      </div>

      {/* Expanded Compose Dialog */}
      <Dialog open={expandedCompose} onOpenChange={setExpandedCompose}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle className="text-base">
              {getReplyLabel()}: {conversation.subject || "No Subject"}
            </DialogTitle>
          </DialogHeader>
          <ReplyComposer isExpanded />
        </DialogContent>
      </Dialog>
    </>
  );
}
