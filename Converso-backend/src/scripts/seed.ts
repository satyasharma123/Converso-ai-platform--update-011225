/**
 * Database Seed Script
 * Populates the database with sample data for testing
 * 
 * Run with: npm run seed
 * Or: tsx src/scripts/seed.ts
 */

import { supabase, supabaseAdmin } from '../lib/supabase';
import { logger } from '../utils/logger';

interface SeedData {
  profiles: any[];
  userRoles: any[];
  pipelineStages: any[];
  connectedAccounts: any[];
  conversations: any[];
  messages: any[];
}

async function seedDatabase() {
  logger.info('🌱 Starting database seed...');

  try {
    // 1. Create Users in Auth (if they don't exist)
    logger.info('Creating users in Supabase Auth...');
    const users = [
      { email: 'admin@converso.ai', password: 'admin123', full_name: 'Admin User' },
      { email: 'sdr@converso.ai', password: 'sdr123', full_name: 'SDR User' },
      { email: 'sdr2@converso.ai', password: 'sdr123', full_name: 'Jane SDR' },
    ];

    const userIds: string[] = [];

    for (const user of users) {
      // Check if user already exists
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers?.users.find(u => u.email === user.email);

      if (existingUser) {
        logger.info(`✓ User already exists: ${user.email} (${existingUser.id})`);
        userIds.push(existingUser.id);
      } else {
        // Create new user
        const { data: newUser, error } = await supabaseAdmin.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true,
          user_metadata: {
            full_name: user.full_name,
          },
        });

        if (error) {
          logger.warn(`User ${user.email} creation error:`, error.message);
        } else if (newUser.user) {
          logger.info(`✓ Created user: ${user.email} (${newUser.user.id})`);
          userIds.push(newUser.user.id);
        }
      }
    }

    if (userIds.length === 0) {
      logger.warn('No users created. Using existing users or manual creation required.');
      logger.info('Please create users manually in Supabase Auth or provide service role key.');
      return;
    }

    // Wait a bit for triggers to create profiles
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 2. Create User Roles
    logger.info('Creating user roles...');
    const userRoles = [
      { user_id: userIds[0], role: 'admin' },
      { user_id: userIds[1], role: 'sdr' },
      { user_id: userIds[2], role: 'sdr' },
    ];

    for (const role of userRoles) {
      const { error } = await supabaseAdmin
        .from('user_roles')
        .upsert(role, { onConflict: 'user_id' });
      
      if (error) {
        logger.warn(`Role for ${role.user_id} error:`, error.message);
      } else {
        logger.info(`✓ Created role: ${role.user_id} -> ${role.role}`);
      }
    }

    // 3. Create Pipeline Stages
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
      // Check if stage exists first
      const { data: existing } = await supabaseAdmin
        .from('pipeline_stages')
        .select('id')
        .eq('name', stage.name)
        .single();

      if (existing) {
        stageIds.push(existing.id);
        logger.info(`✓ Stage already exists: ${stage.name}`);
        continue;
      }

      const { data, error } = await supabaseAdmin
        .from('pipeline_stages')
        .insert(stage)
        .select('id')
        .single();
      
      if (error) {
        logger.warn(`Pipeline stage ${stage.name} error:`, error.message);
      } else {
        logger.info(`✓ Created stage: ${stage.name}`);
        if (data) stageIds.push(data.id);
      }
    }

    // 4. Create Connected Accounts
    logger.info('Creating connected accounts...');
    const connectedAccounts = [
      {
        account_name: 'Sales Team Email',
        account_email: 'sales@converso.com',
        account_type: 'email',
        is_active: true,
        user_id: 'admin-user-123',
      },
      {
        account_name: 'Support Email',
        account_email: 'support@converso.com',
        account_type: 'email',
        is_active: true,
        user_id: 'admin-user-123',
      },
      {
        account_name: 'LinkedIn Business Account',
        account_email: null,
        account_type: 'linkedin',
        is_active: true,
        user_id: 'admin-user-123',
      },
    ];

    const accountIds: string[] = [];
    for (const account of connectedAccounts) {
      const accountData = {
        ...account,
        user_id: userIds[0], // Use admin user ID
      };

      const { data, error } = await supabaseAdmin
        .from('connected_accounts')
        .insert(accountData)
        .select('id')
        .single();
      
      if (error) {
        logger.warn(`Connected account ${account.account_name} error:`, error.message);
      } else {
        logger.info(`✓ Created account: ${account.account_name}`);
        if (data) accountIds.push(data.id);
      }
    }

    // 5. Create Conversations
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
        assigned_to: 'sdr-user-456',
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
        assigned_to: 'sdr-user-789',
        custom_stage_id: stageIds[2] || null,
        received_on_account_id: accountIds[2] || null,
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
        assigned_to: 'sdr-user-456',
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
        assigned_to: 'sdr-user-789',
        custom_stage_id: stageIds[4] || null,
        received_on_account_id: accountIds[0] || null,
      },
    ];

    const conversationIds: string[] = [];
    for (let i = 0; i < conversations.length; i++) {
      const conv = {
        ...conversations[i],
        assigned_to: conversations[i].assigned_to 
          ? (conversations[i].assigned_to === 'sdr-user-456' ? userIds[1] : userIds[2])
          : null,
        received_on_account_id: accountIds[Math.min(i, accountIds.length - 1)] || null,
      };

      const { data, error } = await supabaseAdmin
        .from('conversations')
        .insert(conv)
        .select('id')
        .single();
      
      if (error) {
        logger.warn(`Conversation error:`, error.message);
      } else {
        logger.info(`✓ Created conversation: ${conv.sender_name}`);
        if (data) conversationIds.push(data.id);
      }
    }

    // 6. Create Messages
    logger.info('Creating messages...');
    if (conversationIds.length > 0) {
      const messages = [
        // Messages for first conversation
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
          sender_id: 'sdr-user-456',
          content: 'Hi John! Thank you for reaching out. I\'d be happy to schedule a call. What time works best for you?',
          is_from_lead: false,
          created_at: new Date(Date.now() - 82800000).toISOString(),
        },
        // Messages for second conversation
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
          sender_id: 'sdr-user-456',
          content: 'Hi Jane! Great to hear from you. I\'ll send over our pricing options right away.',
          is_from_lead: false,
          created_at: new Date(Date.now() - 3300000).toISOString(),
        },
        // Messages for third conversation
        {
          conversation_id: conversationIds[2],
          sender_name: 'Mike Johnson',
          content: 'I saw your post about the new features. Very interested in learning more!',
          is_from_lead: true,
          created_at: new Date(Date.now() - 7200000).toISOString(),
        },
      ];

      for (const message of messages) {
        const messageData = {
          ...message,
          sender_id: message.sender_id 
            ? (message.sender_id === 'sdr-user-456' ? userIds[1] : userIds[2])
            : null,
        };

        const { error } = await supabaseAdmin
          .from('messages')
          .insert(messageData);
        
        if (error) {
          logger.warn(`Message error:`, error.message);
        } else {
          logger.info(`✓ Created message in conversation ${message.conversation_id}`);
        }
      }
    }

    logger.info('✅ Database seed completed successfully!');
    logger.info(`📊 Created:`);
    logger.info(`   - ${userIds.length} users (profiles auto-created)`);
    logger.info(`   - ${userRoles.length} user roles`);
    logger.info(`   - ${stageIds.length} pipeline stages`);
    logger.info(`   - ${accountIds.length} connected accounts`);
    logger.info(`   - ${conversationIds.length} conversations`);
    logger.info(`   - ${conversationIds.length > 0 ? '5' : '0'} messages`);

  } catch (error: any) {
    logger.error('❌ Seed failed:', error);
    throw error;
  }
}

// Run seed if called directly
if (require.main === module) {
  seedDatabase()
    .then(() => {
      logger.info('Seed script completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Seed script failed:', error);
      process.exit(1);
    });
}

export { seedDatabase };

