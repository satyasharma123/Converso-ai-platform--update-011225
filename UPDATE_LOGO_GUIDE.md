# How to Update Logo and Icon in Database

## Step 1: Upload Images to Supabase Storage

1. Go to Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **Storage** in the left sidebar
4. Create a new bucket called `app-assets` (if it doesn't exist):
   - Click **New bucket**
   - Name: `app-assets`
   - Make it **Public** (so images can be accessed)
   - Click **Create bucket**

5. Upload your images:
   - Click on the `app-assets` bucket
   - Click **Upload file**
   - Upload your logo file (e.g., `converso-logo.png`)
   - Upload your icon file (e.g., `converso-icon.png`)
   - After upload, copy the **Public URL** for each file

## Step 2: Update Database with Image URLs

### Option A: Using Supabase SQL Editor

1. Go to Supabase Dashboard → **SQL Editor**
2. Run this SQL (replace URLs with your actual Supabase Storage URLs):

```sql
-- Update logo URL
UPDATE public.app_settings
SET setting_value = 'https://wahvinwuyefmkmgmjspo.supabase.co/storage/v1/object/public/app-assets/converso-logo.png'
WHERE setting_key = 'logo_url';

-- Update icon URL
UPDATE public.app_settings
SET setting_value = 'https://wahvinwuyefmkmgmjspo.supabase.co/storage/v1/object/public/app-assets/converso-icon.png'
WHERE setting_key = 'icon_url';
```

### Option B: Using the Frontend (After Admin UI is built)

If you have an admin settings page, you can update it there.

## Step 3: Verify

1. Refresh your frontend application
2. The logo should now appear from Supabase Storage
3. Check browser DevTools → Network tab to see if images are loading from Supabase

## Alternative: Use Local Assets

If you prefer to keep images locally:

1. Save the logo as `converso-logo.png` in `Converso-frontend/src/assets/`
2. Save the icon as `converso-icon.png` in `Converso-frontend/src/assets/`
3. Update database to use local paths:

```sql
UPDATE public.app_settings
SET setting_value = '/assets/converso-logo.png'
WHERE setting_key = 'logo_url';

UPDATE public.app_settings
SET setting_value = '/assets/converso-icon.png'
WHERE setting_key = 'icon_url';
```

## Current Implementation

The frontend now:
- ✅ Fetches logo/icon URLs from `app_settings` table
- ✅ Falls back to local assets if database values are not set
- ✅ Uses a reusable `Logo` component
- ✅ Automatically updates when database values change

## Database Schema

The `app_settings` table structure:
- `id` - UUID primary key
- `setting_key` - Unique key (e.g., 'logo_url', 'icon_url')
- `setting_value` - The URL or path to the asset
- `created_at` - Timestamp
- `updated_at` - Timestamp

## Notes

- Logo is used in: Login, Signup, Forgot Password pages
- Icon can be used for: Favicon, app icon, notifications
- Images are cached for 5 minutes
- Only admins can update settings
- All users can view settings

