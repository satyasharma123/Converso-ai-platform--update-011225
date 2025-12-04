import { supabase } from '../lib/supabase';
import type { TeamMember } from '../types';

/**
 * API module for team member-related database queries
 */

export async function getTeamMembers(userId?: string): Promise<TeamMember[]> {
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('*')
    .or('is_deleted.is.null,is_deleted.eq.false'); // Exclude deleted users

  if (profilesError) throw profilesError;

  if (!profiles || profiles.length === 0) {
    return [];
  }

  // Get roles only for the fetched users
  const userIds = profiles.map(p => p.id);
  const { data: roles, error: rolesError } = await supabase
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
      status: profile.status || 'active', // Include status field
    } as TeamMember;
  });

  return teamMembers;
}

export async function getTeamMemberById(userId: string): Promise<TeamMember | null> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (profileError) throw profileError;

  const { data: role, error: roleError } = await supabase
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
  const { data: existingRole } = await supabase
    .from('user_roles')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (existingRole) {
    // Update existing role
    const { error } = await supabase
      .from('user_roles')
      .update({ role })
      .eq('user_id', userId);

    if (error) throw error;
  } else {
    // Create new role
    const { error } = await supabase
      .from('user_roles')
      .insert({ user_id: userId, role });

    if (error) throw error;
  }
}

// Stub implementations for functions that are called but not yet fully implemented
export async function createTeamMember(
  email: string,
  fullName: string,
  role: 'admin' | 'sdr',
  workspaceId?: string,
  adminUserId?: string,
  adminName?: string
): Promise<TeamMember> {
  throw new Error('Team member creation not yet implemented. Please use the profiles API instead.');
}

export async function updateTeamMember(
  userId: string,
  updates: { full_name?: string; email?: string }
): Promise<TeamMember> {
  throw new Error('Team member update not yet implemented. Please use the profiles API instead.');
}

export async function deleteTeamMember(userId: string): Promise<void> {
  throw new Error('Team member deletion not yet implemented. Please use the profiles API instead.');
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
