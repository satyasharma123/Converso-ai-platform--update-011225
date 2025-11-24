-- ============================================
-- Quick Fix: Create Routing Rules Table
-- Run this in Supabase Dashboard -> SQL Editor
-- ============================================

-- Create routing_rules table
CREATE TABLE IF NOT EXISTS public.routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  condition_field TEXT NOT NULL,
  condition_operator TEXT NOT NULL,
  condition_value TEXT NOT NULL,
  action_type TEXT NOT NULL,
  action_value TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for routing_rules
ALTER TABLE public.routing_rules ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view routing rules
CREATE POLICY "Users can view routing rules"
  ON public.routing_rules FOR SELECT
  TO authenticated
  USING (true);

-- Allow admins to manage routing rules
CREATE POLICY "Admins can manage routing rules"
  ON public.routing_rules FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at on routing_rules
CREATE TRIGGER update_routing_rules_updated_at
BEFORE UPDATE ON public.routing_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Also create workspaces table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for workspaces
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view workspace
CREATE POLICY "Users can view workspace"
  ON public.workspaces FOR SELECT
  TO authenticated
  USING (true);

-- Allow admins to manage workspace
CREATE POLICY "Admins can manage workspace"
  ON public.workspaces FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at on workspaces
CREATE TRIGGER update_workspaces_updated_at
BEFORE UPDATE ON public.workspaces
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default workspace if none exists
INSERT INTO public.workspaces (name)
VALUES ('My Workspace')
ON CONFLICT DO NOTHING;

-- Verify tables were created
DO $$
BEGIN
  RAISE NOTICE '✅ Tables created successfully!';
  RAISE NOTICE '   - routing_rules';
  RAISE NOTICE '   - workspaces';
END $$;

