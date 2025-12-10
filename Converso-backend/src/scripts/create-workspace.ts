/**
 * Create Initial Workspace
 * Run this if you don't have any workspaces
 */

import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../utils/logger';

async function createWorkspace() {
  logger.info('========================================');
  logger.info('Creating Initial Workspace');
  logger.info('========================================\n');

  try {
    // Check if workspaces already exist
    const { data: existingWorkspaces, error: checkError } = await supabaseAdmin
      .from('workspaces')
      .select('*');

    if (checkError) {
      logger.error('❌ Error checking workspaces:', checkError);
      throw checkError;
    }

    if (existingWorkspaces && existingWorkspaces.length > 0) {
      logger.info(`✅ Workspace already exists: "${existingWorkspaces[0].name}"`);
      logger.info(`   ID: ${existingWorkspaces[0].id}`);
      logger.info('\nNo need to create a new one.\n');
      return existingWorkspaces[0];
    }

    // Create default workspace
    logger.info('Creating default workspace...');
    const { data: workspace, error: createError } = await supabaseAdmin
      .from('workspaces')
      .insert({
        name: 'Default Workspace',
      })
      .select()
      .single();

    if (createError) {
      logger.error('❌ Error creating workspace:', createError);
      throw createError;
    }

    logger.info('✅ Workspace created successfully!');
    logger.info(`   Name: ${workspace.name}`);
    logger.info(`   ID: ${workspace.id}\n`);

    logger.info('========================================');
    logger.info('✅ Setup Complete!');
    logger.info('You can now run: npm run test:db');
    logger.info('========================================');

    return workspace;
  } catch (error) {
    logger.error('❌ Failed to create workspace:', error);
    throw error;
  }
}

// Run the script
createWorkspace()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Script failed:', error);
    process.exit(1);
  });
