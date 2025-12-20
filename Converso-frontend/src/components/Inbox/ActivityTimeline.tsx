import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, GitBranch, UserCheck, Mail, Linkedin, MessageSquare, FileEdit, StickyNote } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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

// Helper function to format stage ID for display
const formatStageId = (stageId: string | null | undefined): string => {
  if (!stageId) return 'None';
  // If it's a UUID, show last 6 characters
  if (stageId.length > 20 && stageId.includes('-')) {
    return stageId.slice(-6);
  }
  return stageId;
};

// Generate human-readable description from activity
const getActivityDescription = (activity: Activity): { title: string; details?: string } => {
  const meta = activity.meta || {};
  
  switch (activity.activity_type) {
    case 'stage_changed':
      if (meta.from_stage !== undefined && meta.to_stage !== undefined) {
        const fromStage = formatStageId(meta.from_stage);
        const toStage = formatStageId(meta.to_stage);
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
    
    default:
      return {
        title: activity.activity_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        details: undefined
      };
  }
};

export function ActivityTimeline({ conversationId, className = "" }: ActivityTimelineProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!conversationId) return;

    const fetchActivities = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch activities from conversation_activities table
        const { data, error: fetchError } = await supabase
          .from('conversation_activities')
          .select(`
            id,
            activity_type,
            meta,
            created_at,
            actor_user_id,
            profiles!conversation_activities_actor_user_id_fkey (
              full_name
            )
          `)
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: false });

        if (fetchError) {
          console.error('[ActivityTimeline] Error fetching activities:', fetchError);
          setError('Failed to load activities');
          return;
        }

        // Transform data to include actor name
        const transformedActivities = (data || []).map((activity: any) => ({
          id: activity.id,
          activity_type: activity.activity_type,
          meta: activity.meta || {},
          created_at: activity.created_at,
          actor_user_id: activity.actor_user_id,
          actor_name: activity.profiles?.full_name || 'Unknown User'
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
    const channel = supabase
      .channel(`activities:${conversationId}`)
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
          
          // Fetch actor name for new activity
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
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

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
      <div className="px-4 py-4">
        <div className="space-y-2">
          {activities.map((activity, index) => {
            const Icon = getActivityIcon(activity.activity_type);
            const { title, details } = getActivityDescription(activity);
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

