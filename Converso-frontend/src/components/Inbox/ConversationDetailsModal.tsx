import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mail, Linkedin, Clock, User, Building, Tag, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMessages } from "@/hooks/useMessages";

interface ConversationDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: {
    id: string;
    senderName: string;
    senderEmail?: string;
    subject?: string;
    preview: string;
    timestamp: string;
    type: "email" | "linkedin";
    status: "new" | "engaged" | "qualified" | "converted" | "not_interested";
    isRead: boolean;
    assignedTo?: string;
    receivedAccount?: {
      account_name: string;
      account_email?: string;
      account_type: string;
    };
  } | null;
}

export function ConversationDetailsModal({ 
  open, 
  onOpenChange, 
  conversation 
}: ConversationDetailsModalProps) {
  const { data: messages = [] } = useMessages(conversation?.id || null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new": return "bg-blue-500";
      case "engaged": return "bg-yellow-500";
      case "qualified": return "bg-purple-500";
      case "converted": return "bg-green-500";
      case "not_interested": return "bg-red-500";
      default: return "bg-muted";
    }
  };

  const getStatusLabel = (status: string) => {
    return status.replace('_', ' ').toUpperCase();
  };

  if (!conversation) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {conversation.type === "email" ? (
              <Mail className="h-5 w-5" />
            ) : (
              <Linkedin className="h-5 w-5 text-blue-600" />
            )}
            Conversation Details
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex gap-4">
          {/* Lead Information Panel */}
          <div className="w-80 flex-shrink-0 space-y-4">
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <User className="h-4 w-4" />
                Lead Information
              </h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Name:</span>
                  <p className="font-medium">{conversation.senderName}</p>
                </div>
                {conversation.senderEmail && (
                  <div>
                    <span className="text-muted-foreground">Email:</span>
                    <p className="font-medium break-all">{conversation.senderEmail}</p>
                  </div>
                )}
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Metadata
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <div className="mt-1">
                    <Badge className={cn("text-white", getStatusColor(conversation.status))}>
                      {getStatusLabel(conversation.status)}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Assigned To:</span>
                  <p className="font-medium mt-1">
                    {conversation.assignedTo || (
                      <span className="text-orange-500">Unassigned</span>
                    )}
                  </p>
                </div>
                {conversation.receivedAccount && (
                  <div>
                    <span className="text-muted-foreground">Received On:</span>
                    <div className="mt-1 flex items-center gap-2">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{conversation.receivedAccount.account_name}</p>
                        {conversation.receivedAccount.account_email && (
                          <p className="text-xs text-muted-foreground">
                            {conversation.receivedAccount.account_email}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Type:</span>
                  <div className="mt-1 flex items-center gap-2">
                    {conversation.type === "email" ? (
                      <>
                        <Mail className="h-4 w-4" />
                        <span className="font-medium">Email</span>
                      </>
                    ) : (
                      <>
                        <Linkedin className="h-4 w-4 text-blue-600" />
                        <span className="font-medium">LinkedIn</span>
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Last Activity:</span>
                  <div className="mt-1 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span className="font-medium">{conversation.timestamp}</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Message History */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="h-5 w-5" />
              <h3 className="font-semibold">Message History</h3>
              <Badge variant="secondary" className="ml-auto">
                {messages.length} {messages.length === 1 ? 'message' : 'messages'}
              </Badge>
            </div>

            <Separator className="mb-3" />

            {conversation.subject && (
              <div className="mb-4 p-3 bg-muted rounded-lg">
                <span className="text-xs text-muted-foreground">Subject:</span>
                <p className="font-medium">{conversation.subject}</p>
              </div>
            )}

            <ScrollArea className="flex-1 pr-4">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-40">
                  <p className="text-muted-foreground">No messages yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex gap-3",
                        !message.isFromLead && "flex-row-reverse"
                      )}
                    >
                      <div
                        className={cn(
                          "flex-1 p-4 rounded-lg",
                          message.isFromLead
                            ? "bg-muted"
                            : "bg-primary text-primary-foreground"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="font-semibold text-sm">
                            {message.senderName}
                          </span>
                          <span className={cn(
                            "text-xs whitespace-nowrap",
                            message.isFromLead 
                              ? "text-muted-foreground" 
                              : "text-primary-foreground/70"
                          )}>
                            {message.timestamp}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {message.content}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
