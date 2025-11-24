import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ThumbsUp, Copy } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AISuggestionsProps {
  conversationId: string;
}

export function AISuggestions({ conversationId }: AISuggestionsProps) {
  const suggestedReplies = [
    {
      id: "1",
      text: "Thanks for reaching out! I'd be happy to schedule a demo. Are you available for a 30-minute call this week?",
      sentiment: "positive",
      confidence: 0.92,
    },
    {
      id: "2",
      text: "I appreciate your interest. Let me share some resources about our pricing structure. Would you prefer a detailed breakdown or a quick overview?",
      sentiment: "neutral",
      confidence: 0.87,
    },
  ];

  const sentiment = {
    overall: "positive",
    score: 0.85,
    keywords: ["interested", "demo", "pricing", "soon"],
  };

  const classification = {
    category: "Demo Request",
    confidence: 0.94,
    suggestedTags: ["High Priority", "Warm Lead", "Enterprise"],
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">AI Insights</h3>
        <Badge variant="secondary">Beta</Badge>
      </div>

      <Tabs defaultValue="replies" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="replies">Suggested Replies</TabsTrigger>
          <TabsTrigger value="sentiment">Sentiment</TabsTrigger>
          <TabsTrigger value="classification">Classification</TabsTrigger>
        </TabsList>

        <TabsContent value="replies" className="space-y-3 mt-4">
          {suggestedReplies.map((reply) => (
            <Card key={reply.id} className="p-3 bg-muted/50">
              <p className="text-sm mb-2">{reply.text}</p>
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs">
                  {(reply.confidence * 100).toFixed(0)}% confidence
                </Badge>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost">
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="ghost">
                    <ThumbsUp className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="sentiment" className="mt-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Overall Sentiment</span>
              <Badge variant={sentiment.overall === "positive" ? "default" : "secondary"}>
                {sentiment.overall} ({(sentiment.score * 100).toFixed(0)}%)
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Key Indicators</p>
              <div className="flex gap-2 flex-wrap">
                {sentiment.keywords.map((keyword) => (
                  <Badge key={keyword} variant="outline">
                    {keyword}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="classification" className="mt-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Category</span>
              <Badge>{classification.category}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Confidence</span>
              <span className="text-sm">{(classification.confidence * 100).toFixed(0)}%</span>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Suggested Tags</p>
              <div className="flex gap-2 flex-wrap">
                {classification.suggestedTags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
