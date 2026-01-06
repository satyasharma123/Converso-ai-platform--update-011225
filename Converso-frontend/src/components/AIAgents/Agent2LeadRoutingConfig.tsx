import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useGetAIAgentSettings, useUpdateAIAgentSettings } from "@/hooks/useAIAgentSettings";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";

export function Agent2LeadRoutingConfig() {
  const { data: settings, isLoading, error } = useGetAIAgentSettings();
  const updateSettings = useUpdateAIAgentSettings();
  const [localData, setLocalData] = useState({
    enabled: false,
    channels: [] as string[],
  });

  useEffect(() => {
    if (settings) {
      setLocalData({
        enabled: settings.agent2_enabled,
        channels: [...settings.agent2_channels],
      });
    }
  }, [settings]);

  const agentsDisabled = !settings?.agents_enabled;
  const isDisabled = agentsDisabled || !localData.enabled;

  const handleToggle = (checked: boolean) => {
    setLocalData(prev => ({ ...prev, enabled: checked }));
    updateSettings.mutate({ agent2_enabled: checked });
  };

  const handleChannelToggle = (channel: 'email' | 'linkedin') => {
    const newChannels = localData.channels.includes(channel)
      ? localData.channels.filter(c => c !== channel)
      : [...localData.channels, channel];
    
    setLocalData(prev => ({ ...prev, channels: newChannels }));
    updateSettings.mutate({ agent2_channels: newChannels });
  };

  if (isLoading) return <div className="text-sm text-muted-foreground p-4">Loading settings…</div>;
  if (error) return <div className="text-sm text-destructive p-4">Could not load settings.</div>;
  if (!settings) return <div className="text-sm text-muted-foreground p-4">No settings found for this workspace.</div>;

  return (
    <div className="space-y-6">
      {/* Status Badge */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Status:</span>
        <Badge variant={localData.enabled && !agentsDisabled ? "default" : "secondary"}>
          {localData.enabled && !agentsDisabled ? "Active" : "Inactive"}
        </Badge>
      </div>

      {/* Enable Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Enable Lead Routing</CardTitle>
          <CardDescription>
            Automatically assign detected leads to the right SDR based on routing rules
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label htmlFor="agent2-enabled">Active</Label>
            <Switch
              id="agent2-enabled"
              checked={localData.enabled}
              onCheckedChange={handleToggle}
              disabled={agentsDisabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Channels */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Channels</CardTitle>
          <CardDescription>
            Select which channels to apply routing rules to
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-6">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="agent2-email"
                checked={localData.channels.includes('email')}
                onCheckedChange={() => handleChannelToggle('email')}
                disabled={isDisabled}
              />
              <Label htmlFor="agent2-email" className="cursor-pointer">Email</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="agent2-linkedin"
                checked={localData.channels.includes('linkedin')}
                onCheckedChange={() => handleChannelToggle('linkedin')}
                disabled={isDisabled}
              />
              <Label htmlFor="agent2-linkedin" className="cursor-pointer">LinkedIn</Label>
            </div>
          </div>
          <p className="text-xs text-muted-foreground italic">
            Note: This agent uses rules-based routing. Configure rules in Settings → Routing Rules.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

