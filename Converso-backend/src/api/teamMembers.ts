import { supabaseAdmin } from '../lib/supabase';
import type { TeamMember } from '../types';
import { sendInvitationEmail } from '../utils/emailService';
import { getWorkspace } from './workspace';
import { logger } from '../utils/logger';

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
    .select('*')
    .or('is_deleted.is.null,is_deleted.eq.false'); // Include NULL and false (exclude only true)

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
      status: profile.status || 'active', // Include status in response
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
 * Sends invitation email if role is 'sdr'
 */
export async function createTeamMember(
  email: string,
  fullName: string,
  role: 'admin' | 'sdr' = 'sdr',
  workspaceId?: string,
  adminUserId?: string,
  adminName?: string
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

  const userId = authUser.user.id;
  logger.info('User created in auth', { userId, email });

  // Wait for trigger to potentially create profile
  await new Promise(resolve => setTimeout(resolve, 500));

  // Check if profile exists
  const { data: existingProfile, error: checkError } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .single();

  if (checkError && checkError.code !== 'PGRST116') {
    logger.error('Error checking profile:', checkError);
  }

  // Prepare profile data
  const profileData: any = {
    id: userId,
    email: email,
    full_name: fullName,
    status: 'invited',
    is_deleted: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (workspaceId) {
    profileData.workspace_id = workspaceId;
  }

  if (existingProfile) {
    // Profile exists, update it
    logger.info('Profile exists, updating', { userId });
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name: fullName,
        status: 'invited',
        is_deleted: false,
        workspace_id: workspaceId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      logger.error('Error updating profile:', updateError);
      throw new Error(`Failed to update profile: ${updateError.message}`);
    }
  } else {
    // Profile doesn't exist, create it
    logger.info('Profile missing, creating', { userId });
    const { error: insertError } = await supabaseAdmin
      .from('profiles')
      .insert(profileData);

    if (insertError) {
      logger.error('Error creating profile:', insertError);
      throw new Error(`Failed to create profile: ${insertError.message}`);
    }
  }

  // Verify profile was created/updated
  const { data: verifiedProfile, error: verifyError } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (verifyError || !verifiedProfile) {
    logger.error('Profile verification failed', { userId, error: verifyError });
    throw new Error('Profile creation/update verification failed');
  }

  logger.info('Profile verified', { userId, email: verifiedProfile.email });

  // Create role
  const { error: roleError } = await supabaseAdmin
    .from('user_roles')
    .insert({ user_id: userId, role })
    .select()
    .single();

  if (roleError) {
    // Check if role already exists
    const { data: existingRole } = await supabaseAdmin
      .from('user_roles')
      .select('*')
      .eq('user_id', userId)
      .eq('role', role)
      .single();

    if (!existingRole) {
      logger.error('Error creating role:', roleError);
      // Don't throw - profile is created, role issue is less critical
    } else {
      logger.info('Role already exists', { userId, role });
    }
  } else {
    logger.info('Role created', { userId, role });
  }

  // Get the created profile
  const member = await getTeamMemberById(authUser.user.id);
  if (!member) {
    throw new Error('Failed to retrieve created team member');
  }

  // Send invitation email if role is 'sdr'
  if (role === 'sdr') {
    try {
      // Get admin name if not provided
      let adminDisplayName = adminName || 'Admin';
      if (adminUserId && !adminName) {
        const { data: adminProfile } = await supabaseAdmin
          .from('profiles')
          .select('full_name')
          .eq('id', adminUserId)
          .single();
        if (adminProfile?.full_name) {
          adminDisplayName = adminProfile.full_name;
        }
      }

      // Get workspace name
      let workspaceName = 'Converso';
      if (workspaceId) {
        const { data: workspace } = await supabaseAdmin
          .from('workspaces')
          .select('name')
          .eq('id', workspaceId)
          .single();
        if (workspace?.name) {
          workspaceName = workspace.name;
        }
      } else {
        // Try to get default workspace
        const workspace = await getWorkspace();
        if (workspace?.name) {
          workspaceName = workspace.name;
        }
      }

      // Generate password reset link
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: email,
        options: {
          redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:8082'}/reset-password`,
        },
      });

      if (linkError) {
        logger.error('Error generating password reset link:', {
          error: linkError.message,
          email,
          code: linkError.status,
        });
        // Don't throw - user is already created, just log the error
      } else if (linkData?.properties?.action_link) {
        // Send invitation email
        try {
          await sendInvitationEmail({
            toEmail: email,
            toName: fullName,
            adminName: adminDisplayName,
            workspaceName: workspaceName,
            resetLink: linkData.properties.action_link,
          });
          logger.info('Invitation email sent successfully', { 
            email, 
            adminName: adminDisplayName, 
            workspaceName,
            resetLink: linkData.properties.action_link.substring(0, 50) + '...'
          });
        } catch (emailError: any) {
          // Log error but don't fail user creation
          logger.error('Error sending invitation email:', {
            error: emailError.message,
            email,
            adminName: adminDisplayName,
            workspaceName,
            stack: emailError.stack,
          });
          // Continue - user is created even if email fails
        }
      } else {
        logger.warn('Password reset link generated but action_link is missing', { 
          email,
          linkData: linkData ? 'exists but no action_link' : 'null'
        });
      }
    } catch (emailError: any) {
      // Don't fail user creation if email fails
      logger.error('Error in email sending process:', {
        error: emailError.message,
        email,
        stack: emailError.stack,
      });
    }
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
  // Soft delete: Mark user as deleted but keep data for integrity
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({ is_deleted: true })
    .eq('id', userId);

  if (profileError) {
    throw new Error(`Failed to soft delete user profile: ${profileError.message}`);
  }

  // Clear conversation assignments
  const { error: convError } = await supabaseAdmin
    .from('conversations')
    .update({ assigned_to: null })
    .eq('assigned_to', userId);

  if (convError) {
    console.error('Error clearing conversation assignments:', convError);
    // Continue anyway - not critical
  }

  // Delete user roles
  const { error: rolesError } = await supabaseAdmin
    .from('user_roles')
    .delete()
    .eq('user_id', userId);

  if (rolesError) {
    console.error('Error deleting user roles:', rolesError);
    // Continue anyway - not critical
  }

  logger.info('User soft deleted successfully', { userId });
}

/**
 * Resend invitation email to a team member
 */
export async function resendInvitation(
  userId: string,
  adminUserId?: string,
  adminName?: string
): Promise<{ success: boolean; message: string }> {
  // Get user profile
  const member = await getTeamMemberById(userId);
  
  if (!member) {
    throw new Error('Team member not found');
  }

  if (member.status === 'active') {
    return {
      success: false,
      message: 'User has already signed up and is active',
    };
  }

  try {
    // Get admin name if not provided
    let adminDisplayName = adminName || 'Admin';
    if (adminUserId && !adminName) {
      const { data: adminProfile } = await supabaseAdmin
        .from('profiles')
        .select('full_name')
        .eq('id', adminUserId)
        .single();
      if (adminProfile?.full_name) {
        adminDisplayName = adminProfile.full_name;
      }
    }

    // Get workspace name
    let workspaceName = 'Converso';
    if (member.workspace_id) {
      const { data: workspace } = await supabaseAdmin
        .from('workspaces')
        .select('name')
        .eq('id', member.workspace_id)
        .single();
      if (workspace?.name) {
        workspaceName = workspace.name;
      }
    } else {
      const workspace = await getWorkspace();
      if (workspace?.name) {
        workspaceName = workspace.name;
      }
    }

    // Generate new password reset link
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: member.email,
      options: {
        redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:8082'}/reset-password`,
      },
    });

    if (linkError) {
      logger.error('Error generating password reset link:', {
        error: linkError.message,
        email: member.email,
        code: linkError.status,
      });
      return {
        success: false,
        message: 'Failed to generate invitation link',
      };
    }

    if (linkData?.properties?.action_link) {
      // Send invitation email
      await sendInvitationEmail({
        toEmail: member.email,
        toName: member.full_name,
        adminName: adminDisplayName,
        workspaceName: workspaceName,
        resetLink: linkData.properties.action_link,
      });

      logger.info('Invitation email resent successfully', {
        userId,
        email: member.email,
        adminName: adminDisplayName,
      });

      return {
        success: true,
        message: 'Invitation email sent successfully',
      };
    } else {
      logger.warn('Password reset link generated but action_link is missing', {
        email: member.email,
      });
      return {
        success: false,
        message: 'Failed to generate invitation link',
      };
    }
  } catch (error: any) {
    logger.error('Error resending invitation:', {
      error: error.message,
      userId,
      stack: error.stack,
    });
    return {
      success: false,
      message: error.message || 'Failed to resend invitation',
    };
  }
}

/**
 * Get invitation link for a team member
 */
export async function getInvitationLink(userId: string): Promise<{ success: boolean; link?: string; message: string }> {
  // Get user profile
  const member = await getTeamMemberById(userId);
  
  if (!member) {
    throw new Error('Team member not found');
  }

  if (member.status === 'active') {
    return {
      success: false,
      message: 'User has already signed up and is active',
    };
  }

  try {
    // Generate password reset link
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: member.email,
      options: {
        redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:8082'}/reset-password`,
      },
    });

    if (linkError || !linkData?.properties?.action_link) {
      logger.error('Error generating invitation link:', {
        error: linkError?.message,
        email: member.email,
      });
      return {
        success: false,
        message: 'Failed to generate invitation link',
      };
    }

    return {
      success: true,
      link: linkData.properties.action_link,
      message: 'Invitation link generated successfully',
    };
  } catch (error: any) {
    logger.error('Error getting invitation link:', {
      error: error.message,
      userId,
      stack: error.stack,
    });
    return {
      success: false,
      message: error.message || 'Failed to get invitation link',
    };
  }
}

