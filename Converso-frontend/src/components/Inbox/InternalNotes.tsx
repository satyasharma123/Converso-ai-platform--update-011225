import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Send, MessageSquare, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";

interface InternalNote {
  id: string;
  author: string;
  content: string;
  timestamp: string;
  mentions: string[];
  isDraft?: boolean;
}

interface InternalNotesProps {
  conversationId: string;
  notes: InternalNote[];
  onConvertToReply?: (noteId: string) => void;
}

export function InternalNotes({ conversationId, notes, onConvertToReply }: InternalNotesProps) {
  const [noteText, setNoteText] = useState("");
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);

  const teamMembers = ["John SDR", "Jane SDR", "Admin User", "Mike Manager"];

  const handleMention = (member: string) => {
    setNoteText(noteText + `@${member} `);
    setShowMentionSuggestions(false);
  };

  const handleNoteChange = (text: string) => {
    setNoteText(text);
    if (text.endsWith("@")) {
      setShowMentionSuggestions(true);
    } else if (!text.includes("@")) {
      setShowMentionSuggestions(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-semibold">Internal Notes</h3>
        <Badge variant="secondary">Team Only</Badge>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {notes.map((note) => (
          <Card key={note.id} className="p-3 bg-muted/50 border-l-4 border-l-primary">
            <div className="flex items-start gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback>{note.author.slice(0, 2)}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm">{note.author}</span>
                  <span className="text-xs text-muted-foreground">{note.timestamp}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                {note.mentions.length > 0 && (
                  <div className="flex gap-1 mt-2">
                    {note.mentions.map((mention) => (
                      <Badge key={mention} variant="outline" className="text-xs">
                        @{mention}
                      </Badge>
                    ))}
                  </div>
                )}
                {note.isDraft && (
                  <Badge variant="secondary" className="mt-2">Draft Reply</Badge>
                )}
              </div>
              {onConvertToReply && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onConvertToReply(note.id)}
                  title="Convert to external reply"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      <div className="relative">
        <Textarea
          placeholder="Add internal note... (type @ to mention teammates)"
          value={noteText}
          onChange={(e) => handleNoteChange(e.target.value)}
          className="min-h-20"
        />
        {showMentionSuggestions && (
          <Card className="absolute bottom-full mb-2 w-full p-2 z-10">
            <div className="space-y-1">
              {teamMembers.map((member) => (
                <Button
                  key={member}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => handleMention(member)}
                >
                  @{member}
                </Button>
              ))}
            </div>
          </Card>
        )}
        <div className="flex justify-between items-center mt-2">
          <span className="text-xs text-muted-foreground">
            Internal notes are never sent externally
          </span>
          <Button size="sm">
            <Send className="h-4 w-4 mr-2" />
            Add Note
          </Button>
        </div>
      </div>
    </div>
  );
}
