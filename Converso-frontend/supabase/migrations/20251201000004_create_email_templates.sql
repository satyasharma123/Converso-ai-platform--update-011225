-- Create email_templates table for saved replies and templates
CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  shortcut TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_email_templates_workspace ON public.email_templates(workspace_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_category ON public.email_templates(category);
CREATE INDEX IF NOT EXISTS idx_email_templates_created_by ON public.email_templates(created_by);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view all templates in their workspace
CREATE POLICY "Users can view templates in workspace"
  ON public.email_templates FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can create templates in their workspace
CREATE POLICY "Users can create templates in workspace"
  ON public.email_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.profiles WHERE id = auth.uid()
    )
    AND created_by = auth.uid()
  );

-- Policy: Users can update their own templates or admins can update any template
CREATE POLICY "Users can update templates in workspace"
  ON public.email_templates FOR UPDATE
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.profiles WHERE id = auth.uid()
    )
    AND (
      created_by = auth.uid() 
      OR public.has_role(auth.uid(), 'admin')
    )
  );

-- Policy: Users can delete their own templates or admins can delete any template
CREATE POLICY "Users can delete templates in workspace"
  ON public.email_templates FOR DELETE
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.profiles WHERE id = auth.uid()
    )
    AND (
      created_by = auth.uid() 
      OR public.has_role(auth.uid(), 'admin')
    )
  );

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_email_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_email_templates_updated_at
BEFORE UPDATE ON public.email_templates
FOR EACH ROW
EXECUTE FUNCTION update_email_templates_updated_at();

-- Seed default templates for existing workspaces
-- Only insert if template with same title doesn't already exist in the workspace
INSERT INTO public.email_templates (workspace_id, title, content, category, shortcut, is_default, created_by)
SELECT 
  w.id,
  template_data.title,
  template_data.content,
  template_data.category,
  template_data.shortcut,
  true,
  NULL
FROM public.workspaces w
CROSS JOIN (VALUES
  ('Demo Request Response', 'Thanks for your interest! I''d love to schedule a personalized demo. Are you available this week?', 'demo', '/demo'),
  ('Pricing Inquiry', 'Great question! Our pricing varies based on your team size and needs. Can you share more details?', 'pricing', '/pricing'),
  ('Follow-up After Demo', 'It was great speaking with you! Do you have any additional questions about what we discussed?', 'follow-up', '/followup'),
  ('Qualification Questions', 'To better understand your needs: What''s your current team size? What''s your main challenge right now?', 'qualification', '/qualify'),
  ('Objection - Price', 'I understand budget is important. Let me show you the ROI our customers typically see in the first quarter.', 'objection', '/objection-price')
) AS template_data(title, content, category, shortcut)
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates et
  WHERE et.workspace_id = w.id 
    AND et.title = template_data.title
);

-- Notify PostgREST to reload schema
SELECT pg_notify('pgrst', 'reload schema');

