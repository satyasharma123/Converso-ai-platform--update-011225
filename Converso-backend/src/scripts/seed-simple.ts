/**
 * Simple Database Seed Script (Works without service role key)
 * Populates the database with sample data using existing users
 * 
 * Prerequisites:
 * 1. Users must already exist in Supabase Auth (created via frontend signup)
 * 2. Or provide SUPABASE_SERVICE_ROLE_KEY in .env for full seeding
 * 
 * Run with: npm run seed:simple
 */

import { supabase, supabaseAdmin } from '../lib/supabase';
import { logger } from '../utils/logger';

async function seedSimple() {
  logger.info('🌱 Starting simple database seed...');
  logger.info('Note: This script works with existing users or service role key');

  try {
    // Get existing users
    let userIds: string[] = [];
    
    try {
      const { data: users, error } = await supabaseAdmin.auth.admin.listUsers();
      if (error) {
        logger.warn('Cannot list users (need service role key). Using manual user IDs...');
        logger.info('Please provide user IDs manually or set SUPABASE_SERVICE_ROLE_KEY');
        return;
      }

      if (users && users.users.length > 0) {
        userIds = users.users.map(u => u.id);
        logger.info(`Found ${userIds.length} existing users`);
      } else {
        logger.info('No users found. Please create users first via frontend signup.');
        logger.info('Or set SUPABASE_SERVICE_ROLE_KEY to create users automatically.');
        return;
      }
    } catch (err) {
      logger.warn('Service role key not available. Skipping user creation.');
      logger.info('To seed with users, either:');
      logger.info('1. Create users via frontend signup first');
      logger.info('2. Or set SUPABASE_SERVICE_ROLE_KEY in .env file');
      return;
    }

    if (userIds.length === 0) {
      logger.warn('No users available. Cannot seed data.');
      return;
    }

    const adminUserId = userIds[0];
    const sdrUserIds = userIds.slice(1);

    // 1. Create Pipeline Stages
    logger.info('Creating pipeline stages...');
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
      const { data: existing } = await supabaseAdmin
        .from('pipeline_stages')
        .select('id')
        .eq('name', stage.name)
        .single();

      if (existing) {
        stageIds.push(existing.id);
        logger.info(`✓ Stage exists: ${stage.name}`);
      } else {
        const { data, error } = await supabaseAdmin
          .from('pipeline_stages')
          .insert(stage)
          .select('id')
          .single();

        if (error) {
          logger.warn(`Stage ${stage.name} error:`, error.message);
        } else if (data) {
          stageIds.push(data.id);
          logger.info(`✓ Created stage: ${stage.name}`);
        }
      }
    }

    // 2. Create Connected Accounts
    logger.info('Creating connected accounts...');
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
      const { data, error } = await supabaseAdmin
        .from('connected_accounts')
        .insert(account)
        .select('id')
        .single();

      if (error) {
        logger.warn(`Account ${account.account_name} error:`, error.message);
      } else if (data) {
        accountIds.push(data.id);
        logger.info(`✓ Created account: ${account.account_name}`);
      }
    }

    // 3. Create Conversations
    logger.info('Creating conversations...');
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
        assigned_to: sdrUserIds[0] || null,
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
        assigned_to: sdrUserIds[1] || sdrUserIds[0] || null,
        custom_stage_id: stageIds[2] || null,
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
        logger.warn(`Conversation error:`, error.message);
      } else if (data) {
        conversationIds.push(data.id);
        logger.info(`✓ Created conversation: ${conv.sender_name}`);
      }
    }

    // 4. Create Messages
    logger.info('Creating messages...');
    if (conversationIds.length > 0 && sdrUserIds.length > 0) {
      const messages = [
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
          sender_id: sdrUserIds[0],
          content: 'Hi John! Thank you for reaching out. I\'d be happy to schedule a call.',
          is_from_lead: false,
          created_at: new Date(Date.now() - 82800000).toISOString(),
        },
        {
          conversation_id: conversationIds[1],
          sender_name: 'Jane Smith',
          content: 'Thank you for the great presentation yesterday. I\'d like to discuss pricing options.',
          is_from_lead: true,
          created_at: new Date(Date.now() - 3600000).toISOString(),
        },
      ];

      for (const message of messages) {
        const { error } = await supabaseAdmin
          .from('messages')
          .insert(message);

        if (error) {
          logger.warn(`Message error:`, error.message);
        } else {
          logger.info(`✓ Created message`);
        }
      }
    }

    logger.info('✅ Simple seed completed!');
    logger.info(`📊 Created:`);
    logger.info(`   - ${stageIds.length} pipeline stages`);
    logger.info(`   - ${accountIds.length} connected accounts`);
    logger.info(`   - ${conversationIds.length} conversations`);
    logger.info(`   - ${conversationIds.length > 0 ? '3' : '0'} messages`);

  } catch (error: any) {
    logger.error('❌ Seed failed:', error);
    throw error;
  }
}

if (require.main === module) {
  seedSimple()
    .then(() => {
      logger.info('Seed script completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Seed script failed:', error);
      process.exit(1);
    });
}

export { seedSimple };

