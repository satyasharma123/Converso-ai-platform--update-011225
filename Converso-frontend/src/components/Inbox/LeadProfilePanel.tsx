import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send } from "lucide-react";
import { useState } from "react";
import { useTeamMembers } from "@/hooks/useTeamMembers";
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
  const [selectedStage, setSelectedStage] = useState(lead.stage || "new");
  const [selectedSDR, setSelectedSDR] = useState(lead.assignedTo || "");
  const { data: teamMembers } = useTeamMembers();
  
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
    <div className="space-y-3 h-fit">
      {/* Profile Section */}
      <div className="pb-3">
        <h2 className="text-[18px] font-bold text-foreground mb-1">{lead.name}</h2>
        {lead.company && (
          <p className="text-[14px] text-foreground mb-3">{lead.company}</p>
        )}
        
        <div className="flex items-center justify-between text-[14px]">
          <span className="text-muted-foreground">{lead.source || "Sales Account"}</span>
          
          {userRole === 'admin' && (
            <>
              {selectedSDR ? (
                <Select value={selectedSDR} onValueChange={setSelectedSDR}>
                  <SelectTrigger className="w-auto h-7 text-xs border-none bg-transparent hover:bg-muted/50">
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
                  <SelectTrigger className="w-auto h-7 text-xs rounded-full bg-muted px-3">
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
      <div className="border-t border-[#E8E8E8]" />

      {/* Lead Status Section */}
      <div className="pt-2 pb-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[14px] text-foreground">Engagement</span>
          <span className="text-[14px] text-foreground">{lead.engagementScore}/100</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[14px] text-foreground">Stage</span>
          <Select value={selectedStage} onValueChange={setSelectedStage}>
            <SelectTrigger className="w-auto h-7 text-xs rounded-full bg-[#3C3C3C] text-white border-none px-3">
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

        <div className="flex items-center justify-between">
          <span className="text-[14px] text-foreground">Messages</span>
          <span className="text-[14px] text-foreground">{lead.messageCount}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[14px] text-foreground">Last Response</span>
          <span className="text-[14px] text-foreground">{lead.lastResponseTime}</span>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-[#E8E8E8]" />

      {/* Activity Section */}
      <div className="pt-2 pb-3">
        <h4 className="text-[12px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Activity</h4>
        <div className="space-y-1.5">
          {timeline.slice(0, 3).map((event) => (
            <div key={event.id} className="flex items-center justify-between text-[14px]">
              <span className="text-foreground">{event.description}</span>
              <span className="text-muted-foreground text-[13px]">{event.timestamp}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-[#E8E8E8]" />

      {/* Comments Section */}
      <div className="pt-2">
        <h4 className="text-[12px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Comments (Internal)</h4>
        
        <div className="relative mb-3 bg-[#F8F8F8] border border-[#E5E5E5] rounded-lg">
          <Textarea
            placeholder="Add a comment for internal team…"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleSubmitComment();
              }
            }}
            className="min-h-[52px] text-[13px] resize-none border-0 bg-transparent p-3 pr-12 focus-visible:ring-0"
          />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleSubmitComment}
                  disabled={!commentText.trim()}
                  className="absolute right-2 bottom-2 h-5 w-5 text-[#6A6874] hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                  aria-label="Submit comment"
                >
                  <Send className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Submit comment</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <ScrollArea className="max-h-[200px]">
          <div className="space-y-3 pr-3">
            {comments.map((comment, index) => (
              <div key={comment.id}>
                <div className="text-[13px] space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-[14px] text-foreground">{comment.username}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground text-[13px]">{comment.timestamp}</span>
                  </div>
                  <p className="text-foreground leading-relaxed">{comment.text}</p>
                </div>
                {index < comments.length - 1 && (
                  <div className="border-t border-[#F0F0F0] mt-3"></div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
