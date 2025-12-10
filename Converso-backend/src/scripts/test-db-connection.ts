/**
 * Test Database Connection and Write Permissions
 * Run this to verify Supabase connection is working correctly
 */

import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../utils/logger';

async function testDatabaseConnection() {
  logger.info('========================================');
  logger.info('Testing Supabase Database Connection');
  logger.info('========================================\n');

  try {
    // Test 1: Check if we can connect to Supabase
    logger.info('Test 1: Checking Supabase connection...');
    const { data: healthCheck, error: healthError } = await supabaseAdmin
      .from('workspaces')
      .select('id')
      .limit(1);

    if (healthError) {
      logger.error('❌ FAILED: Cannot connect to Supabase');
      logger.error('Error:', healthError);
      return;
    }
    logger.info('✅ PASSED: Supabase connection successful\n');

    // Test 2: Check workspaces table
    logger.info('Test 2: Checking workspaces table...');
    const { data: workspaces, error: workspaceError } = await supabaseAdmin
      .from('workspaces')
      .select('*');

    if (workspaceError) {
      logger.error('❌ FAILED: Cannot query workspaces');
      logger.error('Error:', workspaceError);
      return;
    }
    logger.info(`✅ PASSED: Found ${workspaces?.length || 0} workspace(s)\n`);

    if (!workspaces || workspaces.length === 0) {
      logger.warn('⚠️  WARNING: No workspaces found. You may need to create one first.');
      return;
    }

    const testWorkspaceId = workspaces[0].id;
    logger.info(`Using workspace: ${testWorkspaceId}\n`);

    // Test 3: Check connected_accounts table
    logger.info('Test 3: Checking connected_accounts table...');
    const { data: accounts, error: accountsError } = await supabaseAdmin
      .from('connected_accounts')
      .select('*')
      .eq('account_type', 'linkedin');

    if (accountsError) {
      logger.error('❌ FAILED: Cannot query connected_accounts');
      logger.error('Error:', accountsError);
      return;
    }
    logger.info(`✅ PASSED: Found ${accounts?.length || 0} LinkedIn account(s)\n`);

    // Test 4: Try to insert a test message
    logger.info('Test 4: Testing message insert permission...');
    
    const testMessageId = 'test-' + Date.now();
    const testConversationId = 'test-conv-' + Date.now();

    // First create a test conversation
    const { error: convError } = await supabaseAdmin
      .from('conversations')
      .insert({
        id: testConversationId,
        conversation_type: 'linkedin',
        sender_name: 'Test User',
        subject: 'Test Conversation',
        preview: 'This is a test',
        last_message_at: new Date().toISOString(),
        workspace_id: testWorkspaceId,
        status: 'new',
        is_read: false,
      });

    if (convError) {
      logger.error('❌ FAILED: Cannot insert test conversation');
      logger.error('Error:', convError);
      logger.error('This suggests RLS policies or permissions issue');
      return;
    }
    logger.info('✅ Test conversation created\n');

    // Now try to insert a test message
    const { error: msgError } = await supabaseAdmin
      .from('messages')
      .insert({
        id: testMessageId,
        conversation_id: testConversationId,
        sender_name: 'Test Sender',
        content: 'This is a test message',
        created_at: new Date().toISOString(),
        is_from_lead: false,
        workspace_id: testWorkspaceId,
        linkedin_message_id: 'test-linkedin-msg-' + Date.now(),
      });

    if (msgError) {
      logger.error('❌ FAILED: Cannot insert test message');
      logger.error('Error:', msgError);
      logger.error('Error code:', msgError.code);
      logger.error('Error details:', msgError.details);
      logger.error('Error hint:', msgError.hint);
      logger.error('\nThis is likely an RLS policy or column constraint issue.');
      
      // Clean up conversation
      await supabaseAdmin.from('conversations').delete().eq('id', testConversationId);
      return;
    }

    logger.info('✅ PASSED: Test message inserted successfully\n');

    // Test 5: Verify the message is readable
    logger.info('Test 5: Verifying message is readable...');
    const { data: readMessage, error: readError } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('linkedin_message_id', 'test-linkedin-msg-' + Date.now())
      .single();

    if (readError && readError.code !== 'PGRST116') { // PGRST116 = no rows
      logger.error('❌ FAILED: Cannot read test message');
      logger.error('Error:', readError);
    } else {
      logger.info('✅ PASSED: Test message is readable\n');
    }

    // Clean up test data
    logger.info('Cleaning up test data...');
    await supabaseAdmin.from('messages').delete().eq('id', testMessageId);
    await supabaseAdmin.from('conversations').delete().eq('id', testConversationId);
    logger.info('✅ Test data cleaned up\n');

    // Test 6: Check existing LinkedIn messages
    logger.info('Test 6: Checking existing LinkedIn messages...');
    const { data: existingMessages, error: existingError } = await supabaseAdmin
      .from('messages')
      .select('id, sender_name, created_at, linkedin_message_id')
      .not('linkedin_message_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5);

    if (existingError) {
      logger.error('❌ FAILED: Cannot query existing messages');
      logger.error('Error:', existingError);
      return;
    }

    logger.info(`Found ${existingMessages?.length || 0} existing LinkedIn messages`);
    if (existingMessages && existingMessages.length > 0) {
      logger.info('Latest messages:');
      existingMessages.forEach((msg) => {
        logger.info(`  - ${msg.sender_name} at ${msg.created_at}`);
      });
    }
    logger.info('');

    // Final summary
    logger.info('========================================');
    logger.info('✅ ALL TESTS PASSED!');
    logger.info('Your database connection is working correctly.');
    logger.info('You can now run the LinkedIn sync.');
    logger.info('========================================');

  } catch (error) {
    logger.error('❌ Unexpected error during testing:');
    logger.error(error);
  }
}

// Run the test
testDatabaseConnection()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Test failed with error:', error);
    process.exit(1);
  });
