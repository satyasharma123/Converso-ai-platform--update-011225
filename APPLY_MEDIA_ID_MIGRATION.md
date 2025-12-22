# Add media_id Column Migration

## Overview
This migration adds a nullable `media_id` column to the `messages` table to store Unipile media IDs for LinkedIn attachments.

## Migration Details

- **Column Name:** `media_id`
- **Type:** `TEXT`
- **Nullable:** `YES`
- **Default:** `NULL`
- **Purpose:** Store Unipile media IDs for LinkedIn attachments

## Files Created

1. **Migration File:**
   - `Converso-frontend/supabase/migrations/20251223000001_add_media_id_to_messages.sql`
   - This follows the standard Supabase migration naming convention

2. **Standalone SQL File:**
   - `ADD_MEDIA_ID_COLUMN.sql`
   - Can be run directly in Supabase SQL Editor

## How to Apply the Migration

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `ADD_MEDIA_ID_COLUMN.sql`
4. Click **Run**
5. Verify the output shows the new column

### Option 2: Supabase CLI (If authenticated)

```bash
cd Converso-frontend
supabase db push
```

### Option 3: Direct SQL (If you have database credentials)

```bash
psql $DATABASE_URL -f ADD_MEDIA_ID_COLUMN.sql
```

## Verification

After applying the migration, verify the column exists:

```sql
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'messages' 
  AND column_name = 'media_id';
```

Expected output:
```
 column_name | data_type | is_nullable | column_default 
-------------+-----------+-------------+----------------
 media_id    | text      | YES         | NULL
```

## Impact Assessment

### ✅ Safe Changes
- Adding a nullable column does NOT require any code changes
- Existing queries will continue to work
- No data migration needed
- No indexes added (no performance impact)
- Backend application will continue running without errors

### ✅ Backward Compatible
- Old code that doesn't use `media_id` will work fine
- New code can start using `media_id` immediately after migration
- No breaking changes to existing APIs

## Next Steps

After applying this migration, you can:

1. Update LinkedIn message mappers to store `media_id` when available
2. Use `media_id` for more efficient media lookups
3. Implement media caching strategies using `media_id`

## Rollback (If Needed)

If you need to rollback this migration:

```sql
ALTER TABLE messages DROP COLUMN IF EXISTS media_id;
```

**Note:** Only rollback if absolutely necessary. This is a safe, additive change.
