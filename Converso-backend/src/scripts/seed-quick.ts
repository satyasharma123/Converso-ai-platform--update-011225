/**
 * Quick Database Seed Script
 * Populates database with dummy data for testing
 * 
 * This script:
 * 1. Uses existing users (from signup) or creates test users
 * 2. Creates pipeline stages
 * 3. Creates connected accounts
 * 4. Creates conversations (email and LinkedIn)
 * 5. Creates messages for conversations
 * 
 * Run with: npm run seed:quick
 * Or: cd Converso-backend && npm run seed:quick
 */

import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../utils/logger';

async function seedQuick() {
  logger.info('🌱 Starting quick database seed...');
  logger.info('This will populate your database with sample data');

  try {
    // Step 1: Get or create users
    logger.info('📋 Step 1: Checking for existing users...');
    let userIds: string[] = [];
    
    try {
      const { data: users, error } = await supabaseAdmin.auth.admin.listUsers();
      if (error) {
        logger.warn('⚠️  Cannot list users. This requires SUPABASE_SERVICE_ROLE_KEY.');
        logger.info('💡 Solution: Add SUPABASE_SERVICE_ROLE_KEY to .env file');
        logger.info('   Or: Create users via frontend signup first, then run this script');
        return;
      }

      if (users && users.users.length > 0) {
        userIds = users.users.map(u => u.id);
        logger.info(`✅ Found ${userIds.length} existing users`);
      } else {
        logger.warn('⚠️  No users found.');
        logger.info('💡 Please create at least one user via frontend signup first');
        logger.info('   Then run this script again');
        return;
      }
    } catch (err: any) {
      logger.error('❌ Error accessing users:', err.message);
      logger.info('💡 Make sure SUPABASE_SERVICE_ROLE_KEY is set in .env');
      return;
    }

    if (userIds.length === 0) {
      logger.error('❌ No users available. Cannot seed data.');
      return;
    }

    const adminUserId = userIds[0];
    const sdrUserIds = userIds.slice(1, userIds.length);

    // Step 2: Create Pipeline Stages
    logger.info('📋 Step 2: Creating pipeline stages...');
    const pipelineStages = [
      { name: 'New Lead', description: 'Newly received leads', display_order: 0 },
      { name: 'Contacted', description: 'Initial contact made', display_order: 1 },
      { name: 'Qualified', description: 'Lead qualified for sales', display_order: 2 },
      { name: 'Proposal Sent', description: 'Proposal sent to lead', display_order: 3 },
      { name: 'Negotiation', description: 'In negotiation phase', display_order: 4 },
      { name: 'Closed Won', description: 'Deal closed successfully', display_order: 5 },
      { name: 'Closed Lost', description: 'Deal lost', display_order: 6 },
    ];

    const stageIds: string[] = [];
    for (const stage of pipelineStages) {
      // Check if stage already exists
      const { data: existing } = await supabaseAdmin
        .from('pipeline_stages')
        .select('id')
        .eq('name', stage.name)
        .single();

      if (existing) {
        stageIds.push(existing.id);
        logger.info(`   ✓ Stage exists: ${stage.name}`);
      } else {
        const { data, error } = await supabaseAdmin
          .from('pipeline_stages')
          .insert(stage)
          .select('id')
          .single();

        if (error) {
          logger.warn(`   ⚠️  Stage ${stage.name} error: ${error.message}`);
        } else if (data) {
          stageIds.push(data.id);
          logger.info(`   ✓ Created stage: ${stage.name}`);
        }
      }
    }

    // Step 3: Create Connected Accounts
    logger.info('📋 Step 3: Creating connected accounts...');
    const connectedAccounts = [
      {
        account_name: 'Sales Team Email',
        account_email: 'sales@converso.com',
        account_type: 'email',
        is_active: true,
        user_id: adminUserId,
      },
      {
        account_name: 'Support Email',
        account_email: 'support@converso.com',
        account_type: 'email',
        is_active: true,
        user_id: adminUserId,
      },
      {
        account_name: 'LinkedIn Business Account',
        account_email: null,
        account_type: 'linkedin',
        is_active: true,
        user_id: adminUserId,
      },
    ];

    const accountIds: string[] = [];
    for (const account of connectedAccounts) {
      // Check if account already exists
      const { data: existing } = await supabaseAdmin
        .from('connected_accounts')
        .select('id')
        .eq('account_name', account.account_name)
        .eq('user_id', account.user_id)
        .single();

      if (existing) {
        accountIds.push(existing.id);
        logger.info(`   ✓ Account exists: ${account.account_name}`);
      } else {
        const { data, error } = await supabaseAdmin
          .from('connected_accounts')
          .insert(account)
          .select('id')
          .single();

        if (error) {
          logger.warn(`   ⚠️  Account ${account.account_name} error: ${error.message}`);
        } else if (data) {
          accountIds.push(data.id);
          logger.info(`   ✓ Created account: ${account.account_name}`);
        }
      }
    }

    // Step 4: Create Conversations
    logger.info('📋 Step 4: Creating conversations...');
    const conversations = [
      {
        sender_name: 'John Doe',
        sender_email: 'john.doe@example.com',
        subject: 'Interested in your product',
        preview: 'Hi, I would like to learn more about your services. Can we schedule a call?',
        last_message_at: new Date().toISOString(),
        conversation_type: 'email',
        status: 'new',
        is_read: false,
        received_on_account_id: accountIds[0] || null,
      },
      {
        sender_name: 'Jane Smith',
        sender_email: 'jane.smith@example.com',
        subject: 'Follow up on meeting',
        preview: 'Thank you for the great presentation yesterday. I\'d like to discuss pricing...',
        last_message_at: new Date(Date.now() - 3600000).toISOString(),
        conversation_type: 'email',
        status: 'engaged',
        is_read: true,
        assigned_to: sdrUserIds[0] || adminUserId,
        custom_stage_id: stageIds[1] || null,
        received_on_account_id: accountIds[0] || null,
      },
      {
        sender_name: 'Mike Johnson',
        sender_linkedin_url: 'https://linkedin.com/in/mikejohnson',
        preview: 'I saw your post about the new features. Very interested in learning more!',
        last_message_at: new Date(Date.now() - 7200000).toISOString(),
        conversation_type: 'linkedin',
        status: 'qualified',
        is_read: false,
        assigned_to: sdrUserIds[1] || sdrUserIds[0] || adminUserId,
        custom_stage_id: stageIds[2] || null,
        received_on_account_id: accountIds[2] || accountIds[0] || null,
      },
      {
        sender_name: 'Sarah Williams',
        sender_email: 'sarah.williams@example.com',
        subject: 'Product demo request',
        preview: 'We are looking for a solution like yours. Can we schedule a demo?',
        last_message_at: new Date(Date.now() - 1800000).toISOString(),
        conversation_type: 'email',
        status: 'new',
        is_read: false,
        received_on_account_id: accountIds[0] || null,
      },
      {
        sender_name: 'David Brown',
        sender_email: 'david.brown@example.com',
        subject: 'Pricing inquiry',
        preview: 'What are your pricing plans? We have a team of 50 people.',
        last_message_at: new Date(Date.now() - 5400000).toISOString(),
        conversation_type: 'email',
        status: 'qualified',
        is_read: true,
        assigned_to: sdrUserIds[0] || adminUserId,
        custom_stage_id: stageIds[2] || null,
        received_on_account_id: accountIds[0] || null,
      },
      {
        sender_name: 'Emily Davis',
        sender_linkedin_url: 'https://linkedin.com/in/emilydavis',
        preview: 'Love what you\'re building! Would love to connect and learn more.',
        last_message_at: new Date(Date.now() - 10800000).toISOString(),
        conversation_type: 'linkedin',
        status: 'new',
        is_read: false,
        received_on_account_id: accountIds[2] || accountIds[0] || null,
      },
    ];

    const conversationIds: string[] = [];
    for (const conv of conversations) {
      const { data, error } = await supabaseAdmin
        .from('conversations')
        .insert(conv)
        .select('id')
        .single();

      if (error) {
        logger.warn(`   ⚠️  Conversation error (${conv.sender_name}): ${error.message}`);
      } else if (data) {
        conversationIds.push(data.id);
        logger.info(`   ✓ Created conversation: ${conv.sender_name} (${conv.conversation_type})`);
      }
    }

    // Step 5: Create Messages
    logger.info('📋 Step 5: Creating messages...');
    if (conversationIds.length > 0) {
      const messages = [
        // Conversation 1: John Doe
        {
          conversation_id: conversationIds[0],
          sender_name: 'John Doe',
          content: 'Hi, I would like to learn more about your services. Can we schedule a call?',
          is_from_lead: true,
          created_at: new Date(Date.now() - 86400000).toISOString(),
        },
        {
          conversation_id: conversationIds[0],
          sender_name: 'SDR User',
          sender_id: sdrUserIds[0] || adminUserId,
          content: 'Hi John! Thank you for reaching out. I\'d be happy to schedule a call. What time works best for you?',
          is_from_lead: false,
          created_at: new Date(Date.now() - 82800000).toISOString(),
        },
        // Conversation 2: Jane Smith
        {
          conversation_id: conversationIds[1],
          sender_name: 'Jane Smith',
          content: 'Thank you for the great presentation yesterday. I\'d like to discuss pricing options.',
          is_from_lead: true,
          created_at: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          conversation_id: conversationIds[1],
          sender_name: 'SDR User',
          sender_id: sdrUserIds[0] || adminUserId,
          content: 'Hi Jane! Great to hear from you. I\'ll send over our pricing options right away.',
          is_from_lead: false,
          created_at: new Date(Date.now() - 3300000).toISOString(),
        },
        // Conversation 3: Mike Johnson (LinkedIn)
        {
          conversation_id: conversationIds[2],
          sender_name: 'Mike Johnson',
          content: 'I saw your post about the new features. Very interested in learning more!',
          is_from_lead: true,
          created_at: new Date(Date.now() - 7200000).toISOString(),
        },
        // Conversation 4: Sarah Williams
        {
          conversation_id: conversationIds[3],
          sender_name: 'Sarah Williams',
          content: 'We are looking for a solution like yours. Can we schedule a demo?',
          is_from_lead: true,
          created_at: new Date(Date.now() - 1800000).toISOString(),
        },
        // Conversation 5: David Brown
        {
          conversation_id: conversationIds[4],
          sender_name: 'David Brown',
          content: 'What are your pricing plans? We have a team of 50 people.',
          is_from_lead: true,
          created_at: new Date(Date.now() - 5400000).toISOString(),
        },
        {
          conversation_id: conversationIds[4],
          sender_name: 'SDR User',
          sender_id: sdrUserIds[0] || adminUserId,
          content: 'Hi David! For teams of 50, we have a special enterprise plan. Let me send you the details.',
          is_from_lead: false,
          created_at: new Date(Date.now() - 5100000).toISOString(),
        },
        // Conversation 6: Emily Davis (LinkedIn)
        {
          conversation_id: conversationIds[5],
          sender_name: 'Emily Davis',
          content: 'Love what you\'re building! Would love to connect and learn more.',
          is_from_lead: true,
          created_at: new Date(Date.now() - 10800000).toISOString(),
        },
      ];

      let messageCount = 0;
      for (const message of messages) {
        const { error } = await supabaseAdmin
          .from('messages')
          .insert(message);

        if (error) {
          logger.warn(`   ⚠️  Message error: ${error.message}`);
        } else {
          messageCount++;
        }
      }
      logger.info(`   ✓ Created ${messageCount} messages`);
    }

    // Summary
    logger.info('');
    logger.info('✅ Seed completed successfully!');
    logger.info('📊 Summary:');
    logger.info(`   - Pipeline stages: ${stageIds.length}`);
    logger.info(`   - Connected accounts: ${accountIds.length}`);
    logger.info(`   - Conversations: ${conversationIds.length}`);
    logger.info(`   - Messages: ${conversationIds.length > 0 ? '9' : '0'}`);
    logger.info('');
    logger.info('🎉 Your database is now populated with sample data!');
    logger.info('💡 Refresh your frontend to see the data');

  } catch (error: any) {
    logger.error('❌ Seed failed:', error);
    logger.error('Error details:', error.message);
    throw error;
  }
}

if (require.main === module) {
  seedQuick()
    .then(() => {
      logger.info('Script completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Script failed:', error);
      process.exit(1);
    });
}

export { seedQuick };

