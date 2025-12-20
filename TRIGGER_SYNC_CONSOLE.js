// ===================================================================
// TRIGGER EMAIL SYNC - Run in Browser Console (F12)
// ===================================================================

(async () => {
  console.log('🔄 Starting email sync...');
  
  // Get user session
  const session = JSON.parse(localStorage.getItem('sb-wahvinwuyefmkmgmjspo-auth-token'));
  const userId = session?.user?.id;
  
  if (!userId) {
    console.error('❌ Not logged in! Please log in to Converso first.');
    return;
  }
  
  console.log('✅ Authenticated as:', session.user.email || userId);
  
  try {
    // Get connected email accounts
    const accountsResponse = await fetch(`http://localhost:3001/api/connected-accounts?userId=${userId}`, {
      headers: { 'x-user-id': userId }
    });
    
    const accountsData = await accountsResponse.json();
    const emailAccounts = accountsData.data.filter(a => a.account_type === 'email');
    
    console.log(`📧 Found ${emailAccounts.length} email account(s)`);
    
    if (emailAccounts.length === 0) {
      console.error('❌ No email accounts connected. Connect Gmail/Outlook first.');
      return;
    }
    
    // Trigger sync for each account
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
        console.log(`✅ Sync triggered for: ${account.account_email}`);
      } else {
        const error = await syncResponse.text();
        console.error(`❌ Sync failed for ${account.account_email}:`, error);
      }
    }
    
    console.log('✅ All syncs triggered!');
    console.log('⏳ Wait 30-60 seconds for sync to complete...');
    console.log('📊 Then check: SELECT provider_folder, COUNT(*) FROM messages GROUP BY provider_folder;');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
})();



