// Check sync status and errors
(async () => {
  const session = JSON.parse(localStorage.getItem('sb-wahvinwuyefmkmgmjspo-auth-token'));
  const userId = session?.user?.id;
  
  console.log('=== SYNC STATUS CHECK ===');
  
  // Get workspace
  const wsResp = await fetch(`http://localhost:3001/api/workspace`, {
    headers: { 'x-user-id': userId }
  });
  const wsData = await wsResp.json();
  const workspaceId = wsData.data?.id;
  
  console.log('Workspace ID:', workspaceId);
  
  // Get email accounts
  const acctResp = await fetch(`http://localhost:3001/api/connected-accounts?userId=${userId}`, {
    headers: { 'x-user-id': userId }
  });
  const acctData = await acctResp.json();
  const emailAccounts = acctData.data.filter(a => a.account_type === 'email');
  
  console.log('\nEmail Accounts:', emailAccounts.length);
  emailAccounts.forEach(acc => {
    console.log(`  - ${acc.account_email} (${acc.oauth_provider})`);
  });
  
  // Check sync status for each account
  console.log('\n=== SYNC STATUS ===');
  for (const account of emailAccounts) {
    const syncResp = await fetch(
      `http://localhost:3001/api/emails/sync-status?workspace_id=${workspaceId}&account_id=${account.id}`,
      { headers: { 'x-user-id': userId } }
    );
    const syncData = await syncResp.json();
    
    console.log(`\n${account.account_email}:`);
    console.log(`  Status: ${syncData.data?.status || 'unknown'}`);
    console.log(`  Last synced: ${syncData.data?.last_synced_at || 'never'}`);
    console.log(`  Progress: ${syncData.data?.progress || 0}`);
    console.log(`  Error: ${syncData.data?.sync_error || 'none'}`);
  }
  
  console.log('\n=== TRIGGER NEW SYNC ===');
  console.log('Run this to trigger sync again:');
  console.log(`
for (const account of ${JSON.stringify(emailAccounts.map(a => a.id))}) {
  await fetch('http://localhost:3001/api/emails/init-sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': '${userId}'
    },
    body: JSON.stringify({ account_id: account })
  });
}
console.log('Sync triggered');
  `);
})();

