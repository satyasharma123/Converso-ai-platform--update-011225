import { supabaseAdmin } from '../lib/supabase';
import { logger } from './logger';

/**
 * Get workspace ID for a user
 */
export async function getUserWorkspaceId(userId: string): Promise<string | null> {
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
