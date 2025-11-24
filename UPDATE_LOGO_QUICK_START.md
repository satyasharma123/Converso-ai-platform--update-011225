# Quick Start: Update Logo and Icon

## 🎯 Quick Steps

### Step 1: Run Database Migration

Run this SQL in Supabase Dashboard → SQL Editor:

```sql
-- Create app_settings table
CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage app settings"
ON public.app_settings FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view app settings"
ON public.app_settings FOR SELECT
TO authenticated
USING (true);

CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
```

### Step 2: Upload Images

**Option A: Supabase Storage (Recommended)**
1. Go to Supabase Dashboard → Storage
2. Create bucket `app-assets` (make it public)
3. Upload your logo and icon images
4. Copy the public URLs

**Option B: Local Assets**
1. Save logo as `converso-logo.png` in `Converso-frontend/src/assets/`
2. Save icon as `converso-icon.png` in `Converso-frontend/src/assets/`

### Step 3: Update Database

**Option A: Using SQL (Easiest)**
```sql
-- For Supabase Storage URLs
UPDATE public.app_settings
SET setting_value = 'https://wahvinwuyefmkmgmjspo.supabase.co/storage/v1/object/public/app-assets/converso-logo.png'
WHERE setting_key = 'logo_url';

UPDATE public.app_settings
SET setting_value = 'https://wahvinwuyefmkmgmjspo.supabase.co/storage/v1/object/public/app-assets/converso-icon.png'
WHERE setting_key = 'icon_url';

-- OR for local assets
UPDATE public.app_settings
SET setting_value = '/assets/converso-logo.png'
WHERE setting_key = 'logo_url';

UPDATE public.app_settings
SET setting_value = '/assets/converso-icon.png'
WHERE setting_key = 'icon_url';
```

**Option B: Using Script**
```bash
cd Converso-backend
npm run update-logo "https://your-logo-url.png" "https://your-icon-url.png"
```

## ✅ What Was Done

1. ✅ Created `app_settings` database table
2. ✅ Created `Logo` component that fetches from database
3. ✅ Updated Login, Signup, ForgotPassword pages to use Logo component
4. ✅ Created hook `useAppSettings` to fetch logo/icon URLs
5. ✅ Added fallback to local assets if database is empty

## 📝 Current Status

- Frontend is ready to use database logo/icon
- Database migration script created
- Logo component automatically fetches from database
- Falls back to local assets if database is empty

## 🚀 Next Steps

1. **Run the migration** in Supabase SQL Editor
2. **Upload your images** to Supabase Storage or save locally
3. **Update the database** with image URLs
4. **Refresh frontend** - logo will appear automatically!

The logo will now be dynamically loaded from the database! 🎉

