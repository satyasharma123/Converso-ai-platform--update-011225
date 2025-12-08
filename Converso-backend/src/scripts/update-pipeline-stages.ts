/**
 * Script to update pipeline stages to the 8 standard stages
 * Run with: npx tsx src/scripts/update-pipeline-stages.ts
 */

import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Force environment variable loading before any imports
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log('Loading environment variables...');
}

import { createClient } from '@supabase/supabase-js';

const STANDARD_STAGES = [
  { name: 'Prospect', description: 'Newly received leads', display_order: 0 },
  { name: 'Discovery Call', description: 'Meeting to understand client requirement', display_order: 1 },
  { name: 'Lead', description: 'Lead qualified for sales', display_order: 2 },
  { name: 'Demo', description: 'Proposal sent to lead', display_order: 3 },
  { name: 'Negotiation', description: 'In negotiation phase', display_order: 4 },
  { name: 'Proposal Sent', description: 'Deal closed successfully', display_order: 5 },
  { name: 'Contract Signing', description: 'Contract under signature at both the parties', display_order: 6 },
  { name: 'Payment', description: '1st payment by Customer', display_order: 7 },
  { name: 'Invalid Leads', description: 'Not the ideal client', display_order: 8 },
];

async function updatePipelineStages() {
  console.log('🔄 Updating pipeline stages to 8 standard stages...\n');

  // Create a fresh supabaseAdmin client with service role key
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
    // Step 1: Get all existing stages
    const { data: existingStages, error: fetchError } = await supabaseAdmin
      .from('pipeline_stages')
      .select('id, name');

    if (fetchError) {
      console.error('❌ Error fetching existing stages:', fetchError);
      throw fetchError;
    }

    console.log(`📊 Found ${existingStages?.length || 0} existing stages`);

    // Step 2: Get the first new stage ID for conversation reassignment
    let prospectStageId: string | null = null;

    // Step 3: Delete all existing stages (will set conversations.custom_stage_id to NULL)
    if (existingStages && existingStages.length > 0) {
      console.log('🗑️  Deleting existing stages...');
      const { error: deleteError } = await supabaseAdmin
        .from('pipeline_stages')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (deleteError) {
        console.error('❌ Error deleting stages:', deleteError);
        throw deleteError;
      }
      console.log('✅ Existing stages deleted');
    }

    // Step 4: Insert new standard stages
    console.log('\n📝 Inserting 8 standard stages...');
    const { data: newStages, error: insertError } = await supabaseAdmin
      .from('pipeline_stages')
      .insert(STANDARD_STAGES)
      .select();

    if (insertError) {
      console.error('❌ Error inserting new stages:', insertError);
      throw insertError;
    }

    if (!newStages || newStages.length === 0) {
      throw new Error('No stages were created');
    }

    console.log(`✅ Created ${newStages.length} new stages:`);
    newStages.forEach((stage, index) => {
      console.log(`  ${index + 1}. ${stage.name} - ${stage.description}`);
    });

    // Get Prospect stage ID
    prospectStageId = newStages.find(s => s.name === 'Prospect')?.id || null;

    // Step 5: Move existing conversations to Prospect stage
    if (prospectStageId) {
      console.log('\n🔄 Moving existing conversations to "Prospect" stage...');
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('conversations')
        .update({ custom_stage_id: prospectStageId })
        .is('custom_stage_id', null)
        .select('id');

      if (updateError) {
        console.error('⚠️  Warning: Could not update conversations:', updateError);
      } else {
        console.log(`✅ Updated ${updated?.length || 0} conversations`);
      }
    }

    console.log('\n✅ Pipeline stages update completed successfully!');
    console.log('\n📌 The 8 standard stages are now available and editable by admins.');
    
  } catch (error: any) {
    console.error('\n❌ Error updating pipeline stages:', error.message || error);
    process.exit(1);
  }
}

// Run the script
updatePipelineStages()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });








