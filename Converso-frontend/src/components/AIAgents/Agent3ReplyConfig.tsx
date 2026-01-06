import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useGetAIAgentSettings, useUpdateAIAgentSettings } from "@/hooks/useAIAgentSettings";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/context/WorkspaceContext";

export function Agent3ReplyConfig() {
  const { data: settings, isLoading, error } = useGetAIAgentSettings();
  const updateSettings = useUpdateAIAgentSettings();
  const { activeWorkspace, isOwner } = useWorkspace();
  const workspaceRole = (activeWorkspace?.role || "").toString().toLowerCase();
  const isAdmin = isOwner || workspaceRole === "admin";
  
  const [localData, setLocalData] = useState({
    enabled: false,
    channels: [] as string[],
    mode: 'draft' as 'off' | 'draft' | 'assisted' | 'auto',
  });

  useEffect(() => {
    if (settings) {
      setLocalData({
        enabled: settings.agent3_enabled,
        channels: [...settings.agent3_channels],
        mode: settings.agent3_mode,
      });
    }
  }, [settings]);

  const agentsDisabled = !settings?.agents_enabled;
  const isDisabled = agentsDisabled || !localData.enabled;
  const canManage = isAdmin || settings?.allow_sdr_manage_agent3;

  const handleToggle = (checked: boolean) => {
    if (!canManage) return;
    setLocalData(prev => ({ ...prev, enabled: checked }));
    updateSettings.mutate({ agent3_enabled: checked });
  };

  const handleChannelToggle = (channel: 'email' | 'linkedin') => {
    if (!canManage) return;
    const newChannels = localData.channels.includes(channel)
      ? localData.channels.filter(c => c !== channel)
      : [...localData.channels, channel];
    
    setLocalData(prev => ({ ...prev, channels: newChannels }));
    updateSettings.mutate({ agent3_channels: newChannels });
  };

  const handleModeChange = (value: 'off' | 'draft' | 'assisted' | 'auto') => {
    if (!canManage) return;
    setLocalData(prev => ({ ...prev, mode: value }));
    updateSettings.mutate({ agent3_mode: value });
  };

  if (isLoading) return <div className="text-sm text-muted-foreground p-4">Loading settings…</div>;
  if (error) return <div className="text-sm text-destructive p-4">Could not load settings.</div>;
  if (!settings) return <div className="text-sm text-muted-foreground p-4">No settings found for this workspace.</div>;

  const getModeLabel = (mode: string) => {
    switch (mode) {
      case 'off': return 'Off';
      case 'draft': return 'Draft Only';
      case 'assisted': return 'Assisted';
      case 'auto': return 'Auto Reply';
      default: return mode;
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Badge */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Status:</span>
        <Badge variant={localData.enabled && !agentsDisabled ? "default" : "secondary"}>
          {localData.enabled && !agentsDisabled ? `${getModeLabel(localData.mode)}` : "Inactive"}
        </Badge>
      </div>

      {!canManage && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
          You don't have permission to manage this agent. Contact your admin to enable access.
        </div>
      )}

      {/* Enable Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Enable Automated Replies</CardTitle>
          <CardDescription>
            Generate AI-powered reply suggestions or automatically respond to conversations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label htmlFor="agent3-enabled">Active</Label>
            <Switch
              id="agent3-enabled"
              checked={localData.enabled}
              onCheckedChange={handleToggle}
              disabled={agentsDisabled || !canManage}
            />
          </div>
        </CardContent>
      </Card>

      {/* Mode Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reply Mode</CardTitle>
          <CardDescription>
            Choose how the agent handles reply generation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            value={localData.mode}
            onValueChange={(value: 'off' | 'draft' | 'assisted' | 'auto') => handleModeChange(value)}
            disabled={isDisabled || !canManage}
          >
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="off" id="agent3-off" />
                <Label htmlFor="agent3-off" className="cursor-pointer font-normal">
                  <span className="font-medium">Off</span>
                  <span className="text-xs text-muted-foreground ml-2">— Disabled</span>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="draft" id="agent3-draft" />
                <Label htmlFor="agent3-draft" className="cursor-pointer font-normal">
                  <span className="font-medium">Draft Only</span>
                  <span className="text-xs text-muted-foreground ml-2">— Generate drafts for review</span>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="assisted" id="agent3-assisted" />
                <Label htmlFor="agent3-assisted" className="cursor-pointer font-normal">
                  <span className="font-medium">Assisted</span>
                  <span className="text-xs text-muted-foreground ml-2">— Require manual approval before sending</span>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="auto" id="agent3-auto" />
                <Label htmlFor="agent3-auto" className="cursor-pointer font-normal">
                  <span className="font-medium">Auto Reply</span>
                  <span className="text-xs text-muted-foreground ml-2">— Send automatically (use with caution)</span>
                </Label>
              </div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Channels */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Channels</CardTitle>
          <CardDescription>
            Select which channels to generate replies for
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-6">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="agent3-email"
                checked={localData.channels.includes('email')}
                onCheckedChange={() => handleChannelToggle('email')}
                disabled={isDisabled || !canManage}
              />
              <Label htmlFor="agent3-email" className="cursor-pointer">Email</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="agent3-linkedin"
                checked={localData.channels.includes('linkedin')}
                onCheckedChange={() => handleChannelToggle('linkedin')}
                disabled={isDisabled || !canManage}
              />
              <Label htmlFor="agent3-linkedin" className="cursor-pointer">LinkedIn</Label>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

