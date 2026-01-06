// Shared types for backend services

export interface EmailAttachment {
  id: string;
  filename: string;
  mimeType?: string | null;
  size?: number | null;
  isInline?: boolean | null;
  contentId?: string | null;
  provider?: 'gmail' | 'outlook';
}

export interface Conversation {
  id: string;
  sender_name: string;
  sender_email?: string;
  sender_linkedin_url?: string;
  subject?: string;
  preview: string;
  last_message_at: string;
  conversation_type: 'email' | 'linkedin';
  status: 'new' | 'engaged' | 'qualified' | 'converted' | 'not_interested';
  is_read: boolean;
  is_favorite?: boolean | null;
  assigned_to?: string;
  custom_stage_id?: string;
  stage_assigned_at?: string | null;
  received_on_account_id?: string;
  email_folder?: string | null;
  derived_folder?: string | null; // ✅ Derived from latest message's provider_folder
  company_name?: string | null;
  location?: string | null;
  created_at?: string;
  // LinkedIn-specific fields
  chat_id?: string | null;
  sender_attendee_id?: string | null;
  sender_profile_picture_url?: string | null;
  last_message_from_lead?: boolean | null; // Track who sent the last message for preview display
  // Email-specific fields (only for conversation_type = 'email')
  email_body?: string | null; // Full email content stored directly in conversation
  email_body_html?: string | null; // HTML email body
  email_body_text?: string | null; // Plain text email body
  email_body_fetched_at?: string | null; // When body was fetched
  has_full_body?: boolean; // Whether full email body has been fetched
  gmail_message_id?: string | null; // Gmail-specific message ID
  gmail_thread_id?: string | null; // Gmail-specific thread ID
  outlook_message_id?: string | null; // Outlook-specific message ID
  outlook_conversation_id?: string | null; // Outlook-specific conversation ID
  email_timestamp?: string | null; // Original email timestamp
  email_attachments?: EmailAttachment[] | null;
  received_account?: {
    id?: string;
    account_name: string;
    account_email?: string;
    account_type: string;
    oauth_provider?: 'google' | 'microsoft' | 'linkedin' | null;
    oauth_access_token?: string | null;
    oauth_refresh_token?: string | null;
    unipile_account_id?: string | null;
  };
  // Phase-2: Optional field for email senders grouped by sender_email
  conversation_ids?: string[]; // Array of conversation IDs for this sender (email only)
}

export interface Message {
  id: string;
  conversation_id: string; // References conversations table (for LinkedIn only)
  sender_name: string;
  sender_id?: string;
  content: string;
  created_at: string;
  is_from_lead: boolean;
  workspace_id?: string;
  // LinkedIn-specific fields
  linkedin_message_id?: string | null;
  linkedin_sender_profile_url?: string | null;
}

export interface PipelineStage {
  id: string;
  name: string;
  description?: string;
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  role: 'admin' | 'sdr';
  status?: 'invited' | 'active';
  workspace_id?: string;
  is_deleted?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ConnectedAccount {
  id: string;
  account_name: string;
  account_email: string | null;
  account_type: 'email' | 'linkedin';
  is_active: boolean;
  user_id: string;
  workspace_id?: string;
  created_at?: string;
  // OAuth fields (optional, only for OAuth-connected accounts)
  oauth_access_token?: string | null;
  oauth_refresh_token?: string | null;
  oauth_token_expires_at?: string | null;
  oauth_provider?: 'google' | 'microsoft' | 'linkedin' | null;
  last_synced_at?: string | null;
  sync_status?: 'pending' | 'syncing' | 'success' | 'error' | null;
  sync_error?: string | null;
  // Unipile-specific fields (for LinkedIn accounts)
  unipile_account_id?: string | null;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SenderPipelineItem {
  sender_email: string;
  sender_name: string;
  channel: 'email';
  last_message_at: string | null;
  preview: string | null;
  subject: string | null;
  assigned_to: string | null;
  custom_stage_id: string | null;
  stage_assigned_at: string | null;
  conversation_count: number;
  activity_count: number;
  received_account: {
    id: string;
    account_name: string;
    account_email: string;
    account_type: string;
    oauth_provider: string;
  } | null;
  workspace_id: string;
  conversation_ids: string[];
}

// ============================================================================
// AI AGENT SYSTEM TYPES (Added for Intent Detection & Agent Framework)
// ============================================================================

/**
 * Conversation Intent Detection Result
 * Stores AI-detected intents for incoming conversations
 */
export interface ConversationIntent {
  id: string;
  conversation_id: string;
  workspace_id: string;
  
  // Intent Detection
  primary_intent: 
    | 'pricing_inquiry'
    | 'demo_request'
    | 'support_question'
    | 'meeting_request'
    | 'objection'
    | 'follow_up'
    | 'interested'
    | 'not_interested'
    | 'other';
  secondary_intents?: string[];
  confidence_score: number; // 0.0 to 1.0
  
  // Metadata
  intent_metadata?: Record<string, any>;
  detected_keywords?: string[];
  sentiment?: 'positive' | 'neutral' | 'negative' | 'mixed';
  
  // Agent Info
  detected_by?: string;
  model_version?: string;
  
  // Timestamps
  detected_at?: string;
  created_at?: string;
}

/**
 * Agent Action Log
 * Tracks all actions performed by AI agents
 */
export interface AgentAction {
  id: string;
  conversation_id: string;
  workspace_id: string;
  
  // Agent Info
  agent_type: 'intent_detection' | 'response_generation' | 'lead_scoring' | 'auto_assignment';
  agent_version?: string;
  
  // Action Details
  action_type: string;
  action_description?: string;
  action_data?: Record<string, any>;
  
  // Execution Status
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
  error_message?: string;
  
  // Performance
  execution_time_ms?: number;
  
  // Timestamps
  triggered_at?: string;
  executed_at?: string;
  completed_at?: string;
  created_at?: string;
}

/**
 * Agent Configuration
 * Workspace-specific settings for AI agents
 */
export interface AgentConfiguration {
  id: string;
  workspace_id: string;
  
  // Agent Details
  agent_type: 'intent_detection' | 'response_generation' | 'lead_scoring' | 'auto_assignment';
  agent_name: string;
  
  // Configuration
  is_enabled: boolean;
  config_data: Record<string, any>;
  
  // Priority
  priority?: number;
  
  // Trigger Conditions
  trigger_conditions?: Record<string, any>;
  
  // Timestamps
  created_at?: string;
  updated_at?: string;
}

/**
 * Intent Detection Configuration
 * Specific config structure for Intent Detection Agent
 */
export interface IntentDetectionConfig {
  confidence_threshold: number; // Minimum confidence to record intent (0.0-1.0)
  enable_sentiment_analysis: boolean;
  detect_urgency: boolean;
  intent_categories: string[];
  custom_keywords?: Record<string, string[]>; // Intent -> keywords mapping
}

/**
 * Agent Action Request
 * Used when triggering agent actions programmatically
 */
export interface CreateAgentActionRequest {
  conversation_id: string;
  workspace_id: string;
  agent_type: AgentAction['agent_type'];
  action_type: string;
  action_description?: string;
  action_data?: Record<string, any>;
}

/**
 * Intent Detection Request
 * Input for intent detection service
 */
export interface DetectIntentRequest {
  conversation_id: string;
  workspace_id: string;
  message_content: string;
  conversation_context?: {
    subject?: string;
    sender_name?: string;
    conversation_history?: string[];
  };
}

/**
 * Intent Detection Response
 * Output from intent detection service
 */
export interface DetectIntentResponse {
  success: boolean;
  intent?: ConversationIntent;
  error?: string;
  processing_time_ms?: number;
}
