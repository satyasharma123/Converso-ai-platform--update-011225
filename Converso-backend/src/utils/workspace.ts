import { supabaseAdmin } from '../lib/supabase';
import { logger } from './logger';

/**
 * Get workspace ID for a user (STRICT - no fallback for SaaS isolation)
 */
export async function getUserWorkspaceId(userId: string): Promise<string> {
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('workspace_id')
    .eq('id', userId)
    .single();

  if (error || !profile?.workspace_id) {
    logger.error('[Workspace] Workspace not found for user', {
      error: error?.message,
      userId,
    });
    throw new Error(`Workspace not found for user ${userId}`);
  }

  return profile.workspace_id;
}

/**
 * Legacy function - deprecated, use getUserWorkspaceId instead
 * @deprecated Use getUserWorkspaceId for strict workspace isolation
 */
export async function getUserWorkspaceIdLegacy(userId: string): Promise<string | null> {
  try {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('workspace_id')
      .eq('id', userId)
      .single();

    if (!error && profile?.workspace_id) {
      return profile.workspace_id;
    }
  } catch (err) {
    logger.warn('[Workspace] Failed to fetch user workspace, falling back to default', {
      error: err instanceof Error ? err.message : err,
      userId,
    });
  }

  try {
    const { data: workspace } = await supabaseAdmin
      .from('workspaces')
      .select('id')
      .limit(1)
      .single();

    return workspace?.id || null;
  } catch (err) {
    logger.error('[Workspace] Failed to determine fallback workspace', {
      error: err instanceof Error ? err.message : err,
    });
    return null;
  }
}
