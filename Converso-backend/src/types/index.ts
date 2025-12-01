// Shared types for backend services

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
  received_on_account_id?: string;
  email_folder?: string | null;
  received_account?: {
    account_name: string;
    account_email?: string;
    account_type: string;
  };
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_name: string;
  sender_id?: string;
  content: string;
  created_at: string;
  is_from_lead: boolean;
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
}

export interface ConnectedAccount {
  id: string;
  account_name: string;
  account_email: string | null;
  account_type: 'email' | 'linkedin';
  is_active: boolean;
  user_id: string;
  created_at?: string;
  // OAuth fields (optional, only for OAuth-connected accounts)
  oauth_access_token?: string | null;
  oauth_refresh_token?: string | null;
  oauth_token_expires_at?: string | null;
  oauth_provider?: 'google' | 'microsoft' | 'linkedin' | null;
  last_synced_at?: string | null;
  sync_status?: 'pending' | 'syncing' | 'success' | 'error' | null;
  sync_error?: string | null;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  created_at?: string;
  updated_at?: string;
}

