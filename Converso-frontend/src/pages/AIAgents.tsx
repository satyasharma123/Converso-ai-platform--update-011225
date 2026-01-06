import { AppLayout } from "@/components/Layout/AppLayout";
import { Card, CardContent, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useGetAIAgentSettings, useUpdateAIAgentSettings } from "@/hooks/useAIAgentSettings";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useState, useEffect } from "react";
import { Loader2, Search, Route, MessageSquare, Bot, Settings } from "lucide-react";
import { AgentDrawer, type AgentType } from "@/components/AIAgents/AgentDrawer";
import { cn } from "@/lib/utils";

export default function AIAgents() {
  const { user } = useAuth();
  const { activeWorkspace, isOwner } = useWorkspace();
  const workspaceRole = (activeWorkspace?.role || "").toString().toLowerCase();
  const isAdmin = isOwner || workspaceRole === "admin";

  const { data: settings, isLoading, error } = useGetAIAgentSettings();
  const updateSettings = useUpdateAIAgentSettings();
  const [selectedAgent, setSelectedAgent] = useState<AgentType>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleAgentClick = (agentType: AgentType) => {
    setSelectedAgent(agentType);
    setDrawerOpen(true);
  };

  const handleMasterToggle = (checked: boolean) => {
    updateSettings.mutate({ agents_enabled: checked });
  };

  const getAgentStatus = (agentType: 'agent1' | 'agent2' | 'agent3') => {
    if (isLoading) return { enabled: false, label: "Loading…" };
    if (error) return { enabled: false, label: "Error" };
    if (!settings) return { enabled: false, label: "—" };
    const agentsDisabled = !settings.agents_enabled;
    
    if (agentType === 'agent1') {
      return {
        enabled: settings.agent1_enabled && !agentsDisabled,
        label: settings.agent1_enabled && !agentsDisabled ? "Active" : "Inactive",
      };
    }
    if (agentType === 'agent2') {
      return {
        enabled: settings.agent2_enabled && !agentsDisabled,
        label: settings.agent2_enabled && !agentsDisabled ? "Active" : "Inactive",
      };
    }
    if (agentType === 'agent3') {
      const modeLabels: Record<string, string> = {
        off: 'Off',
        draft: 'Draft Only',
        assisted: 'Assisted',
        auto: 'Auto Reply',
      };
      return {
        enabled: settings.agent3_enabled && !agentsDisabled,
        label: settings.agent3_enabled && !agentsDisabled 
          ? modeLabels[settings.agent3_mode] || settings.agent3_mode
          : "Inactive",
      };
    }
    return { enabled: false, label: "Unknown" };
  };

  const agents = [
    {
      id: 'agent1' as const,
      name: "Lead Detection",
      description: "Automatically identify and tag potential leads in conversations using AI analysis",
      icon: Search,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      id: 'agent2' as const,
      name: "Lead Routing",
      description: "Route detected leads to the appropriate SDR based on configured rules",
      icon: Route,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      id: 'agent3' as const,
      name: "Automated Replies",
      description: "Generate AI-powered reply suggestions or automatically respond to conversations",
      icon: MessageSquare,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
  ];

  if (!isAdmin) {
    return (
      <AppLayout userName={user?.email || "User"}>
        <div className="flex items-center justify-center h-[calc(100vh-56px)]">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
            <p className="text-muted-foreground">Only Admin and Owner can access AI Agent settings.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout userName={user?.email || "User"}>
      <div className="flex flex-col h-[calc(100vh-56px)] min-h-0">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-background border-b pb-4 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">AI Agents</h1>
              <p className="text-muted-foreground mt-1">Configure and manage your AI-powered automation agents</p>
            </div>
          </div>
        </div>

        {/* Master Toggle */}
        {settings && (
          <div className="border-b bg-muted/30 px-6 py-4">
            <div className="flex items-center justify-between max-w-4xl mx-auto">
              <div className="space-y-0.5">
                <Label htmlFor="agents-enabled" className="text-base font-medium">
                  Enable AI Agents
                </Label>
                <p className="text-sm text-muted-foreground">
                  Master switch to enable or disable all AI agents at once
                </p>
              </div>
              <Switch
                id="agents-enabled"
                checked={settings.agents_enabled}
                onCheckedChange={handleMasterToggle}
              />
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-4">
              {agents.map((agent) => {
                const status = getAgentStatus(agent.id);
                const Icon = agent.icon;
                
                return (
                  <Card
                    key={agent.id}
                    className={cn(
                      "cursor-pointer transition-all hover:shadow-md hover:border-primary/50",
                      !settings?.agents_enabled && "opacity-60"
                    )}
                    onClick={() => handleAgentClick(agent.id)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        {/* Icon */}
                        <div className={cn("p-3 rounded-lg", agent.bgColor)}>
                          <Icon className={cn("h-6 w-6", agent.color)} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold mb-1">{agent.name}</h3>
                              <p className="text-sm text-muted-foreground mb-3">
                                {agent.description}
                              </p>
                            </div>
                            <Badge 
                              variant={status.enabled ? "default" : "secondary"}
                              className="shrink-0"
                            >
                              {status.label}
                            </Badge>
                          </div>
                          
                          {/* Channel badges */}
                          {settings && (
                            <div className="flex items-center gap-2 mt-3">
                              <span className="text-xs text-muted-foreground">Channels:</span>
                              {agent.id === 'agent1' && settings.agent1_channels.length > 0 && (
                                <div className="flex gap-1">
                                  {settings.agent1_channels.map((ch) => (
                                    <Badge key={ch} variant="outline" className="text-xs">
                                      {ch}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                              {agent.id === 'agent2' && settings.agent2_channels.length > 0 && (
                                <div className="flex gap-1">
                                  {settings.agent2_channels.map((ch) => (
                                    <Badge key={ch} variant="outline" className="text-xs">
                                      {ch}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                              {agent.id === 'agent3' && settings.agent3_channels.length > 0 && (
                                <div className="flex gap-1">
                                  {settings.agent3_channels.map((ch) => (
                                    <Badge key={ch} variant="outline" className="text-xs">
                                      {ch}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Arrow indicator */}
                        <div className="text-muted-foreground shrink-0">
                          <svg
                            className="h-5 w-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {/* Permissions Card (Admin only) */}
              {isAdmin && (
                <Card className="mt-6 border-dashed">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-lg bg-gray-100">
                        <Settings className="h-6 w-6 text-gray-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold mb-1">Permissions</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Control which agents SDRs can manage
                        </p>
                        {settings && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="allow-sdr-agents" className="text-sm">
                                Allow SDRs to manage Lead Detection
                              </Label>
                              <Switch
                                id="allow-sdr-agents"
                                checked={settings.allow_sdr_manage_agents}
                                onCheckedChange={(checked) =>
                                  updateSettings.mutate({ allow_sdr_manage_agents: checked })
                                }
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <Label htmlFor="allow-sdr-agent3" className="text-sm">
                                Allow SDRs to manage Automated Replies
                              </Label>
                              <Switch
                                id="allow-sdr-agent3"
                                checked={settings.allow_sdr_manage_agent3}
                                onCheckedChange={(checked) =>
                                  updateSettings.mutate({ allow_sdr_manage_agent3: checked })
                                }
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Agent Configuration Drawer */}
      <AgentDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        agentType={selectedAgent}
      />
    </AppLayout>
  );
}
