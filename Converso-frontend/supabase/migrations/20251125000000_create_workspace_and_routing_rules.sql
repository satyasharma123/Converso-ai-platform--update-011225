-- ============================================
-- Migration: Create Workspace and Routing Rules Tables
-- ============================================

-- Create workspaces table
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for workspaces
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view workspace
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'workspaces' 
    AND policyname = 'Users can view workspace'
  ) THEN
    CREATE POLICY "Users can view workspace"
      ON public.workspaces FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- Allow admins to manage workspace
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'workspaces' 
    AND policyname = 'Admins can manage workspace'
  ) THEN
    CREATE POLICY "Admins can manage workspace"
      ON public.workspaces FOR ALL
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

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
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'routing_rules' 
    AND policyname = 'Users can view routing rules'
  ) THEN
    CREATE POLICY "Users can view routing rules"
      ON public.routing_rules FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- Allow admins to manage routing rules
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'routing_rules' 
    AND policyname = 'Admins can manage routing rules'
  ) THEN
    CREATE POLICY "Admins can manage routing rules"
      ON public.routing_rules FOR ALL
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- Create trigger for updated_at on workspaces
DROP TRIGGER IF EXISTS update_workspaces_updated_at ON public.workspaces;
CREATE TRIGGER update_workspaces_updated_at
BEFORE UPDATE ON public.workspaces
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for updated_at on routing_rules
DROP TRIGGER IF EXISTS update_routing_rules_updated_at ON public.routing_rules;
CREATE TRIGGER update_routing_rules_updated_at
BEFORE UPDATE ON public.routing_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default workspace if none exists
INSERT INTO public.workspaces (name)
VALUES ('My Workspace')
ON CONFLICT DO NOTHING;

