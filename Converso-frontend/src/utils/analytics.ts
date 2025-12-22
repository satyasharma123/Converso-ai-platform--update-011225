/**
 * Analytics Calculation Utilities
 * Shared logic for deriving analytics metrics from Work Queue and Conversations data
 */

import type { WorkQueueItem } from "@/lib/backend-api";
import type { Conversation } from "@/hooks/useConversations";
import { startOfWeek, format, subWeeks, isWithinInterval } from "date-fns";

export interface SDRLeaderboardRow {
  id: string;
  name: string;
  leadsAssigned: number;
  avgResponseSpeed: number;
  conversionRate: number;
  replyRate: number;
  engagementScore: number;
}

export interface FunnelStage {
  stage: string;
  count: number;
  color: string;
}

export interface TrendDataPoint {
  date: string;
  leads: number;
  conversions: number;
  engagement: number;
  responseTime: number;
}

export interface EmailsByDay {
  date: string;
  count: number;
}

export interface RadarDataPoint {
  metric: string;
  [key: string]: string | number;
}

/**
 * Calculate SDR Leaderboard metrics
 */
export function calculateSDRLeaderboard(
  workQueueItems: WorkQueueItem[],
  conversations: Conversation[],
  teamMembers: any[],
  userRole: string,
  userId?: string
): SDRLeaderboardRow[] {
  const sdrUsers = userRole === 'sdr'
    ? teamMembers.filter(m => m.id === userId)
    : teamMembers.filter(m => m.role === 'sdr');

  return sdrUsers.map((sdr) => {
    const assignedLeads = workQueueItems.filter(item =>
      item.assigned_sdr_id === sdr.id &&
      item.custom_stage_id !== null
    );

    const assignedConversations = conversations.filter(c => c.assigned_to === sdr.id);

    // Leads Assigned
    const leadsAssigned = assignedLeads.length;

    // Avg Response Speed (placeholder - would need message timestamps)
    const avgResponseSpeed = 0; // TODO: Calculate from message deltas

    // Conversion Rate
    const convertedLeads = assignedConversations.filter(c => c.status === 'converted').length;
    const conversionRate = leadsAssigned > 0 ? (convertedLeads / leadsAssigned) * 100 : 0;

    // Reply Rate (conversations with replies)
    const repliedConversations = assignedConversations.filter(c => c.status !== 'new').length;
    const replyRate = assignedConversations.length > 0 
      ? (repliedConversations / assignedConversations.length) * 100 
      : 0;

    // Engagement Score (weighted)
    const speedScore = 80; // Placeholder
    const engagementScore = (replyRate * 0.4) + (conversionRate * 0.4) + (speedScore * 0.2);

    return {
      id: sdr.id,
      name: sdr.full_name,
      leadsAssigned,
      avgResponseSpeed,
      conversionRate: Math.round(conversionRate),
      replyRate: Math.round(replyRate),
      engagementScore: Math.round(engagementScore),
    };
  }).sort((a, b) => b.engagementScore - a.engagementScore);
}

/**
 * Calculate Lead Funnel stages
 */
export function calculateLeadFunnel(
  workQueueItems: WorkQueueItem[],
  pipelineStages: any[]
): FunnelStage[] {
  // Map stage names to colors
  const stageColors: Record<string, string> = {
    'New': 'bg-blue-500',
    'Engaged': 'bg-purple-500',
    'Qualified': 'bg-yellow-500',
    'Converted': 'bg-green-500',
    'Lost': 'bg-red-500',
    'Irrelevant': 'bg-gray-500',
  };

  // Count leads by stage
  const newCount = workQueueItems.filter(item => item.custom_stage_id === null).length;
  
  const stageCounts = pipelineStages.map(stage => {
    const count = workQueueItems.filter(item => item.custom_stage_id === stage.id).length;
    return {
      stage: stage.name,
      count,
      color: stageColors[stage.name] || 'bg-gray-500',
    };
  });

  // Add "New" stage at the beginning
  return [
    { stage: 'New', count: newCount, color: stageColors['New'] },
    ...stageCounts,
  ];
}

/**
 * Calculate Trends Over Time (last 12 weeks)
 */
export function calculateTrendsOverTime(
  workQueueItems: WorkQueueItem[],
  conversations: Conversation[]
): TrendDataPoint[] {
  const weeks: TrendDataPoint[] = [];
  
  for (let i = 11; i >= 0; i--) {
    const weekStart = startOfWeek(subWeeks(new Date(), i));
    const weekEnd = startOfWeek(subWeeks(new Date(), i - 1));
    
    const weekLabel = format(weekStart, 'MMM d');
    
    // Leads created this week
    const leadsThisWeek = workQueueItems.filter(item => {
      const createdAt = new Date(item.created_at);
      return isWithinInterval(createdAt, { start: weekStart, end: weekEnd });
    }).length;

    // Conversations this week
    const conversationsThisWeek = conversations.filter(c => {
      const createdAt = new Date(c.created_at || new Date());
      return isWithinInterval(createdAt, { start: weekStart, end: weekEnd });
    }).length;

    // Conversions this week
    const conversionsThisWeek = conversations.filter(c => {
      const createdAt = new Date(c.created_at || new Date());
      return c.status === 'converted' && isWithinInterval(createdAt, { start: weekStart, end: weekEnd });
    }).length;

    // Engagement % (conversations with replies)
    const engagedThisWeek = conversations.filter(c => {
      const createdAt = new Date(c.created_at || new Date());
      return c.status !== 'new' && isWithinInterval(createdAt, { start: weekStart, end: weekEnd });
    }).length;
    const engagement = conversationsThisWeek > 0 
      ? (engagedThisWeek / conversationsThisWeek) * 100 
      : 0;

    // Response time (placeholder)
    const responseTime = 2.0; // TODO: Calculate from message timestamps

    weeks.push({
      date: weekLabel,
      leads: leadsThisWeek,
      conversions: conversionsThisWeek,
      engagement: Math.round(engagement),
      responseTime,
    });
  }

  return weeks;
}

/**
 * Calculate Emails Received (last 7 days)
 */
export function calculateEmailsByDay(
  conversations: Conversation[],
  userRole: string,
  userId?: string
): EmailsByDay[] {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const last7Days = [];

  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dayName = days[date.getDay() === 0 ? 6 : date.getDay() - 1]; // Adjust for Monday start

    const emailsThisDay = conversations.filter(c => {
      if (c.conversation_type !== 'email') return false;
      
      // Role filtering
      if (userRole === 'sdr' && c.assigned_to !== userId) return false;

      const createdAt = new Date(c.created_at || new Date());
      return createdAt.toDateString() === date.toDateString();
    }).length;

    last7Days.push({
      date: dayName,
      count: emailsThisDay,
    });
  }

  return last7Days;
}

/**
 * Calculate Conversion Funnel (cumulative)
 */
export function calculateConversionFunnel(
  workQueueItems: WorkQueueItem[],
  pipelineStages: any[]
): { stage: string; count: number }[] {
  const newCount = workQueueItems.filter(item => item.custom_stage_id === null).length;
  
  const engagedStage = pipelineStages.find(s => s.name === 'Engaged');
  const qualifiedStage = pipelineStages.find(s => s.name === 'Qualified');
  const convertedStage = pipelineStages.find(s => s.name === 'Converted');

  const engagedCount = engagedStage 
    ? workQueueItems.filter(item => item.custom_stage_id === engagedStage.id).length 
    : 0;
  const qualifiedCount = qualifiedStage 
    ? workQueueItems.filter(item => item.custom_stage_id === qualifiedStage.id).length 
    : 0;
  const convertedCount = convertedStage 
    ? workQueueItems.filter(item => item.custom_stage_id === convertedStage.id).length 
    : 0;

  return [
    { stage: 'New Leads', count: newCount },
    { stage: 'Engaged', count: engagedCount },
    { stage: 'Qualified', count: qualifiedCount },
    { stage: 'Converted', count: convertedCount },
  ];
}

/**
 * Calculate SDR Performance Comparison (radar chart data)
 */
export function calculateSDRPerformanceRadar(
  leaderboardData: SDRLeaderboardRow[],
  userRole: string,
  userId?: string
): RadarDataPoint[] {
  const metrics = ['Engagement', 'Conversion', 'Reply', 'Response'];
  
  // For SDR, show only themselves
  if (userRole === 'sdr') {
    const sdrData = leaderboardData.find(sdr => sdr.id === userId);
    if (!sdrData) return [];

    return metrics.map(metric => ({
      metric,
      [sdrData.name.split(' ')[0]]: 
        metric === 'Engagement' ? sdrData.engagementScore :
        metric === 'Conversion' ? sdrData.conversionRate :
        metric === 'Reply' ? sdrData.replyRate :
        sdrData.avgResponseSpeed || 80,
    }));
  }

  // For Admin, show top 3 SDRs
  const top3 = leaderboardData.slice(0, 3);
  
  return metrics.map(metric => {
    const dataPoint: RadarDataPoint = { metric };
    
    top3.forEach(sdr => {
      const firstName = sdr.name.split(' ')[0];
      dataPoint[firstName] = 
        metric === 'Engagement' ? sdr.engagementScore :
        metric === 'Conversion' ? sdr.conversionRate :
        metric === 'Reply' ? sdr.replyRate :
        sdr.avgResponseSpeed || 80;
    });
    
    return dataPoint;
  });
}

