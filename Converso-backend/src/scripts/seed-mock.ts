/**
 * Mock Data Seed Script
 * Seeds database with sample data using mock user IDs
 * Works without service role key
 * 
 * Run with: npm run seed:mock
 */

import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../utils/logger';

async function seedMock() {
  logger.info('🌱 Starting mock data seed...');

  try {
    // Use mock user IDs (these match the mock auth)
    const mockUserIds = {
      admin: 'admin-user-123',
      sdr1: 'sdr-user-456',
      sdr2: 'sdr-user-789',
    };

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
        .maybeSingle();

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

    // 2. Create Connected Accounts (using admin user ID)
    logger.info('Creating connected accounts...');
    const connectedAccounts = [
      {
        account_name: 'Sales Team Email',
        account_email: 'sales@converso.com',
        account_type: 'email',
        is_active: true,
        user_id: mockUserIds.admin,
      },
      {
        account_name: 'Support Email',
        account_email: 'support@converso.com',
        account_type: 'email',
        is_active: true,
        user_id: mockUserIds.admin,
      },
      {
        account_name: 'LinkedIn Business Account',
        account_email: null,
        account_type: 'linkedin',
        is_active: true,
        user_id: mockUserIds.admin,
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
        assigned_to: mockUserIds.sdr1,
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
        assigned_to: mockUserIds.sdr2,
        custom_stage_id: stageIds[2] || null,
        received_on_account_id: accountIds[2] || accountIds[0] || null,
      },
      {
        sender_name: 'Sarah Williams',
        sender_email: 'sarah.williams@example.com',
        subject: 'Proposal Review',
        preview: 'We\'ve reviewed your proposal and have some questions...',
        last_message_at: new Date(Date.now() - 10800000).toISOString(),
        conversation_type: 'email',
        status: 'qualified',
        is_read: true,
        assigned_to: mockUserIds.sdr1,
        custom_stage_id: stageIds[3] || null,
        received_on_account_id: accountIds[0] || null,
      },
      {
        sender_name: 'David Brown',
        sender_email: 'david.brown@example.com',
        subject: 'Contract Discussion',
        preview: 'Ready to move forward. Let\'s discuss contract terms...',
        last_message_at: new Date(Date.now() - 14400000).toISOString(),
        conversation_type: 'email',
        status: 'converted',
        is_read: true,
        assigned_to: mockUserIds.sdr2,
        custom_stage_id: stageIds[4] || null,
        received_on_account_id: accountIds[0] || null,
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
    if (conversationIds.length > 0) {
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
          sender_id: mockUserIds.sdr1,
          content: 'Hi John! Thank you for reaching out. I\'d be happy to schedule a call. What time works best for you?',
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
        {
          conversation_id: conversationIds[1],
          sender_name: 'SDR User',
          sender_id: mockUserIds.sdr1,
          content: 'Hi Jane! Great to hear from you. I\'ll send over our pricing options right away.',
          is_from_lead: false,
          created_at: new Date(Date.now() - 3300000).toISOString(),
        },
        {
          conversation_id: conversationIds[2],
          sender_name: 'Mike Johnson',
          content: 'I saw your post about the new features. Very interested in learning more!',
          is_from_lead: true,
          created_at: new Date(Date.now() - 7200000).toISOString(),
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

    logger.info('✅ Mock seed completed!');
    logger.info(`📊 Created:`);
    logger.info(`   - ${stageIds.length} pipeline stages`);
    logger.info(`   - ${accountIds.length} connected accounts`);
    logger.info(`   - ${conversationIds.length} conversations`);
    logger.info(`   - ${conversationIds.length > 0 ? '5' : '0'} messages`);

  } catch (error: any) {
    logger.error('❌ Seed failed:', error);
    throw error;
  }
}

if (require.main === module) {
  seedMock()
    .then(() => {
      logger.info('Seed script completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Seed script failed:', error);
      process.exit(1);
    });
}

export { seedMock };

