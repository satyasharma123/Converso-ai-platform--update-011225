import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Linkedin, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Message {
  id: string;
  senderName: string;
  content: string;
  timestamp: string;
  isFromLead: boolean;
}

interface MultiChannelTabsProps {
  emailMessages: Message[];
  linkedinMessages: Message[];
  activityLog: Array<{
    id: string;
    description: string;
    timestamp: string;
    type: string;
  }>;
}

export function MultiChannelTabs({ emailMessages, linkedinMessages, activityLog }: MultiChannelTabsProps) {
  return (
    <Tabs defaultValue="email" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="email" className="gap-2">
          <Mail className="h-4 w-4" />
          Email
          <Badge variant="secondary">{emailMessages.length}</Badge>
        </TabsTrigger>
        <TabsTrigger value="linkedin" className="gap-2">
          <Linkedin className="h-4 w-4" />
          LinkedIn
          <Badge variant="secondary">{linkedinMessages.length}</Badge>
        </TabsTrigger>
        <TabsTrigger value="activity" className="gap-2">
          <Activity className="h-4 w-4" />
          Activity Log
        </TabsTrigger>
      </TabsList>

      <TabsContent value="email" className="space-y-4 mt-4">
        {emailMessages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.isFromLead ? "justify-start" : "justify-end"}`}
          >
            <div
              className={`max-w-[70%] rounded-lg p-3 ${
                message.isFromLead
                  ? "bg-muted"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              <div className="font-semibold text-sm mb-1">{message.senderName}</div>
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              <div
                className={`text-xs mt-2 ${
                  message.isFromLead ? "text-muted-foreground" : "opacity-70"
                }`}
              >
                {message.timestamp}
              </div>
            </div>
          </div>
        ))}
      </TabsContent>

      <TabsContent value="linkedin" className="space-y-4 mt-4">
        {linkedinMessages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.isFromLead ? "justify-start" : "justify-end"}`}
          >
            <div
              className={`max-w-[70%] rounded-lg p-3 ${
                message.isFromLead
                  ? "bg-muted"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              <div className="font-semibold text-sm mb-1">{message.senderName}</div>
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              <div
                className={`text-xs mt-2 ${
                  message.isFromLead ? "text-muted-foreground" : "opacity-70"
                }`}
              >
                {message.timestamp}
              </div>
            </div>
          </div>
        ))}
      </TabsContent>

      <TabsContent value="activity" className="space-y-3 mt-4">
        {activityLog.map((event, idx) => (
          <div key={event.id} className="relative pl-4 pb-3">
            {idx !== activityLog.length - 1 && (
              <div className="absolute left-[7px] top-6 bottom-0 w-[2px] bg-border" />
            )}
            <div className="absolute left-0 top-1 h-4 w-4 rounded-full border-2 border-primary bg-background" />
            <div>
              <p className="text-sm font-medium">{event.description}</p>
              <span className="text-xs text-muted-foreground">{event.timestamp}</span>
            </div>
          </div>
        ))}
      </TabsContent>
    </Tabs>
  );
}
