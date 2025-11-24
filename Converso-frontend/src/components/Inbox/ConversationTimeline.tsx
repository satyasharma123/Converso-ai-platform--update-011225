import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Users, Tag, MessageSquare, CheckCircle, 
  Send, Clock, UserPlus, Archive 
} from "lucide-react";

interface TimelineEvent {
  id: string;
  type: "assignment" | "status_change" | "message" | "note" | "tag" | "archived";
  description: string;
  timestamp: string;
  actor: string;
  metadata?: any;
}

interface ConversationTimelineProps {
  events: TimelineEvent[];
}

const getEventIcon = (type: string) => {
  switch (type) {
    case "assignment":
      return <UserPlus className="h-4 w-4 text-blue-600" />;
    case "status_change":
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case "message":
      return <Send className="h-4 w-4 text-purple-600" />;
    case "note":
      return <MessageSquare className="h-4 w-4 text-orange-600" />;
    case "tag":
      return <Tag className="h-4 w-4 text-pink-600" />;
    case "archived":
      return <Archive className="h-4 w-4 text-gray-600" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
};

const getEventColor = (type: string) => {
  switch (type) {
    case "assignment":
      return "border-blue-600";
    case "status_change":
      return "border-green-600";
    case "message":
      return "border-purple-600";
    case "note":
      return "border-orange-600";
    case "tag":
      return "border-pink-600";
    case "archived":
      return "border-gray-600";
    default:
      return "border-border";
  }
};

export function ConversationTimeline({ events }: ConversationTimelineProps) {
  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <Clock className="h-5 w-5 text-muted-foreground" />
        Activity Timeline
      </h3>
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {events.map((event, idx) => (
          <div key={event.id} className="relative pl-8">
            {idx !== events.length - 1 && (
              <div className="absolute left-[15px] top-8 bottom-0 w-[2px] bg-border" />
            )}
            <div className={`absolute left-0 top-1 h-8 w-8 rounded-full border-2 ${getEventColor(event.type)} bg-background flex items-center justify-center`}>
              {getEventIcon(event.type)}
            </div>
            <div>
              <div className="flex items-start justify-between mb-1">
                <p className="text-sm font-medium">{event.description}</p>
                <Badge variant="outline" className="text-xs capitalize">
                  {event.type.replace("_", " ")}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{event.actor}</span>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground">{event.timestamp}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
