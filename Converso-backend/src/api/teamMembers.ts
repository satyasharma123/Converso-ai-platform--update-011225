import { supabaseAdmin } from '../lib/supabase';
import { resolveActiveWorkspace } from '../utils/resolveWorkspace';
import type { TeamMember } from '../types';

/**
 * API module for team member-related database queries
 */

export async function getTeamMembers(workspaceId: string): Promise<TeamMember[]> {
  if (!workspaceId) {
    throw new Error('Workspace ID is required to fetch team members');
  }

  console.log('[TEAM] fetch members', { workspaceId });

  // Query workspace_members with profiles join to get role from workspace_members (not user_roles)
  // This ensures role is workspace-specific
  const { data: members, error: membersError } = await supabaseAdmin
    .from('workspace_members')
    .select(`
      user_id,
      role,
      created_at,
      profiles:profiles (
        id,
        email,
        full_name,
        status,
        workspace_id,
        created_at,
        updated_at
      )
    `)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true });

  if (membersError) {
    throw membersError;
  }

  if (!members || members.length === 0) {
    return [];
  }

  // Map workspace_members to TeamMember format
  // Role comes from workspace_members.role (workspace-specific)
  const teamMembers: TeamMember[] = members
    .filter(m => m.profiles) // Filter out any null profiles
    .map(m => ({
      id: m.profiles.id,
      email: m.profiles.email,
      full_name: m.profiles.full_name,
      role: (m.role as 'admin' | 'sdr') || 'sdr', // Use workspace_members.role
      status: m.profiles.status as 'invited' | 'active' | undefined,
      workspace_id: workspaceId,
      created_at: m.profiles.created_at,
      updated_at: m.profiles.updated_at,
    }));

  return teamMembers;
}

export async function getTeamMemberById(userId: string): Promise<TeamMember | null> {
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (profileError) throw profileError;

  const { data: role, error: roleError } = await supabaseAdmin
    .from('user_roles')
    .select('*')
    .eq('user_id', userId)
    .single();

  // Role might not exist, so we don't throw on error
  return {
    ...profile,
    role: role?.role || 'sdr',
  } as TeamMember;
}

export async function updateTeamMemberRole(
  userId: string,
  workspaceId: string,
  role: 'admin' | 'sdr'
): Promise<void> {
  if (!workspaceId) {
    throw new Error('Workspace ID is required to update team member role');
  }

  // Update role in workspace_members (workspace-specific role)
  const { error } = await supabaseAdmin
    .from('workspace_members')
    .update({ role })
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId);

  if (error) {
    throw new Error(`Failed to update workspace member role: ${error.message}`);
  }

  // Also update user_roles for backward compatibility (optional, non-blocking)
  const { error: roleErr } = await supabaseAdmin
    .from('user_roles')
    .upsert(
      { user_id: userId, role },
      { onConflict: 'user_id,role' }
    );

  if (roleErr) {
    console.warn('user_roles upsert failed (non-blocking):', roleErr.message);
  }
}

/**
 * Create a new team member
 * Implements global name rule: If profile exists, keep existing full_name; else use input full_name
 */
export async function createTeamMember(
  email: string,
  fullName: string,
  role: 'admin' | 'sdr',
  workspaceId?: string,
  adminUserId?: string,
  adminName?: string
): Promise<TeamMember> {
  if (!workspaceId) {
    throw new Error('No active workspace resolved. Cannot create team member without workspace.');
  }

  if (!adminUserId) {
    throw new Error('Admin user ID is required to create team member.');
  }

  const normalizedEmail = email.trim().toLowerCase();

  // A) Find existing profile by email (GLOBAL lookup)
  const { data: existingProfile, error: existingProfileErr } = await supabaseAdmin
    .from('profiles')
    .select('id, email, full_name')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (existingProfileErr) {
    throw new Error(`Failed to lookup existing profile: ${existingProfileErr.message}`);
  }

  let userId: string | null = existingProfile?.id ?? null;

  // B) If no profile exists, create auth user + profile
  if (!userId) {
    // 1) Create auth user via invite (clean SaaS flow)
    const { data: invited, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      normalizedEmail,
      {
        data: { full_name: fullName },
      }
    );

    if (inviteErr) {
      // Fallback: If email already exists in auth but profile missing, lookup by auth users list
      const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });

      if (listErr) {
        throw new Error(`Invite failed and listUsers failed: ${listErr.message}`);
      }

      const found = list?.users?.find((u: any) => (u.email || '').toLowerCase() === normalizedEmail);
      if (!found?.id) {
        throw new Error(`Invite failed: ${inviteErr.message}`);
      }
      userId = found.id;
    } else {
      userId = invited.user?.id ?? null;
    }

    if (!userId) {
      throw new Error('Failed to resolve userId for new team member.');
    }

    // 2) Create profile with the provided name (because profile does not exist yet)
    const { error: profileInsertErr } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          id: userId,
          email: normalizedEmail,
          full_name: fullName,
          status: 'active',
        },
        { onConflict: 'id' }
      );

    if (profileInsertErr) {
      throw new Error(`Failed to create profile: ${profileInsertErr.message}`);
    }
  }
  // Else: Profile exists => enforce rule: KEEP old name (do nothing to profiles.full_name)

  // C) Upsert workspace membership (NO duplicates)
  // DB has UNIQUE(workspace_id, user_id) already.
  // If already exists => update role.
  const { error: memberUpsertErr } = await supabaseAdmin
    .from('workspace_members')
    .upsert(
      {
        workspace_id: workspaceId,
        user_id: userId,
        role, // 'admin' | 'sdr'
      },
      { onConflict: 'workspace_id,user_id' }
    );

  if (memberUpsertErr) {
    throw new Error(`Failed to upsert workspace member: ${memberUpsertErr.message}`);
  }

  // D) Upsert user_roles (if table exists)
  // If schema enforces unique(user_id, role), this is safe.
  const { error: roleErr } = await supabaseAdmin
    .from('user_roles')
    .upsert(
      { user_id: userId, role },
      { onConflict: 'user_id,role' }
    );

  // If schema differs and this fails, DO NOT break team add.
  // Log but allow membership to exist.
  if (roleErr) {
    console.warn('user_roles upsert failed:', roleErr.message);
  }

  // E) Return a stable response for frontend
  const { data: finalProfile, error: finalProfileErr } = await supabaseAdmin
    .from('profiles')
    .select('id, email, full_name, status, workspace_id, created_at, updated_at')
    .eq('id', userId)
    .single();

  if (finalProfileErr) {
    throw new Error(`Failed to load created profile: ${finalProfileErr.message}`);
  }

  // Get role from user_roles to ensure consistency
  const { data: userRole } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  return {
    id: finalProfile.id,
    email: finalProfile.email,
    full_name: finalProfile.full_name, // This will be existing name if profile existed
    role: (userRole?.role as 'admin' | 'sdr') || role,
    status: finalProfile.status as 'invited' | 'active' | undefined,
    workspace_id: workspaceId,
    created_at: finalProfile.created_at,
    updated_at: finalProfile.updated_at,
  } as TeamMember;
}

export async function updateTeamMember(
  userId: string,
  updates: { full_name?: string; email?: string }
): Promise<TeamMember> {
  throw new Error('Team member update not yet implemented. Please use the profiles API instead.');
}

export async function deleteTeamMember(
  memberUserId: string,
  workspaceId: string
): Promise<{ success: boolean }> {
  if (!memberUserId || !workspaceId) {
    throw new Error('user_id and workspace_id are required');
  }

  // ONLY remove workspace membership
  // NEVER delete from profiles or auth.users
  const { error } = await supabaseAdmin
    .from('workspace_members')
    .delete()
    .eq('user_id', memberUserId)
    .eq('workspace_id', workspaceId);

  if (error) {
    throw new Error(`Failed to remove team member: ${error.message}`);
  }

  return { success: true };
}

export async function resendInvitation(
  userId: string,
  adminUserId?: string,
  adminName?: string
): Promise<{ success: boolean; message: string }> {
  throw new Error('Resend invitation not yet implemented.');
}

export async function getInvitationLink(userId: string): Promise<{ success: boolean; link?: string; message: string }> {
  throw new Error('Get invitation link not yet implemented.');
}
