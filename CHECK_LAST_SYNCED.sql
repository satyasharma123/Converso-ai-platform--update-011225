-- Check if last_synced_at was cleared and when it was updated
SELECT 
  account_email,
  oauth_provider,
  last_synced_at,
  created_at,
  -- Check if last_synced_at is recent (within last hour = was just updated by resync)
  last_synced_at > NOW() - INTERVAL '1 hour' as recently_synced
FROM connected_accounts
WHERE oauth_provider = 'microsoft';
