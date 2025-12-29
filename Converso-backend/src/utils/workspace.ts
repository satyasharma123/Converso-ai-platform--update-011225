import { resolveActiveWorkspace } from './resolveWorkspace';
import { logger } from './logger';

/**
 * Get workspace ID for a user (STRICT - uses workspace_members as source of truth)
 */
export async function getUserWorkspaceId(userId: string): Promise<string> {
  const { workspaceId } = await resolveActiveWorkspace({ userId });
  return workspaceId;
}

/**
 * Legacy function - deprecated, use getUserWorkspaceId instead
 * @deprecated Use getUserWorkspaceId for strict workspace isolation
 */
export async function getUserWorkspaceIdLegacy(userId: string): Promise<string | null> {
  try {
    const { workspaceId } = await resolveActiveWorkspace({ userId });
    return workspaceId;
  } catch (err) {
    logger.warn('[Workspace] Failed to fetch user workspace', {
      error: err instanceof Error ? err.message : err,
      userId,
    });
    return null;
  }
}
