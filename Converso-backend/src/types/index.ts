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
  company_name?: string | null;
  location?: string | null;
  // LinkedIn-specific fields
  chat_id?: string | null;
  sender_attendee_id?: string | null;
  sender_profile_picture_url?: string | null;
  // Email-specific fields (only for conversation_type = 'email')
  email_body?: string | null; // Full email content stored directly in conversation
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
