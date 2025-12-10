import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Linkedin, Send, MoreVertical } from "lucide-react";
import { useState, useEffect } from "react";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { useUpdateConversationStage, useUpdateLeadProfile, useAssignConversation } from "@/hooks/useConversations";
import { useLeadNotes, useAddLeadNote, useUpdateLeadNote, useDeleteLeadNote } from "@/hooks/useLeadNotes";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { formatDistanceToNow } from "date-fns";

interface LeadProfilePanelProps {
  lead: {
    name: string;
    email?: string;
    mobile?: string;
    profilePictureUrl?: string | null;
    linkedinUrl?: string | null;
    company?: string;
    location?: string;
    stage?: string;
    stageId?: string | null;
    score?: number;
    source?: string;
    channel?: string;
    lastMessageAt?: string;
    assignedTo?: string;
    assignedToId?: string;
  };
  conversationId?: string;
}

export function LeadProfilePanel({ lead, conversationId }: LeadProfilePanelProps) {
  const { user, userRole } = useAuth();
  const { data: currentUserProfile } = useProfile();
  const [noteText, setNoteText] = useState("");
  const { data: teamMembers } = useTeamMembers();
  const { data: pipelineStages = [] } = usePipelineStages();
  const updateStageMutation = useUpdateConversationStage();
  const updateProfileMutation = useUpdateLeadProfile();
  const assignMutation = useAssignConversation();
  const { data: notes = [] } = useLeadNotes(conversationId);
  const addNoteMutation = useAddLeadNote();
  const updateNoteMutation = useUpdateLeadNote();
  const deleteNoteMutation = useDeleteLeadNote();
  
  // Editable fields state
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [isEditingMobile, setIsEditingMobile] = useState(false);
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [editedEmail, setEditedEmail] = useState(lead.email || "");
  const [editedMobile, setEditedMobile] = useState(lead.mobile || "");
  const [editedLocation, setEditedLocation] = useState(lead.location || "");
  const [editedCompany, setEditedCompany] = useState(lead.company || "");
  
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");
  
  const [selectedStage, setSelectedStage] = useState<string | null>(lead.stageId || null);
  const [selectedSDR, setSelectedSDR] = useState<string>(lead.assignedToId || "");
  
  // Sync state with props changes
  useEffect(() => {
    setEditedEmail(lead.email || "");
    setEditedMobile(lead.mobile || "");
    setEditedLocation(lead.location || "");
    setEditedCompany(lead.company || "");
  }, [lead.email, lead.mobile, lead.location, lead.company]);

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
    const newSdrId = sdrId === 'unassigned' ? '' : sdrId;
    setSelectedSDR(newSdrId);
    if (conversationId) {
      assignMutation.mutate({
        conversationId,
        sdrId: sdrId === 'unassigned' ? null : sdrId
      }, {
        onSuccess: () => {
          setSelectedSDR(newSdrId);
        }
      });
    }
  };

  const handleSaveEmail = () => {
    if (conversationId && editedEmail.trim() !== (lead.email || "")) {
      updateProfileMutation.mutate({
        conversationId,
        updates: { sender_email: editedEmail.trim() || undefined }
      });
    }
    setIsEditingEmail(false);
  };

  const handleSaveMobile = () => {
    if (conversationId && editedMobile.trim() !== (lead.mobile || "")) {
      updateProfileMutation.mutate({
        conversationId,
        updates: { mobile: editedMobile.trim() || undefined }
      });
    }
    setIsEditingMobile(false);
  };

  const handleSaveLocation = () => {
    if (conversationId && editedLocation.trim() !== (lead.location || "")) {
      updateProfileMutation.mutate({
        conversationId,
        updates: { location: editedLocation.trim() || undefined }
      });
    }
    setIsEditingLocation(false);
  };

  const handleSaveCompany = () => {
    if (conversationId && editedCompany.trim() !== (lead.company || "")) {
      updateProfileMutation.mutate({
        conversationId,
        updates: { company_name: editedCompany.trim() || undefined }
      });
    }
    setIsEditingCompany(false);
  };

  const handleSubmitNote = () => {
    if (!noteText.trim() || !conversationId) return;
    
    const userName = currentUserProfile?.full_name || user?.email || "User";
    addNoteMutation.mutate({
      conversationId,
      noteText: noteText.trim(),
      userName
    }, {
      onSuccess: () => {
        setNoteText("");
      }
    });
  };

  const handleEditNote = (noteId: string, currentText: string) => {
    setEditingNoteId(noteId);
    setEditingNoteText(currentText);
  };

  const handleSaveEditNote = () => {
    if (!editingNoteId || !conversationId || !editingNoteText.trim()) return;
    
    updateNoteMutation.mutate({
      noteId: editingNoteId,
      noteText: editingNoteText.trim(),
      conversationId
    }, {
      onSuccess: () => {
        setEditingNoteId(null);
        setEditingNoteText("");
      }
    });
  };

  const handleDeleteNote = (noteId: string) => {
    if (!conversationId) return;
    deleteNoteMutation.mutate({ noteId, conversationId });
  };

  const currentSdrId = selectedSDR || lead.assignedToId || "";
  const assignedSDR = teamMembers?.find(m => m.id === currentSdrId);
  const assignedSDRName = assignedSDR?.full_name || "Unassigned";

  // Get current stage name
  const currentStage = pipelineStages.find(s => s.id === selectedStage);
  const stageName = currentStage?.name || "Prospect";

  // Calculate last message time
  const lastMessageTime = lead.lastMessageAt 
    ? formatDistanceToNow(new Date(lead.lastMessageAt), { addSuffix: false })
    : "";

  // Get initials for avatar
  const initials = lead.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // Check if user can edit (both admin and assigned SDR)
  const canEdit = userRole === 'admin' || (userRole === 'sdr' && currentSdrId === user?.id);
  const canEditSDR = userRole === 'admin';

  return (
    <div className="h-full bg-white rounded-lg border overflow-y-auto">
      <ScrollArea className="h-full">
        <div className="px-4 py-5 space-y-3">
          {/* Profile Header */}
          <div className="flex flex-col items-center text-center space-y-2">
            <Avatar className="h-12 w-12">
              <AvatarImage src={lead.profilePictureUrl || undefined} alt={lead.name} />
              <AvatarFallback className="bg-muted text-sm font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="w-full">
              <h2 className="text-base font-semibold leading-tight">{lead.name}</h2>
              {isEditingCompany && canEdit ? (
                <div className="flex items-center justify-center gap-1 mt-0.5">
                  <Input
                    value={editedCompany}
                    onChange={(e) => setEditedCompany(e.target.value)}
                    className="h-6 text-xs px-2 text-center max-w-[200px]"
                    placeholder="Company name"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveCompany();
                      if (e.key === 'Escape') {
                        setEditedCompany(lead.company || "");
                        setIsEditingCompany(false);
                      }
                    }}
                    onBlur={handleSaveCompany}
                    autoFocus
                  />
                </div>
              ) : (
                <p 
                  className={`text-xs text-muted-foreground mt-0.5 ${canEdit ? 'cursor-pointer hover:text-foreground' : ''}`}
                  onClick={() => canEdit && setIsEditingCompany(true)}
                >
                  {editedCompany || lead.company || "Add company"}
                </p>
              )}
            </div>
            {lead.linkedinUrl && (
              <a
                href={lead.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[#0077B5] hover:bg-[#006399] transition-colors"
              >
                <Linkedin className="h-4 w-4 text-white" />
              </a>
            )}
          </div>

          {/* Stage & SDR Card */}
          <div className="rounded-lg border px-3 py-2.5 space-y-2.5">
            {/* Stage */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Stage</span>
              {canEdit ? (
                <Select value={selectedStage || 'none'} onValueChange={handleStageChange}>
                  <SelectTrigger className="w-auto h-7 text-xs border-0 shadow-none p-0 focus:ring-0">
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelineStages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {stage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-xs font-medium">{stageName}</span>
              )}
            </div>

            {/* SDR */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">SDR</span>
              {canEditSDR ? (
                <Select value={selectedSDR || 'unassigned'} onValueChange={handleSDRChange}>
                  <SelectTrigger className="w-auto h-7 text-xs border-0 shadow-none p-0 focus:ring-0">
                    <SelectValue placeholder={assignedSDRName} />
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
                <span className="text-xs font-medium">{assignedSDRName}</span>
              )}
            </div>
          </div>

          {/* Contact Info Card - Block 1: Email, Mobile, Location */}
          <div className="rounded-lg border px-3 py-2.5 space-y-2.5">
            {/* Email */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Email</span>
              {isEditingEmail && canEdit ? (
                <div className="flex items-center gap-1 flex-1 ml-2">
                  <Input
                    value={editedEmail}
                    onChange={(e) => setEditedEmail(e.target.value)}
                    className="h-6 text-xs px-2"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEmail();
                      if (e.key === 'Escape') {
                        setEditedEmail(lead.email || "");
                        setIsEditingEmail(false);
                      }
                    }}
                    onBlur={handleSaveEmail}
                    autoFocus
                  />
                </div>
              ) : (
                <span 
                  className={`text-xs ${canEdit ? 'cursor-pointer hover:text-foreground' : ''} truncate max-w-[180px]`}
                  onClick={() => canEdit && setIsEditingEmail(true)}
                  title={editedEmail || lead.email}
                >
                  {editedEmail || lead.email || "Not set"}
                </span>
              )}
            </div>

            {/* Mobile */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Mobile</span>
              {isEditingMobile && canEdit ? (
                <div className="flex items-center gap-1 flex-1 ml-2">
                  <Input
                    value={editedMobile}
                    onChange={(e) => setEditedMobile(e.target.value)}
                    className="h-6 text-xs px-2"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveMobile();
                      if (e.key === 'Escape') {
                        setEditedMobile(lead.mobile || "");
                        setIsEditingMobile(false);
                      }
                    }}
                    onBlur={handleSaveMobile}
                    autoFocus
                  />
                </div>
              ) : (
                <span 
                  className={`text-xs ${canEdit ? 'cursor-pointer hover:text-foreground' : ''}`}
                  onClick={() => canEdit && setIsEditingMobile(true)}
                >
                  {editedMobile || lead.mobile || "Not set"}
                </span>
              )}
            </div>

            {/* Location */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Location</span>
              {isEditingLocation && canEdit ? (
                <div className="flex items-center gap-1 flex-1 ml-2">
                  <Input
                    value={editedLocation}
                    onChange={(e) => setEditedLocation(e.target.value)}
                    className="h-6 text-xs px-2"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveLocation();
                      if (e.key === 'Escape') {
                        setEditedLocation(lead.location || "");
                        setIsEditingLocation(false);
                      }
                    }}
                    onBlur={handleSaveLocation}
                    autoFocus
                  />
                </div>
              ) : (
                <span 
                  className={`text-xs ${canEdit ? 'cursor-pointer hover:text-foreground' : ''}`}
                  onClick={() => canEdit && setIsEditingLocation(true)}
                >
                  {editedLocation || lead.location || "Not set"}
                </span>
              )}
            </div>
          </div>

          {/* Additional Info Card - Block 2: Source, Channel, Score */}
          <div className="rounded-lg border px-3 py-2.5 space-y-2.5">
            {/* Source */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Source</span>
              <span className="text-xs font-medium">{lead.source || assignedSDRName}</span>
            </div>

            {/* Channel */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Channel</span>
              <span className="text-xs font-medium capitalize">{lead.channel || (lead.linkedinUrl ? 'LinkedIn' : 'Email')}</span>
            </div>

            {/* Score */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Score</span>
              <span className="text-xs font-medium">{lead.score || 50} / 100</span>
            </div>
          </div>

          {/* Activity Card */}
          <div className="rounded-lg border px-3 py-2.5">
            <h4 className="text-xs font-semibold mb-2">Activity</h4>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Last Message</span>
              <span className="text-xs">{lastMessageTime || "N/A"}</span>
            </div>
          </div>

          {/* Notes Card */}
          <div className="rounded-lg border px-3 py-2.5">
            <h4 className="text-xs font-semibold mb-2">Notes</h4>
            
            {/* Add Note */}
            <div className="relative mb-3">
              <Textarea
                placeholder="Add a note..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleSubmitNote();
                  }
                }}
                className="min-h-[56px] text-xs resize-none pr-8 py-2"
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={handleSubmitNote}
                disabled={!noteText.trim()}
                className="absolute right-1.5 bottom-1.5 h-5 w-5"
              >
                <Send className="h-3 w-3" />
              </Button>
            </div>

            {/* Notes List */}
            <div className="space-y-2.5">
              {notes.map((note) => {
                const isOwner = note.user_id === user?.id;
                const noteTime = formatDistanceToNow(new Date(note.created_at), { addSuffix: true });
                
                return (
                  <div key={note.id} className="group relative">
                    {editingNoteId === note.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editingNoteText}
                          onChange={(e) => setEditingNoteText(e.target.value)}
                          className="min-h-[56px] text-xs resize-none"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleSaveEditNote} className="h-7 text-xs">
                            Save
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => {
                              setEditingNoteId(null);
                              setEditingNoteText("");
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-[11px] font-semibold">{note.user_name}</span>
                              <span className="text-[10px] text-muted-foreground">· {noteTime}</span>
                            </div>
                            <p className="text-xs text-foreground break-words leading-relaxed">{note.note_text}</p>
                          </div>
                          
                          {isOwner && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                >
                                  <MoreVertical className="h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEditNote(note.id, note.note_text)}>
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteNote(note.id)}
                                  className="text-destructive"
                                >
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
