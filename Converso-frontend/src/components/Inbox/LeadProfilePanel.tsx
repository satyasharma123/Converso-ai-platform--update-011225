import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Pencil, Check, X } from "lucide-react";
import { useState, useEffect } from "react";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { useUpdateConversationStage, useUpdateLeadProfile, useAssignConversation } from "@/hooks/useConversations";
import { useAuth } from "@/hooks/useAuth";

interface LeadProfilePanelProps {
  lead: {
    name: string;
    email?: string;
    company?: string;
    location?: string;
    stage?: string;
    stageId?: string | null;
    engagementScore: number;
    lastResponseTime: string;
    messageCount: number;
    source?: string;
    account?: string;
    assignedTo?: string;
    assignedToId?: string;
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
  const updateProfileMutation = useUpdateLeadProfile();
  const assignMutation = useAssignConversation();
  
  // Editable fields state
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [editedName, setEditedName] = useState(lead.name);
  const [editedCompany, setEditedCompany] = useState(lead.company || "");
  const [editedLocation, setEditedLocation] = useState(lead.location || "");
  
  // Get the current stage ID from the conversation's custom_stage_id
  const [selectedStage, setSelectedStage] = useState<string | null>(lead.stageId || null);
  const [selectedSDR, setSelectedSDR] = useState<string>(lead.assignedToId || "");
  
  // Sync state with props changes
  useEffect(() => {
    setEditedName(lead.name);
    setEditedCompany(lead.company || "");
    setEditedLocation(lead.location || "");
  }, [lead.name, lead.company, lead.location]);

  useEffect(() => {
    setSelectedSDR(lead.assignedToId || "");
  }, [lead.assignedToId]);

  useEffect(() => {
    setSelectedStage(lead.stageId || null);
  }, [lead.stageId]);

  const handleStageChange = (stageId: string) => {
    setSelectedStage(stageId);
    if (conversationId) {
      updateStageMutation.mutate({
        conversationId,
        stageId: stageId === 'none' ? null : stageId
      });
    }
  };

  const handleSDRChange = (sdrId: string) => {
    setSelectedSDR(sdrId);
    if (conversationId) {
      assignMutation.mutate({
        conversationId,
        sdrId: sdrId === 'unassigned' ? null : sdrId
      });
    }
  };

  const handleSaveName = () => {
    if (conversationId && editedName.trim() && editedName !== lead.name) {
      updateProfileMutation.mutate({
        conversationId,
        updates: { sender_name: editedName.trim() }
      });
    }
    setIsEditingName(false);
  };

  const handleSaveCompany = () => {
    if (conversationId && editedCompany.trim() !== (lead.company || "")) {
      updateProfileMutation.mutate({
        conversationId,
        updates: { company_name: editedCompany.trim() || null }
      });
    }
    setIsEditingCompany(false);
  };

  const handleSaveLocation = () => {
    if (conversationId && editedLocation.trim() !== (lead.location || "")) {
      updateProfileMutation.mutate({
        conversationId,
        updates: { location: editedLocation.trim() || null }
      });
    }
    setIsEditingLocation(false);
  };

  const handleCancelEdit = (field: 'name' | 'company' | 'location') => {
    if (field === 'name') {
      setEditedName(lead.name);
      setIsEditingName(false);
    } else if (field === 'company') {
      setEditedCompany(lead.company || "");
      setIsEditingCompany(false);
    } else if (field === 'location') {
      setEditedLocation(lead.location || "");
      setIsEditingLocation(false);
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

  // Get assigned SDR name
  const assignedSDRName = teamMembers?.find(m => m.id === selectedSDR)?.full_name || "Unassigned";

  return (
    <div className="h-fit px-5 py-4 space-y-6 text-sm">
      {/* Identity */}
      <div className="rounded-2xl border border-border/40 bg-background px-4 py-3 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            <div className="space-y-1.5">
            {isEditingName ? (
              <div className="flex items-center gap-1.5">
                <Input
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="h-8 text-base font-semibold px-2"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') handleCancelEdit('name');
                  }}
                  autoFocus
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleSaveName}
                >
                  <Check className="h-3 w-3 text-green-600" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleCancelEdit('name')}
                >
                  <X className="h-3 w-3 text-red-600" />
                </Button>
              </div>
            ) : (
              <button
                className="text-left text-base font-semibold leading-tight hover:text-primary"
                onClick={() => setIsEditingName(true)}
              >
                {editedName || lead.name}
              </button>
            )}

            {isEditingCompany ? (
              <div className="flex items-center gap-1.5">
                <Input
                  value={editedCompany}
                  onChange={(e) => setEditedCompany(e.target.value)}
                  className="h-7 text-xs text-muted-foreground px-2"
                  placeholder="Company name"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveCompany();
                    if (e.key === 'Escape') handleCancelEdit('company');
                  }}
                  autoFocus
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleSaveCompany}
                >
                  <Check className="h-3 w-3 text-green-600" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleCancelEdit('company')}
                >
                  <X className="h-3 w-3 text-red-600" />
                </Button>
              </div>
            ) : (
              <button
                className="block w-full text-left text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setIsEditingCompany(true)}
              >
                {editedCompany || lead.company || "Add company"}
              </button>
            )}
            </div>

            {lead.email && (
              <p className="text-xs text-muted-foreground break-all mt-2">{lead.email}</p>
            )}
          </div>

          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setIsEditingName(true)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Location / Source / Account */}
      <div className="rounded-2xl border border-border/40 bg-background px-4 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Location</span>
          {isEditingLocation ? (
            <div className="flex items-center gap-1">
              <Input
                value={editedLocation}
                onChange={(e) => setEditedLocation(e.target.value)}
                className="h-6 w-[140px] text-xs px-2"
                placeholder="City, Country"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveLocation();
                  if (e.key === 'Escape') handleCancelEdit('location');
                }}
                autoFocus
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0"
                onClick={handleSaveLocation}
              >
                <Check className="h-3 w-3 text-green-600" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0"
                onClick={() => handleCancelEdit('location')}
              >
                <X className="h-3 w-3 text-red-600" />
              </Button>
            </div>
          ) : (
            <span 
              className="text-xs text-foreground cursor-pointer hover:bg-muted/30 px-2 py-0.5 rounded"
              onClick={() => setIsEditingLocation(true)}
            >
              {editedLocation || lead.location || "Not set"}
            </span>
          )}
        </div>

        {/* Source - Auto fetch */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Source</span>
          <span className="text-xs text-foreground capitalize">{lead.source || (lead.email ? 'Email' : 'LinkedIn')}</span>
        </div>

        {/* Account - Auto fetch */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Account</span>
          <span className="text-xs text-foreground truncate max-w-[140px]" title={lead.account || lead.email || ''}>
            {lead.account || lead.email || "N/A"}
          </span>
        </div>
      </div>

      {/* SDR / Stage / Stats */}
      <div className="rounded-2xl border border-border/40 bg-background px-4 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">SDR</span>
          {userRole === 'admin' ? (
            <Select value={selectedSDR || 'unassigned'} onValueChange={handleSDRChange}>
              <SelectTrigger className="w-auto h-6 text-xs rounded-full bg-muted px-2.5 flex-shrink-0 border-none">
                <SelectValue placeholder="Assign SDR" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {teamMembers?.filter(m => m.role === 'sdr').map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-xs text-foreground">{assignedSDRName}</span>
          )}
        </div>

        {/* Stage - Changeable */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Stage</span>
          <Select value={selectedStage || 'none'} onValueChange={handleStageChange}>
            <SelectTrigger className="w-auto h-6 text-xs rounded-full bg-[#3C3C3C] text-white border-none px-2.5 flex-shrink-0">
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

        {/* Engagement - Auto calculated */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Engagement</span>
          <span className="text-xs font-medium text-foreground">{lead.engagementScore}/100</span>
        </div>

        {/* Messages - Auto calculated */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Messages</span>
          <span className="text-xs font-medium text-foreground">{lead.messageCount}</span>
        </div>

        {/* Last Response */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Last Response</span>
          <span className="text-xs text-foreground">{lead.lastResponseTime}</span>
        </div>
      </div>

      {/* Activity Section */}
      <div className="rounded-2xl border border-border/40 bg-background px-4 py-4">
        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Activity</h4>
        <div className="space-y-3">
          {timeline.slice(0, 3).map((event) => (
            <div key={event.id} className="flex items-start justify-between gap-3">
              <span className="text-xs text-foreground flex-1 min-w-0 break-words">{event.description}</span>
              <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0">{event.timestamp}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Comments Section */}
      <div className="rounded-2xl border border-border/40 bg-background px-4 py-4">
        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Comments (Internal)</h4>
        
        <div className="relative mb-3 bg-muted/30 border border-border/50 rounded-lg">
          <Textarea
            placeholder="Add a comment for internal team…"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleSubmitComment();
              }
            }}
            className="min-h-[48px] text-xs resize-none border-0 bg-transparent p-2 pr-9 focus-visible:ring-0 placeholder:text-muted-foreground"
          />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleSubmitComment}
                  disabled={!commentText.trim()}
                  className="absolute right-2 bottom-2 h-4 w-4 text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                  aria-label="Submit comment"
                >
                  <Send className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Submit comment (Cmd/Ctrl + Enter)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <ScrollArea className="max-h-[180px]">
          <div className="space-y-3 pr-2">
            {comments.map((comment, index) => (
              <div key={comment.id}>
                <div className="text-xs space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-xs text-foreground">{comment.username}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-[10px] text-muted-foreground">{comment.timestamp}</span>
                  </div>
                  <p className="text-xs text-foreground leading-relaxed break-words">{comment.text}</p>
                </div>
                {index < comments.length - 1 && (
                  <div className="border-t border-border/30 mt-3"></div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
