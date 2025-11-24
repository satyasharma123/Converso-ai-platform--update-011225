/**
 * Delete All Users Script
 * 
 * This script deletes all users from Supabase Auth
 * Requires SUPABASE_SERVICE_ROLE_KEY
 * 
 * Usage: npm run delete-users
 * 
 * WARNING: This will delete ALL users!
 */

import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../utils/logger';

async function deleteAllUsers() {
  logger.info('🗑️  Starting user deletion...');
  logger.warn('⚠️  WARNING: This will delete ALL users!');

  try {
    // Get all users
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      logger.error('Failed to list users:', listError);
      throw listError;
    }

    if (!users || users.users.length === 0) {
      logger.info('No users found to delete');
      return;
    }

    logger.info(`Found ${users.users.length} users to delete`);

    // Delete each user
    let deletedCount = 0;
    let errorCount = 0;

    for (const user of users.users) {
      try {
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

        if (deleteError) {
          logger.warn(`Failed to delete user ${user.email}:`, deleteError.message);
          errorCount++;
        } else {
          logger.info(`✓ Deleted user: ${user.email}`);
          deletedCount++;
        }
      } catch (err: any) {
        logger.warn(`Error deleting user ${user.email}:`, err.message);
        errorCount++;
      }
    }

    // Clean up related data FIRST (before deleting users)
    // This prevents foreign key constraint errors
    logger.info('Cleaning up related data (in correct order)...');

    // Step 1: Delete user messages (messages sent by users, not leads)
    const { error: messagesError } = await supabaseAdmin
      .from('messages')
      .delete()
      .not('sender_id', 'is', null);

    if (messagesError) {
      logger.warn('Error deleting user messages:', messagesError.message);
    } else {
      logger.info('✓ Deleted user messages');
    }

    // Step 2: Clear conversation assignments
    const { error: convError } = await supabaseAdmin
      .from('conversations')
      .update({ assigned_to: null })
      .not('assigned_to', 'is', null);

    if (convError) {
      logger.warn('Error clearing conversation assignments:', convError.message);
    } else {
      logger.info('✓ Cleared conversation assignments');
    }

    // Step 3: Delete connected accounts
    const { error: accountsError } = await supabaseAdmin
      .from('connected_accounts')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (accountsError) {
      logger.warn('Error deleting connected accounts:', accountsError.message);
    } else {
      logger.info('✓ Deleted all connected accounts');
    }

    // Step 4: Delete user roles
    const { error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .neq('user_id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (rolesError) {
      logger.warn('Error deleting user roles:', rolesError.message);
    } else {
      logger.info('✓ Deleted all user roles');
    }

    // Step 5: Delete profiles (last, as it references auth.users)
    const { error: profilesError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (profilesError) {
      logger.warn('Error deleting profiles:', profilesError.message);
    } else {
      logger.info('✓ Deleted all profiles');
    }

    logger.info('');
    logger.info('✅ User deletion completed!');
    logger.info(`   - Deleted ${deletedCount} users`);
    if (errorCount > 0) {
      logger.warn(`   - ${errorCount} errors occurred`);
    }
    logger.info('');
    logger.info('🎯 You can now sign up as the first user (Admin)');

  } catch (error: any) {
    logger.error('❌ Deletion failed:', error);
    throw error;
  }
}

if (require.main === module) {
  deleteAllUsers()
    .then(() => {
      logger.info('Script completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Script failed:', error);
      process.exit(1);
    });
}

export { deleteAllUsers };

