import { supabase } from '../lib/supabase';
import type { TeamMember } from '../types';

/**
 * API module for team member-related database queries
 */

export async function getTeamMembers(): Promise<TeamMember[]> {
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('*');

  if (profilesError) throw profilesError;

  const { data: roles, error: rolesError } = await supabase
    .from('user_roles')
    .select('*');

  if (rolesError) throw rolesError;

  // Combine profiles with roles
  const teamMembers = profiles.map(profile => {
    const userRole = roles.find(r => r.user_id === profile.id);
    return {
      ...profile,
      role: userRole?.role || 'sdr',
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

