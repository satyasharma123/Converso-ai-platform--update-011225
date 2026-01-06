import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Agent1LeadDetectionConfig } from "./Agent1LeadDetectionConfig";
import { Agent2LeadRoutingConfig } from "./Agent2LeadRoutingConfig";
import { Agent3ReplyConfig } from "./Agent3ReplyConfig";
import { Bot, Search, Route, MessageSquare } from "lucide-react";

export type AgentType = 'agent1' | 'agent2' | 'agent3' | null;

interface AgentDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentType: AgentType;
}

const agentConfig = {
  agent1: {
    title: "Lead Detection",
    description: "Automatically identify and tag potential leads in conversations",
    icon: Search,
    component: Agent1LeadDetectionConfig,
  },
  agent2: {
    title: "Lead Routing",
    description: "Route detected leads to the appropriate SDR based on rules",
    icon: Route,
    component: Agent2LeadRoutingConfig,
  },
  agent3: {
    title: "Automated Replies",
    description: "Generate AI-powered reply suggestions or automatically respond",
    icon: MessageSquare,
    component: Agent3ReplyConfig,
  },
};

export function AgentDrawer({ open, onOpenChange, agentType }: AgentDrawerProps) {
  if (!agentType) return null;

  const config = agentConfig[agentType];
  const AgentComponent = config.component;
  const Icon = config.icon;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <SheetTitle className="text-2xl">{config.title}</SheetTitle>
              <SheetDescription className="mt-1">{config.description}</SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <div className="mt-6">
          <AgentComponent />
        </div>
      </SheetContent>
    </Sheet>
  );
}

