-- Create app_settings table to store logo and icon URLs
CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Allow admins to manage settings
CREATE POLICY "Admins can manage app settings"
ON public.app_settings
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow all authenticated users to view settings
CREATE POLICY "Users can view app settings"
ON public.app_settings
FOR SELECT
TO authenticated
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default logo and icon settings (will be updated after images are uploaded)
INSERT INTO public.app_settings (setting_key, setting_value)
VALUES 
  ('logo_url', '/assets/converso-logo.png'),
  ('icon_url', '/assets/converso-icon.png')
ON CONFLICT (setting_key) DO NOTHING;

