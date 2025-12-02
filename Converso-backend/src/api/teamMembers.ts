import { supabaseAdmin } from '../lib/supabase';
import type { TeamMember } from '../types';

/**
 * API module for team member-related database queries
 */

/**
 * Get workspace ID for a user
 */
async function getUserWorkspaceId(userId: string): Promise<string | null> {
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('workspace_id')
    .eq('id', userId)
    .single();

  if (error || !profile?.workspace_id) {
    // Fallback: get first workspace
    const { data: workspace } = await supabaseAdmin
      .from('workspaces')
      .select('id')
      .limit(1)
      .single();
    
    return workspace?.id || null;
  }

  return profile.workspace_id;
}

export async function getTeamMembers(userId?: string): Promise<TeamMember[]> {
  let query = supabaseAdmin
    .from('profiles')
    .select('*');

  // Filter by workspace if userId is provided
  if (userId) {
    const workspaceId = await getUserWorkspaceId(userId);
    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId);
    }
  }

  const { data: profiles, error: profilesError } = await query;

  if (profilesError) throw profilesError;

  if (!profiles || profiles.length === 0) {
    return [];
  }

  // Get all roles for these users
  const userIds = profiles.map(p => p.id);
  const { data: roles, error: rolesError } = await supabaseAdmin
    .from('user_roles')
    .select('*')
    .in('user_id', userIds);

  if (rolesError) throw rolesError;

  // Combine profiles with roles
  const teamMembers = profiles.map(profile => {
    const userRole = roles?.find(r => r.user_id === profile.id);
    return {
      ...profile,
      role: userRole?.role || 'sdr',
    } as TeamMember;
  });

  return teamMembers;
}

export async function getTeamMemberById(userId: string): Promise<TeamMember | null> {
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (profileError) {
    if (profileError.code === 'PGRST116') {
      return null; // Not found
    }
    throw profileError;
  }

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
  role: 'admin' | 'sdr'
): Promise<void> {
  // Check if role exists
  const { data: existingRole } = await supabaseAdmin
    .from('user_roles')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (existingRole) {
    // Update existing role
    const { error } = await supabaseAdmin
      .from('user_roles')
      .update({ role })
      .eq('user_id', userId);

    if (error) throw error;
  } else {
    // Create new role
    const { error } = await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: userId, role });

    if (error) throw error;
  }
}

/**
 * Create a new team member (user) via Supabase Auth Admin API
 * This creates both the auth user and profile
 */
export async function createTeamMember(
  email: string,
  fullName: string,
  role: 'admin' | 'sdr' = 'sdr',
  workspaceId?: string
): Promise<TeamMember> {
  // Generate a random password (user will need to reset it)
  const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12) + 'A1!';
  
  // Create user in Supabase Auth
  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
    },
  });

  if (authError) throw authError;
  if (!authUser.user) throw new Error('Failed to create user');

  // Wait a bit for the trigger to create the profile
  await new Promise(resolve => setTimeout(resolve, 500));

  // Update profile with workspace_id if provided
  if (workspaceId) {
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ workspace_id: workspaceId, full_name: fullName })
      .eq('id', authUser.user.id);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      // Continue anyway - profile might have been created by trigger
    }
  }

  // Create role
  const { error: roleError } = await supabaseAdmin
    .from('user_roles')
    .insert({ user_id: authUser.user.id, role });

  if (roleError) {
    console.error('Error creating role:', roleError);
    // Continue anyway
  }

  // Get the created profile
  const member = await getTeamMemberById(authUser.user.id);
  if (!member) {
    throw new Error('Failed to retrieve created team member');
  }

  return member;
}

/**
 * Update a team member's profile information
 */
export async function updateTeamMember(
  userId: string,
  updates: { full_name?: string; email?: string }
): Promise<TeamMember> {
  // Update profile
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({
      full_name: updates.full_name,
      email: updates.email,
    })
    .eq('id', userId);

  if (profileError) throw profileError;

  // Update auth user email if changed
  if (updates.email) {
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { email: updates.email }
    );

    if (authError) {
      console.error('Error updating auth email:', authError);
      // Continue anyway - profile is updated
    }
  }

  const member = await getTeamMemberById(userId);
  if (!member) {
    throw new Error('Team member not found');
  }

  return member;
}

/**
 * Delete a team member (removes from auth and all related data)
 */
export async function deleteTeamMember(userId: string): Promise<void> {
  // Delete user roles first
  const { error: rolesError } = await supabaseAdmin
    .from('user_roles')
    .delete()
    .eq('user_id', userId);

  if (rolesError) {
    console.error('Error deleting user roles:', rolesError);
    // Continue anyway
  }

  // Clear conversation assignments
  const { error: convError } = await supabaseAdmin
    .from('conversations')
    .update({ assigned_to: null })
    .eq('assigned_to', userId);

  if (convError) {
    console.error('Error clearing conversation assignments:', convError);
    // Continue anyway
  }

  // Delete profile (this will cascade or be handled by trigger)
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .delete()
    .eq('id', userId);

  if (profileError) {
    console.error('Error deleting profile:', profileError);
    // Continue anyway - might be handled by auth delete
  }

  // Delete from Supabase Auth (this should cascade delete profile via trigger)
  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);

  if (authError) {
    throw new Error(`Failed to delete user: ${authError.message}`);
  }
}

