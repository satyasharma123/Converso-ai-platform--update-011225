import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send } from "lucide-react";
import { useState } from "react";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { useUpdateConversationStage } from "@/hooks/useConversations";
import { useAuth } from "@/hooks/useAuth";

interface LeadProfilePanelProps {
  lead: {
    name: string;
    email?: string;
    company?: string;
    stage?: string;
    engagementScore: number;
    lastResponseTime: string;
    messageCount: number;
    source?: string;
    assignedTo?: string;
  };
  timeline: Array<{
    id: string;
    type: string;
    description: string;
    timestamp: string;
    actor: string;
  }>;
  conversationId?: string;
}

// Mock comments data
interface Comment {
  id: string;
  username: string;
  timestamp: string;
  text: string;
}

export function LeadProfilePanel({ lead, timeline, conversationId }: LeadProfilePanelProps) {
  const { userRole } = useAuth();
  const [commentText, setCommentText] = useState("");
  const { data: teamMembers } = useTeamMembers();
  const { data: pipelineStages = [] } = usePipelineStages();
  const updateStageMutation = useUpdateConversationStage();
  
  // Find the current stage ID from the lead's stage name or use first stage as default
  const currentStageId = pipelineStages.find(s => s.name === lead.stage)?.id || pipelineStages[0]?.id || null;
  const [selectedStage, setSelectedStage] = useState<string | null>(currentStageId);
  const [selectedSDR, setSelectedSDR] = useState(lead.assignedTo || "");
  
  const handleStageChange = (stageId: string) => {
    setSelectedStage(stageId);
    if (conversationId) {
      updateStageMutation.mutate({
        conversationId,
        stageId: stageId === 'none' ? null : stageId
      });
    }
  };
  
  const [comments, setComments] = useState<Comment[]>([
    { id: "1", username: "Sarah Admin", timestamp: "2h", text: "High priority outreach — responded quickly" },
    { id: "2", username: "Mike SDR", timestamp: "5h", text: "Scheduled demo next week" },
  ]);

  const handleSubmitComment = () => {
    if (!commentText.trim()) return;
    
    const newComment: Comment = {
      id: Date.now().toString(),
      username: "Current User",
      timestamp: "now",
      text: commentText,
    };
    
    setComments([newComment, ...comments]);
    setCommentText("");
  };

  return (
    <div className="h-fit px-5 py-4 pb-6 space-y-0">
      {/* Profile Section */}
      <div className="pb-5">
        <h2 className="text-base font-semibold text-foreground mb-1.5 truncate pr-2">{lead.name}</h2>
        {lead.company && (
          <p className="text-sm text-muted-foreground mb-4 truncate pr-2">{lead.company}</p>
        )}
        
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground truncate min-w-0">{lead.source || "Sales Account"}</span>
          
          {userRole === 'admin' && (
            <>
              {selectedSDR ? (
                <Select value={selectedSDR} onValueChange={setSelectedSDR}>
                  <SelectTrigger className="w-auto h-7 text-xs border-none bg-transparent hover:bg-muted/50 flex-shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers?.map((member) => (
                      <SelectItem key={member.id} value={member.full_name}>
                        {member.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select value={selectedSDR} onValueChange={setSelectedSDR}>
                  <SelectTrigger className="w-auto h-7 text-xs rounded-full bg-muted px-3 flex-shrink-0">
                    <SelectValue placeholder="Assign SDR" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers?.map((member) => (
                      <SelectItem key={member.id} value={member.full_name}>
                        {member.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border/40 mb-5" />

      {/* Lead Status Section */}
      <div className="pb-5 space-y-3.5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Engagement</span>
          <span className="text-sm font-medium text-foreground">{lead.engagementScore}/100</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Stage</span>
          <Select value={selectedStage || 'none'} onValueChange={handleStageChange}>
            <SelectTrigger className="w-auto h-7 text-xs rounded-full bg-[#3C3C3C] text-white border-none px-3 flex-shrink-0">
              <SelectValue placeholder="Select stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Unassigned</SelectItem>
              {pipelineStages.map((stage) => (
                <SelectItem key={stage.id} value={stage.id}>
                  {stage.name}
                </SelectItem>
              ))}
              {pipelineStages.length === 0 && (
                <SelectItem value="none" disabled>No stages available</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Messages</span>
          <span className="text-sm font-medium text-foreground">{lead.messageCount}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Last Response</span>
          <span className="text-sm font-medium text-foreground">{lead.lastResponseTime}</span>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border/40 mb-5" />

      {/* Activity Section */}
      <div className="pb-5">
        <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3.5">Activity</h4>
        <div className="space-y-3">
          {timeline.slice(0, 3).map((event) => (
            <div key={event.id} className="flex items-start justify-between gap-3">
              <span className="text-sm text-foreground flex-1 min-w-0 break-words">{event.description}</span>
              <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">{event.timestamp}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border/40 mb-5" />

      {/* Comments Section */}
      <div>
        <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3.5">Comments (Internal)</h4>
        
        <div className="relative mb-4 bg-muted/30 border border-border/50 rounded-lg">
          <Textarea
            placeholder="Add a comment for internal team…"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleSubmitComment();
              }
            }}
            className="min-h-[52px] text-sm resize-none border-0 bg-transparent p-3 pr-12 focus-visible:ring-0 placeholder:text-muted-foreground"
          />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleSubmitComment}
                  disabled={!commentText.trim()}
                  className="absolute right-2.5 bottom-2.5 h-5 w-5 text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                  aria-label="Submit comment"
                >
                  <Send className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Submit comment (Cmd/Ctrl + Enter)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <ScrollArea className="max-h-[200px]">
          <div className="space-y-4 pr-2">
            {comments.map((comment, index) => (
              <div key={comment.id}>
                <div className="text-sm space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-sm text-foreground">{comment.username}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{comment.timestamp}</span>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed break-words">{comment.text}</p>
                </div>
                {index < comments.length - 1 && (
                  <div className="border-t border-border/30 mt-4"></div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
