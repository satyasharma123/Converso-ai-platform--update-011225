import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SavedReply {
  id: string;
  title: string;
  content: string;
  category: string;
  shortcut?: string;
}

interface SavedRepliesProps {
  onSelectReply: (content: string) => void;
}

export function SavedReplies({ onSelectReply }: SavedRepliesProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [open, setOpen] = useState(false);

  const handleSelectReply = (content: string) => {
    onSelectReply(content);
    setOpen(false);
    setSearchQuery("");
  };

  const savedReplies: SavedReply[] = [
    {
      id: "1",
      title: "Demo Request Response",
      content: "Thanks for your interest! I'd love to schedule a personalized demo. Are you available this week?",
      category: "demo",
      shortcut: "/demo",
    },
    {
      id: "2",
      title: "Pricing Inquiry",
      content: "Great question! Our pricing varies based on your team size and needs. Can you share more details?",
      category: "pricing",
      shortcut: "/pricing",
    },
    {
      id: "3",
      title: "Follow-up After Demo",
      content: "It was great speaking with you! Do you have any additional questions about what we discussed?",
      category: "follow-up",
      shortcut: "/followup",
    },
    {
      id: "4",
      title: "Qualification Questions",
      content: "To better understand your needs: What's your current team size? What's your main challenge right now?",
      category: "qualification",
      shortcut: "/qualify",
    },
    {
      id: "5",
      title: "Objection - Price",
      content: "I understand budget is important. Let me show you the ROI our customers typically see in the first quarter.",
      category: "objection",
      shortcut: "/objection-price",
    },
  ];

  const categories = ["demo", "pricing", "follow-up", "qualification", "objection"];

  const filteredReplies = savedReplies.filter(
    (reply) =>
      reply.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reply.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reply.shortcut?.includes(searchQuery)
  );

  const getRepliesByCategory = (category: string) =>
    filteredReplies.filter((reply) => reply.category === category);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 text-xs px-2">
          <FileText className="h-3.5 w-3.5 mr-1.5" />
          Templates
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Saved Replies & Templates</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates or type / for shortcuts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Tabs defaultValue="all" className="w-full">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              {categories.map((cat) => (
                <TabsTrigger key={cat} value={cat} className="capitalize">
                  {cat}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="all" className="space-y-2 mt-4">
              {filteredReplies.map((reply) => (
                <Card
                  key={reply.id}
                  className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleSelectReply(reply.content)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium">{reply.title}</h4>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="capitalize">
                        {reply.category}
                      </Badge>
                      {reply.shortcut && (
                        <Badge variant="secondary">{reply.shortcut}</Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{reply.content}</p>
                </Card>
              ))}
            </TabsContent>

            {categories.map((category) => (
              <TabsContent key={category} value={category} className="space-y-2 mt-4">
                {getRepliesByCategory(category).map((reply) => (
                  <Card
                    key={reply.id}
                    className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleSelectReply(reply.content)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium">{reply.title}</h4>
                      {reply.shortcut && (
                        <Badge variant="secondary">{reply.shortcut}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{reply.content}</p>
                  </Card>
                ))}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
