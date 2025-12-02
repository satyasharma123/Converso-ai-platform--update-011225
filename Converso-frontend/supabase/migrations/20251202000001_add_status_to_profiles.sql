-- Add status and is_deleted columns to profiles table

-- Add status column (invited = user hasn't signed up yet, active = user signed up)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'invited' CHECK (status IN ('invited', 'active'));

-- Add is_deleted column for soft deletes
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_is_deleted ON public.profiles(is_deleted);
CREATE INDEX IF NOT EXISTS idx_profiles_workspace_id ON public.profiles(workspace_id);

-- Update existing users to 'active' status (they already signed up)
UPDATE public.profiles 
SET status = 'active' 
WHERE status = 'invited' AND created_at < NOW();

-- Comment for clarity
COMMENT ON COLUMN public.profiles.status IS 'User status: invited (pending signup) or active (signed up)';
COMMENT ON COLUMN public.profiles.is_deleted IS 'Soft delete flag - true means user is deleted but kept for data integrity';
