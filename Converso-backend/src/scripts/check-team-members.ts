#!/usr/bin/env tsx

import { supabaseAdmin } from '../lib/supabase';

async function checkTeamMembers() {
  console.log('🔍 Checking Team Members Data...\n');
  console.log('Using supabaseAdmin (service role) to bypass RLS\n');

  // Check total profiles
  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from('profiles')
    .select('id, email, full_name, workspace_id, status, is_deleted');

  if (profilesError) {
    console.error('❌ Error fetching profiles:', profilesError);
    return;
  }

  console.log(`📊 Total Profiles: ${profiles?.length || 0}`);
  
  if (profiles && profiles.length > 0) {
    console.log('\n👥 Profiles:');
    profiles.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.full_name || 'Unnamed'} (${p.email})`);
      console.log(`     - ID: ${p.id}`);
      console.log(`     - Workspace ID: ${p.workspace_id || 'NULL ⚠️'}`);
      console.log(`     - Status: ${p.status || 'NULL'}`);
      console.log(`     - Is Deleted: ${p.is_deleted || false}`);
    });
  }

  // Check workspaces
  const { data: workspaces, error: workspacesError } = await supabaseAdmin
    .from('workspaces')
    .select('*');

  if (workspacesError) {
    console.error('\n❌ Error fetching workspaces:', workspacesError);
  } else {
    console.log(`\n🏢 Total Workspaces: ${workspaces?.length || 0}`);
    if (workspaces && workspaces.length > 0) {
      workspaces.forEach((w, i) => {
        console.log(`  ${i + 1}. ${w.name} (ID: ${w.id})`);
      });
    }
  }

  // Check user roles
  const { data: roles, error: rolesError } = await supabaseAdmin
    .from('user_roles')
    .select('user_id, role');

  if (rolesError) {
    console.error('\n❌ Error fetching roles:', rolesError);
  } else {
    console.log(`\n👔 Total User Roles: ${roles?.length || 0}`);
    if (roles && roles.length > 0) {
      roles.forEach((r, i) => {
        const profile = profiles?.find(p => p.id === r.user_id);
        console.log(`  ${i + 1}. ${profile?.email || r.user_id} - ${r.role.toUpperCase()}`);
      });
    }
  }

  // Count profiles with/without workspace_id
  const withWorkspace = profiles?.filter(p => p.workspace_id).length || 0;
  const withoutWorkspace = profiles?.filter(p => !p.workspace_id).length || 0;
  
  console.log('\n📈 Summary:');
  console.log(`  ✅ Profiles with workspace_id: ${withWorkspace}`);
  console.log(`  ⚠️  Profiles without workspace_id: ${withoutWorkspace}`);
  
  if (withoutWorkspace > 0) {
    console.log('\n⚠️  WARNING: Some profiles don\'t have workspace_id assigned!');
    console.log('   Run the migration to fix this:');
    console.log('   cd Converso-frontend && npx supabase db push');
  }

  if (workspaces && workspaces.length === 0) {
    console.log('\n⚠️  WARNING: No workspaces exist in the database!');
    console.log('   The migration should create a default workspace.');
  }
}

checkTeamMembers()
  .then(() => {
    console.log('\n✅ Check complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });




