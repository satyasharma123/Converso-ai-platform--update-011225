import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { useGetAIAgentSettings, useUpdateAIAgentSettings } from "@/hooks/useAIAgentSettings";
import { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";

export function Agent1LeadDetectionConfig() {
  const { data: settings, isLoading, error } = useGetAIAgentSettings();
  const updateSettings = useUpdateAIAgentSettings();
  const [localData, setLocalData] = useState({
    enabled: false,
    channels: [] as string[],
    min_confidence: 0.8,
  });
  const confidenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (settings) {
      setLocalData({
        enabled: settings.agent1_enabled,
        channels: [...settings.agent1_channels],
        min_confidence: settings.agent1_min_confidence,
      });
    }
  }, [settings]);

  const agentsDisabled = !settings?.agents_enabled;
  const isDisabled = agentsDisabled || !localData.enabled;

  const handleToggle = (checked: boolean) => {
    setLocalData(prev => ({ ...prev, enabled: checked }));
    updateSettings.mutate({ agent1_enabled: checked });
  };

  const handleChannelToggle = (channel: 'email' | 'linkedin') => {
    const newChannels = localData.channels.includes(channel)
      ? localData.channels.filter(c => c !== channel)
      : [...localData.channels, channel];
    
    setLocalData(prev => ({ ...prev, channels: newChannels }));
    updateSettings.mutate({ agent1_channels: newChannels });
  };

  const handleConfidenceChange = (value: number[]) => {
    const newValue = value[0];
    setLocalData(prev => ({ ...prev, min_confidence: newValue }));
    
    // Debounce confidence updates to avoid too many API calls
    if (confidenceTimeoutRef.current) {
      clearTimeout(confidenceTimeoutRef.current);
    }
    confidenceTimeoutRef.current = setTimeout(() => {
      updateSettings.mutate({ agent1_min_confidence: newValue });
    }, 500);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (confidenceTimeoutRef.current) {
        clearTimeout(confidenceTimeoutRef.current);
      }
    };
  }, []);

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
          <CardTitle className="text-base">Enable Lead Detection</CardTitle>
          <CardDescription>
            Automatically analyze conversations and tag potential leads
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label htmlFor="agent1-enabled">Active</Label>
            <Switch
              id="agent1-enabled"
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
            Select which communication channels to monitor for leads
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-6">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="agent1-email"
                checked={localData.channels.includes('email')}
                onCheckedChange={() => handleChannelToggle('email')}
                disabled={isDisabled}
              />
              <Label htmlFor="agent1-email" className="cursor-pointer">Email</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="agent1-linkedin"
                checked={localData.channels.includes('linkedin')}
                onCheckedChange={() => handleChannelToggle('linkedin')}
                disabled={isDisabled}
              />
              <Label htmlFor="agent1-linkedin" className="cursor-pointer">LinkedIn</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confidence Threshold */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Confidence Threshold</CardTitle>
          <CardDescription>
            Minimum AI confidence score required to tag a conversation as a lead
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="agent1-confidence">Threshold</Label>
            <span className="text-sm font-medium">
              {localData.min_confidence.toFixed(2)}
            </span>
          </div>
          <Slider
            id="agent1-confidence"
            min={0.5}
            max={0.95}
            step={0.05}
            value={[localData.min_confidence]}
            onValueChange={handleConfidenceChange}
            disabled={isDisabled}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Higher values reduce false positives but may miss some leads. Recommended: 0.75-0.85
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

