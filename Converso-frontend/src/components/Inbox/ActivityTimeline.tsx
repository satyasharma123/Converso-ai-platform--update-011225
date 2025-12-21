import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, GitBranch, UserCheck, Mail, Linkedin, MessageSquare, FileEdit, StickyNote } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { conversationsApi } from "@/lib/backend-api";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import type { Conversation } from "@/hooks/useConversations";

interface Activity {
  id: string;
  activity_type: string;
  meta: Record<string, any>;
  created_at: string;
  actor_user_id: string;
  actor_name?: string;
}

interface ActivityTimelineProps {
  conversationId: string;
  className?: string;
  // Optional: For email sender-grouped pipeline leads
  channel?: 'email' | 'linkedin';
  senderEmail?: string;
  workspaceId?: string;
  // Optional: For fallback activity
  conversation?: Conversation;
}

// Icon mapping for activity types
const getActivityIcon = (activityType: string) => {
  switch (activityType) {
    case 'stage_changed':
      return GitBranch;
    case 'lead_updated':
      return FileEdit;
    case 'note_added':
      return StickyNote;
    case 'email_sent':
      return Mail;
    case 'linkedin_sent':
      return Linkedin;
    case 'message_received':
      return MessageSquare;
    case 'assigned':
      return UserCheck;
    default:
      return Clock;
  }
};

// Helper function to format field names for display
const formatFieldName = (field: string): string => {
  const fieldMap: Record<string, string> = {
    'sender_name': 'Name',
    'sender_email': 'Email',
    'company_name': 'Company',
    'sender_linkedin_url': 'LinkedIn URL',
    'mobile': 'Phone',
    'location': 'Location'
  };
  
  return fieldMap[field] || field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

// Helper function to resolve stage name from ID
const resolveStageName = (
  stageId: string | null | undefined,
  stages: Array<{ id: string; name: string }> | undefined
): string => {
  if (!stageId) return 'None';
  
  // Try to find stage by ID
  const stage = stages?.find(s => s.id === stageId);
  if (stage) return stage.name;
  
  // Fallback: Unknown stage (don't show UUID)
  return 'Unknown stage';
};

// Generate human-readable description from activity
const getActivityDescription = (
  activity: Activity,
  stages: Array<{ id: string; name: string }> | undefined
): { title: string; details?: string } => {
  const meta = activity.meta || {};
  
  switch (activity.activity_type) {
    case 'stage_changed':
      if (meta.from_stage !== undefined && meta.to_stage !== undefined) {
        const fromStage = resolveStageName(meta.from_stage, stages);
        const toStage = resolveStageName(meta.to_stage, stages);
        return {
          title: `Moved from ${fromStage} → ${toStage}`,
          details: undefined
        };
      }
      return {
        title: 'Stage updated',
        details: undefined
      };
    
    case 'lead_updated':
      const fields = Object.keys(meta);
      if (fields.length === 1) {
        const field = fields[0];
        const fieldName = formatFieldName(field);
        const newValue = meta[field]?.new;
        if (newValue) {
          return {
            title: `${fieldName} updated to ${newValue}`,
            details: undefined
          };
        }
        return {
          title: `${fieldName} updated`,
          details: undefined
        };
      }
      return {
        title: `${fields.length} lead fields updated`,
        details: undefined
      };
    
    case 'note_added':
      return {
        title: 'Note added',
        details: meta.note_text ? meta.note_text.substring(0, 100) : undefined
      };
    
    case 'email_sent':
      return {
        title: 'Email sent',
        details: meta.subject || undefined
      };
    
    case 'linkedin_sent':
      return {
        title: 'LinkedIn message sent',
        details: meta.preview || undefined
      };
    
    case 'message_received':
      return {
        title: 'Message received',
        details: meta.preview || undefined
      };
    
    case 'assigned':
      return {
        title: 'Lead assigned',
        details: meta.assigned_to_name ? `Assigned to ${meta.assigned_to_name}` : undefined
      };
    
    case 'system':
      // UI-only fallback activity
      return {
        title: meta.label || 'System activity',
        details: undefined
      };
    
    default:
      return {
        title: activity.activity_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        details: undefined
      };
  }
};

export function ActivityTimeline({ 
  conversationId, 
  className = "",
  channel,
  senderEmail,
  workspaceId,
  conversation
}: ActivityTimelineProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch pipeline stages for stage name resolution
  const { data: pipelineStages = [] } = usePipelineStages();

  useEffect(() => {
    if (!conversationId) return;

    const fetchActivities = async () => {
      try {
        setLoading(true);
        setError(null);

        // IF channel === 'email' AND sender_email is provided:
        // Use backend API to fetch activities for ALL conversations from this sender
        if (channel === 'email' && senderEmail && workspaceId) {
          console.log('[ActivityTimeline] Fetching sender-grouped activities via backend API');
          const activities = await conversationsApi.getEmailSenderActivities(workspaceId, senderEmail);
          
          // Early exit: If backend returns empty array, stop immediately
          if (!activities || activities.length === 0) {
            setActivities([]);
            setLoading(false);
            return;
          }
          
          setActivities(activities);
          setLoading(false);
          return;
        }

        // ELSE: Keep existing Supabase behavior (fetch by conversation_id)
        // Step 1: Fetch activities without profiles join
        const { data, error: fetchError } = await supabase
          .from('conversation_activities')
          .select('id, activity_type, meta, created_at, actor_user_id')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: false });

        if (fetchError) {
          console.error('[ActivityTimeline] Error fetching activities:', fetchError);
          setError('Failed to load activities');
          return;
        }

        // Early exit: If no activities, add fallback activity
        if (!data || data.length === 0) {
          // Add UI-only fallback activity if conversation exists
          if (conversation) {
            const fallbackActivity: Activity = {
              id: 'fallback-system',
              activity_type: 'system',
              meta: {
                label: channel === 'linkedin' 
                  ? 'Lead created via LinkedIn'
                  : 'Conversation created via email'
              },
              created_at: conversation.created_at || conversation.last_message_at || new Date().toISOString(),
              actor_user_id: '',
              actor_name: 'System'
            };
            setActivities([fallbackActivity]);
          } else {
            setActivities([]);
          }
          setLoading(false);
          return;
        }

        // Step 2: Get unique actor user IDs
        const actorUserIds = [...new Set(data.map(a => a.actor_user_id).filter(Boolean))];

        // Step 3: Fetch actor names separately if we have actor IDs (parallel optimization)
        let actorNamesMap: Record<string, string> = {};
        if (actorUserIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', actorUserIds);

          if (profiles) {
            actorNamesMap = profiles.reduce((acc, profile) => {
              acc[profile.id] = profile.full_name || 'Unknown User';
              return acc;
            }, {} as Record<string, string>);
          }
        }

        // Step 4: Transform data to include actor name
        const transformedActivities = data.map((activity: any) => ({
          id: activity.id,
          activity_type: activity.activity_type,
          meta: activity.meta || {},
          created_at: activity.created_at,
          actor_user_id: activity.actor_user_id,
          actor_name: actorNamesMap[activity.actor_user_id] || 'Unknown User'
        }));

        setActivities(transformedActivities);
      } catch (err) {
        console.error('[ActivityTimeline] Exception:', err);
        setError('An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();

    // Set up real-time subscription for new activities
    // For sender-grouped email views, we refetch all activities on INSERT
    // For single conversation views, we add the new activity directly
    const channelName = channel === 'email' && senderEmail 
      ? `activities:sender:${senderEmail}:${workspaceId}`
      : `activities:${conversationId}`;
    
    const subscriptionChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_activities',
          filter: `conversation_id=eq.${conversationId}`
        },
        async (payload) => {
          console.log('[ActivityTimeline] New activity:', payload);
          
          // For sender-grouped email views, refetch all activities
          if (channel === 'email' && senderEmail && workspaceId) {
            fetchActivities();
            return;
          }
          
          // For single conversation views, add new activity directly
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', payload.new.actor_user_id)
            .single();

          const newActivity: Activity = {
            id: payload.new.id,
            activity_type: payload.new.activity_type,
            meta: payload.new.meta || {},
            created_at: payload.new.created_at,
            actor_user_id: payload.new.actor_user_id,
            actor_name: profile?.full_name || 'Unknown User'
          };

          setActivities(prev => [newActivity, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscriptionChannel);
    };
  }, [conversationId, channel, senderEmail, workspaceId]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-sm text-muted-foreground">Loading activities...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-sm text-destructive">{error}</div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center h-full text-center ${className}`}>
        <Clock className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-sm text-muted-foreground">No activities yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Activities will appear here as you interact with this lead
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className={`h-full ${className}`}>
      <div className="px-6 py-4">
        <div className="space-y-2">
          {activities.map((activity, index) => {
            const Icon = getActivityIcon(activity.activity_type);
            const { title, details } = getActivityDescription(activity, pipelineStages);
            const timeAgo = formatDistanceToNow(new Date(activity.created_at), { addSuffix: true });

            return (
              <div key={activity.id} className="flex gap-2.5">
                {/* Timeline */}
                <div className="flex flex-col items-center">
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="h-3.5 w-3.5 text-primary" />
                  </div>
                  {index < activities.length - 1 && (
                    <div className="w-px flex-1 bg-border mt-1.5 min-h-[16px]" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 pb-2 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug">{title}</p>
                      {details && (
                        <p className="text-xs text-muted-foreground mt-0.5 leading-snug truncate">
                          {details}
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[11px] text-muted-foreground">
                          {activity.actor_name}
                        </span>
                        <span className="text-[11px] text-muted-foreground">·</span>
                        <span className="text-[11px] text-muted-foreground">
                          {timeAgo}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ScrollArea>
  );
}


