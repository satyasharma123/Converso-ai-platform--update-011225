// ===================================================================
// STEP 3: FORCE SENT + TRASH SYNC (Last 30 Days)
// Run in Browser Console (F12) after backfill
// ===================================================================

(async () => {
  console.log('🔄 FORCE SYNC: Sent + Trash folders (last 30 days)');
  console.log('================================================');
  
  // Get user session
  const session = JSON.parse(localStorage.getItem('sb-wahvinwuyefmkmgmjspo-auth-token'));
  const userId = session?.user?.id;
  
  if (!userId) {
    console.error('❌ Not logged in! Please log in to Converso first.');
    return;
  }
  
  console.log('✅ Authenticated as:', session.user.email || userId);
  console.log('');
  
  try {
    // Get connected email accounts
    console.log('📧 Fetching email accounts...');
    const accountsResponse = await fetch(`http://localhost:3001/api/connected-accounts?userId=${userId}`, {
      headers: { 'x-user-id': userId }
    });
    
    if (!accountsResponse.ok) {
      throw new Error(`Failed to fetch accounts: ${accountsResponse.status}`);
    }
    
    const accountsData = await accountsResponse.json();
    const emailAccounts = accountsData.data.filter(a => a.account_type === 'email');
    
    console.log(`✅ Found ${emailAccounts.length} email account(s)`);
    console.log('');
    
    if (emailAccounts.length === 0) {
      console.error('❌ No email accounts connected. Connect Gmail/Outlook first.');
      return;
    }
    
    // Display accounts
    emailAccounts.forEach((acc, idx) => {
      console.log(`${idx + 1}. ${acc.account_email} (${acc.oauth_provider})`);
    });
    console.log('');
    
    // Trigger sync for each account
    console.log('🚀 Triggering sync for ALL folders (inbox, sent, trash, archive, drafts, important)...');
    console.log('⏱️  This will sync last 30 days from Gmail/Outlook');
    console.log('');
    
    for (const account of emailAccounts) {
      console.log(`🔄 Syncing: ${account.account_email}...`);
      
      const syncResponse = await fetch('http://localhost:3001/api/emails/init-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId
        },
        body: JSON.stringify({ account_id: account.id })
      });
      
      if (syncResponse.ok) {
        const result = await syncResponse.json();
        console.log(`  ✅ Sync triggered for: ${account.account_email}`);
        console.log(`     Message: ${result.message}`);
      } else {
        const error = await syncResponse.text();
        console.error(`  ❌ Sync failed for ${account.account_email}:`, error);
      }
    }
    
    console.log('');
    console.log('✅ All syncs triggered!');
    console.log('');
    console.log('⏳ WAIT 30-60 seconds for sync to complete...');
    console.log('');
    console.log('📊 Then verify in Supabase:');
    console.log('   SELECT provider_folder, COUNT(*) FROM messages WHERE provider_folder IS NOT NULL GROUP BY provider_folder;');
    console.log('');
    console.log('🔄 Then refresh this page (Cmd+R) and check Sent/Trash folders!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
})();

