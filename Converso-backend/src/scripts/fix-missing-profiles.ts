/**
 * Script to fix missing profiles for users
 * Run with: npx tsx src/scripts/fix-missing-profiles.ts
 */

import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { createClient } from '@supabase/supabase-js';

async function fixMissingProfiles() {
  console.log('🔄 Checking for users without profiles...\n');

  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wahvinwuyefmkmgmjspo.supabase.co';
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY is not set!');
    process.exit(1);
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  console.log('✅ Connected to Supabase with service role\n');

  try {
    // Get all users from auth.users
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();

    if (authError) {
      console.error('❌ Error fetching auth users:', authError);
      throw authError;
    }

    console.log(`📊 Found ${authUsers.users.length} auth users\n`);

    // Get all existing profiles
    const { data: existingProfiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id');

    if (profilesError) {
      console.error('❌ Error fetching profiles:', profilesError);
      throw profilesError;
    }

    const existingProfileIds = new Set(existingProfiles?.map(p => p.id) || []);
    console.log(`📊 Found ${existingProfileIds.size} existing profiles\n`);

    // Find users without profiles
    const usersWithoutProfiles = authUsers.users.filter(
      (user: { id: string }) => !existingProfileIds.has(user.id)
    );

    if (usersWithoutProfiles.length === 0) {
      console.log('✅ All users have profiles!');
      return;
    }

    console.log(`⚠️  Found ${usersWithoutProfiles.length} users without profiles:\n`);

    // Create missing profiles
    for (const user of usersWithoutProfiles) {
      console.log(`Creating profile for: ${user.email} (${user.id})`);
      
      const { error: insertError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
        });

      if (insertError) {
        console.error(`  ❌ Error creating profile for ${user.email}:`, insertError.message);
      } else {
        console.log(`  ✅ Profile created successfully`);
      }
    }

    console.log('\n✅ Profile fix completed!');
    
  } catch (error: any) {
    console.error('\n❌ Error fixing profiles:', error.message || error);
    process.exit(1);
  }
}

// Run the script
fixMissingProfiles()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });



